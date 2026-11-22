const FUNCTION_TYPES = new Set([
  "ArrowFunctionExpression",
  "FunctionDeclaration",
  "FunctionExpression",
  "TSDeclareFunction",
  "TSEmptyBodyFunctionExpression",
  "TSMethodSignature",
  "TSFunctionType",
  "TSCallSignatureDeclaration",
  "TSConstructorType",
]);
const MIN_MEMBERS = 2;

const isInSignature = (literal) => {
  let child = literal;
  for (let node = literal.parent; node; node = node.parent) {
    if (node.type === "TSTypeLiteral") {
      return false;
    }
    if (FUNCTION_TYPES.has(node.type)) {
      return node.params.includes(child) || node.returnType === child;
    }
    if (
      node.type === "TSTypeAliasDeclaration" ||
      node.type === "TSInterfaceBody" ||
      node.type === "VariableDeclarator" ||
      node.type === "ClassBody"
    ) {
      return false;
    }
    child = node;
  }
  return false;
};

export const noInlineObjectType = {
  meta: {
    type: "suggestion",
    docs: { description: "An object type with more than one member is named, not written inline in a function signature." },
    messages: {
      inline:
        "Name this object type with an interface above the function, so the signature stays readable (docs/conventions/lint-and-format.md).",
    },
  },
  create: (context) => ({
    TSTypeLiteral: (node) => {
      if (node.members.length >= MIN_MEMBERS && isInSignature(node)) {
        context.report({ node, messageId: "inline" });
      }
    },
  }),
};
