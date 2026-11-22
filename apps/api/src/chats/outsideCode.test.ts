import test from "node:test";
import assert from "node:assert/strict";
import { outsideCode } from "./outsideCode.js";
import { withoutDashes } from "./structuredAnswer.js";
import { withoutCitationMarks } from "./withoutCitationMarks.js";

const clean = (text: string) => outsideCode(text, (prose) => withoutDashes(withoutCitationMarks(prose)));

test("an answer's code keeps its spaces, dashes and brackets while its prose is cleaned (OV-364)", () => {
  assert.equal(
    clean("Run it — like so (p2):\n```py\nif a:\n    print(a[p2])  # x — y\n```\nand `a  --b` too."),
    "Run it, like so:\n```py\nif a:\n    print(a[p2])  # x — y\n```\nand `a  --b` too.",
  );
});

test("a fence still open while the answer arrives is code all the same", () => {
  assert.equal(clean("Try:\n```\nls  -la"), "Try:\n```\nls  -la");
});
