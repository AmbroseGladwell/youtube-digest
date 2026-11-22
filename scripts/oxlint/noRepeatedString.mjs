import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

const MIN_LENGTH = 4;
const MIN_SHARED_LENGTH = 8;
const WORD_LIKE = /^[A-Za-z][A-Za-z0-9_-]*$/;
const SOURCE_FILE = /\.(ts|tsx|mts|cts|js|mjs|cjs)$/;
const SKIPPED_FOLDERS = new Set(["node_modules", "dist", "build", ".git", ".local", "coverage", "test-results", "playwright-report"]);
const NOT_PRODUCT = /(\.test\.|\.testHelper\.|\/playwright\/|\/scripts\/|^scripts\/)/;
const STRING_LITERAL = /"((?:[^"\\\s]|\\.){8,})"/g;
const COPY = /\s/;
const COMPARISON = new Set(["===", "!==", "==", "!="]);

const isCandidate = (value) => value.length >= MIN_LENGTH && !WORD_LIKE.test(value) && value.trim() === value && /[A-Za-z]/.test(value);

const isExempt = (node) => {
  const holder = node.parent;
  switch (holder.type) {
    case "ImportDeclaration":
    case "ExportNamedDeclaration":
    case "ExportAllDeclaration":
    case "ImportExpression":
    case "TSLiteralType":
    case "TSExternalModuleReference":
    case "TSImportType":
    case "JSXAttribute":
    case "SwitchCase":
      return true;
    case "ExpressionStatement":
      return holder.directive !== undefined;
    case "Property":
    case "TSPropertySignature":
    case "PropertyDefinition":
    case "MethodDefinition":
      return holder.key === node && !holder.computed;
    case "BinaryExpression":
      return COMPARISON.has(holder.operator);
    case "CallExpression":
      return holder.callee.type === "Identifier" && holder.callee.name === "require";
    default:
      return false;
  }
};

let productStrings = null;

const collect = (root, folder, into) => {
  for (const entry of readdirSync(folder, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIPPED_FOLDERS.has(entry.name) && !entry.name.startsWith(".")) {
        collect(root, join(folder, entry.name), into);
      }
      continue;
    }
    const path = join(folder, entry.name);
    const file = relative(root, path);
    if (!SOURCE_FILE.test(entry.name) || NOT_PRODUCT.test(file)) {
      continue;
    }
    for (const match of readFileSync(path, "utf8").matchAll(STRING_LITERAL)) {
      const files = into.get(match[1]) ?? new Set();
      files.add(file);
      into.set(match[1], files);
    }
  }
  return into;
};

const filesUsing = (root, value) => {
  productStrings ??= collect(root, root, new Map());
  return productStrings.get(value) ?? new Set();
};

export const noRepeatedString = {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "A string used twice in a file is a const at its top; a URL, path or key another file also has is exported from its owner.",
    },
    schema: [{ type: "object", properties: { acrossFiles: { type: "boolean" } }, additionalProperties: false }],
    messages: {
      repeated: "This string appears {{count}} times in this file. Pull it into a const at the top of the file.",
      shared: "This string is also in {{other}}. Export one const from the module that owns it and import it in the others.",
    },
  },
  create: (context) => {
    const acrossFiles = context.options[0]?.acrossFiles === true;
    const seen = new Map();
    const remember = (node, value) => {
      if (isCandidate(value) && !isExempt(node)) {
        seen.set(value, [...(seen.get(value) ?? []), node]);
      }
    };
    return {
      Literal: (node) => {
        if (typeof node.value === "string") {
          remember(node, node.value);
        }
      },
      TemplateLiteral: (node) => {
        if (node.expressions.length === 0 && node.parent.type !== "TaggedTemplateExpression") {
          remember(node, node.quasis[0].value.cooked);
        }
      },
      "Program:exit": () => {
        const root = context.cwd;
        const here = relative(root, context.physicalFilename);
        for (const [value, nodes] of seen) {
          if (nodes.length > 1) {
            for (const node of nodes.slice(1)) {
              context.report({ node, messageId: "repeated", data: { count: String(nodes.length) } });
            }
            continue;
          }
          if (!acrossFiles || value.length < MIN_SHARED_LENGTH || value.includes('"') || COPY.test(value)) {
            continue;
          }
          const others = [...filesUsing(root, value)].filter((file) => file !== here);
          if (others.length > 0) {
            context.report({
              node: nodes[0],
              messageId: "shared",
              data: { other: others.slice(0, 2).join(", ") + (others.length > 2 ? ` and ${others.length - 2} more` : "") },
            });
          }
        }
      },
    };
  },
};
