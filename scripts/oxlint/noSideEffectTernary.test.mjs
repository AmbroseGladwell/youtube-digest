import { noSideEffectTernary } from "./noSideEffectTernary.mjs";
import { ruleTester } from "./ruleTester.mjs";

const sideEffect = [{ messageId: "sideEffect" }];

ruleTester.run("no-side-effect-ternary", noSideEffectTernary, {
  valid: [
    "const label = open ? 'Close' : 'Open';",
    "const pick = () => (ready ? first() : second());",
    "const run = () => (api === null ? Promise.resolve(null) : api.search(query));",
    "const parts = [shown.length === 0 ? null : setAsideBlock(shown)];",
    "items.map((item) => (item.done ? done(item) : open(item)));",
    "if (open) { close(); } else { show(); }",
  ],
  invalid: [
    { code: "open ? close() : show();", errors: sideEffect },
    { code: "void (ready ? navigate(home) : navigate(back));", errors: sideEffect },
    { code: "const x = ready ? (count = 1) : 0;", errors: sideEffect },
    { code: "const x = ready ? count++ : 0;", errors: sideEffect },
    { code: "const x = ready ? delete cache[key] : false;", errors: sideEffect },
    { code: "<button onClick={() => (open ? close() : show())} />;", errors: sideEffect },
    { code: "values.forEach((value) => (keyed ? store.put(value, key) : store.put(value)));", errors: sideEffect },
    { code: "useEffect(() => (ready ? start() : stop()), [ready]);", errors: sideEffect },
    { code: "const leave = () => (asking ? setLeaving(true) : leaveNow());", errors: sideEffect },
    { code: "const toggle = (): void => (open ? close() : show());", errors: sideEffect },
  ],
});
