import { noInlineObjectType } from "./noInlineObjectType.mjs";
import { ruleTester } from "./ruleTester.mjs";

const inline = [{ messageId: "inline" }];

ruleTester.run("no-inline-object-type", noInlineObjectType, {
  valid: [
    "interface ButtonProps { label: string; onPress: () => void }\nconst Button = ({ label, onPress }: ButtonProps) => null;",
    "const Heading = ({ children }: { children: string }) => null;",
    "const options: { a: number; b: number } = { a: 1, b: 2 };",
    "type Pair = { a: number; b: number } | null;",
    "interface Holder { pair: { a: number; b: number } }",
    "const fold = (rows: Row[]) => rows.reduce((total, row) => total + row.n, 0);",
  ],
  invalid: [
    { code: "const Button = ({ label, onPress }: { label: string; onPress: () => void }) => null;", errors: inline },
    { code: "const counts = (): { input: number; output: number } => ({ input: 1, output: 2 });", errors: inline },
    { code: "const load = async (): Promise<{ id: string; stopped: boolean }> => ({ id: '', stopped: false });", errors: inline },
    { code: "function read(at: { project: string; chat: string }) {}", errors: inline },
    {
      code: "class Engine { async pull(): Promise<{ reason: string; detail: string }> { return { reason: '', detail: '' }; } }",
      errors: inline,
    },
    { code: "interface Props { imageOf: (id: string) => { url: string; wide: boolean } }", errors: inline },
    { code: "type Resolve = (link: string) => Promise<{ transcript: string; answer: string }>;", errors: inline },
    { code: "const outer = (deps: { a: { b: number; c: number }; d: number }) => null;", errors: inline },
  ],
});
