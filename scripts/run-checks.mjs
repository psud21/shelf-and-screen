// Runs every scripts/check-*.mjs file and reports which ones failed.
import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const directory = fileURLToPath(new URL(".", import.meta.url));
const checks = readdirSync(directory)
  .filter((name) => /^check-.*\.mjs$/.test(name))
  .sort();
const failed = [];
for (const name of checks) {
  const result = spawnSync(process.execPath, [directory + name], { encoding: "utf8" });
  if (result.status === 0) {
    console.log(`ok    ${name}`);
  } else {
    failed.push(name);
    console.log(`FAIL  ${name}\n${result.stdout}${result.stderr}`);
  }
}
console.log(`\n${checks.length - failed.length} of ${checks.length} checks passed.`);
if (failed.length) process.exit(1);
