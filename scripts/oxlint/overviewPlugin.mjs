import { noInlineObjectType } from "./noInlineObjectType.mjs";
import { noLongComment } from "./noLongComment.mjs";
import { noRepeatedString } from "./noRepeatedString.mjs";
import { noSideEffectTernary } from "./noSideEffectTernary.mjs";

export default {
  meta: { name: "overview" },
  rules: {
    "no-inline-object-type": noInlineObjectType,
    "no-long-comment": noLongComment,
    "no-repeated-string": noRepeatedString,
    "no-side-effect-ternary": noSideEffectTernary,
  },
};
