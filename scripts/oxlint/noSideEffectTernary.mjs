const EFFECT_TYPES = new Set(["AssignmentExpression", "UpdateExpression"]);
const WRAPPER_TYPES = new Set(["TSAsExpression", "TSNonNullExpression", "TSSatisfiesExpression", "ParenthesizedExpression"]);
const EFFECT_CALLBACK_CALLEES = new Set(["forEach", "useEffect", "useLayoutEffect"]);
const STATE_SETTER = /^set[A-Z]/;

const unwrap = (node) => (WRAPPER_TYPES.has(node.type) ? unwrap(node.expression) : node);

const isEffect = (branch) => {
  const node = unwrap(branch);
  if (node.type === "UnaryExpression") {
    return node.operator === "delete";
  }
  return EFFECT_TYPES.has(node.type);
};

const isSetterCall = (branch) => {
  const node = unwrap(branch);
  return node.type === "CallExpression" && node.callee.type === "Identifier" && STATE_SETTER.test(node.callee.name);
};

const calleeName = (call) => {
  const callee = call.callee;
  if (callee.type === "Identifier") {
    return callee.name;
  }
  return callee.type === "MemberExpression" && callee.property.type === "Identifier" ? callee.property.name : null;
};

const isEffectArrow = (arrow) => {
  const holder = arrow.parent;
  if (arrow.returnType?.typeAnnotation.type === "TSVoidKeyword") {
    return true;
  }
  if (holder.type === "JSXExpressionContainer") {
    return holder.parent.type === "JSXAttribute" && /^on[A-Z]/.test(holder.parent.name.name);
  }
  return holder.type === "CallExpression" && holder.arguments.includes(arrow) && EFFECT_CALLBACK_CALLEES.has(calleeName(holder));
};

const isDiscarded = (node) => {
  const holder = node.parent;
  if (holder.type === "ExpressionStatement") {
    return true;
  }
  if (holder.type === "UnaryExpression") {
    return holder.operator === "void";
  }
  if (holder.type !== "ArrowFunctionExpression" || holder.body !== node) {
    return false;
  }
  return isEffectArrow(holder) || isSetterCall(node.consequent) || isSetterCall(node.alternate);
};

export const noSideEffectTernary = {
  meta: {
    type: "suggestion",
    docs: { description: "A ternary produces a value; a side effect is an if." },
    messages: {
      sideEffect: "A ternary only sets or returns a value. Write this side effect as an if/else (docs/conventions/lint-and-format.md).",
    },
  },
  create: (context) => ({
    ConditionalExpression: (node) => {
      if (isDiscarded(node) || isEffect(node.consequent) || isEffect(node.alternate)) {
        context.report({ node, messageId: "sideEffect" });
      }
    },
  }),
};
