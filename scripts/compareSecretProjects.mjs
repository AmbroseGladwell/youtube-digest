import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export const PROJECTS = ["overview-dev", "overview-prod", "overview-evals"];

export function compareSecretProjects(secretsByProject) {
  const projects = Object.keys(secretsByProject);
  const keys = [...new Set(projects.flatMap((project) => secretsByProject[project].map((secret) => secret.key)))].sort();
  return keys.map((key) => {
    const digests = projects.map((project) => {
      const secret = secretsByProject[project].find((candidate) => candidate.key === key);
      return secret ? createHash("sha256").update(secret.value).digest("hex") : null;
    });
    const distinct = [...new Set(digests.filter((digest) => digest !== null))];
    const labels = digests.map((digest) => (digest === null ? "-" : String.fromCharCode(65 + distinct.indexOf(digest))));
    const present = digests.filter((digest) => digest !== null).length;
    return { key, labels, shared: distinct.length < present };
  });
}

export function formatComparison(projects, rows) {
  const width = Math.max(...rows.map((row) => row.key.length), 3);
  const header = ["key".padEnd(width), ...projects].join("  ");
  const lines = rows.map((row) =>
    [row.key.padEnd(width), ...row.labels.map((label, index) => label.padEnd(projects[index].length)), row.shared ? "SHARED" : ""]
      .join("  ")
      .trimEnd(),
  );
  return [header, ...lines].join("\n");
}

function bwsJson(args) {
  return JSON.parse(execFileSync("bws", args, { encoding: "utf-8", stdio: ["ignore", "pipe", "inherit"] }));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const visible = bwsJson(["project", "list"]);
  const secretsByProject = {};
  for (const name of PROJECTS) {
    const project = visible.find((candidate) => candidate.name === name);
    if (!project) {
      console.error(`${name}: not visible to this access token, left out`);
      continue;
    }
    secretsByProject[name] = bwsJson(["secret", "list", project.id]).map(({ key, value }) => ({ key, value }));
  }
  const rows = compareSecretProjects(secretsByProject);
  console.log(formatComparison(Object.keys(secretsByProject), rows));
  if (rows.some((row) => row.shared)) process.exitCode = 1;
}
