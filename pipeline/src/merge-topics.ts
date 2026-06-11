import { readFile, readdir, writeFile } from "node:fs/promises";
import { applyMergeMap } from "./merge-core";
import type { AssignmentFile, Registry } from "./types";

async function main() {
  const args = process.argv.slice(2);
  const mi = args.indexOf("--map");
  if (mi < 0 || !args[mi + 1]) {
    console.error("usage: npm run merge-topics -- --map <mapFile.json>");
    process.exit(1);
  }
  const map: Record<string, string> = JSON.parse(await readFile(args[mi + 1], "utf8"));
  const registry: Registry = JSON.parse(await readFile("data/topics.json", "utf8"));
  const fileNames = (await readdir("data/assignments")).filter((f) => f.endsWith(".json"));
  const files: AssignmentFile[] = [];
  for (const f of fileNames) {
    files.push(JSON.parse(await readFile(`data/assignments/${f}`, "utf8")));
  }

  const r = applyMergeMap(registry, files, map);
  if (r.errors.length > 0) {
    for (const e of r.errors) console.error("ERROR: " + e);
    process.exit(1);
  }
  await writeFile("data/topics.json", JSON.stringify(r.registry, null, 1));
  for (const f of r.files) {
    await writeFile(`data/assignments/${f.issueId}.json`, JSON.stringify(f, null, 1));
  }
  console.log(`merged ${Object.keys(map).length} topics. 続けて npm run aggregate を実行してください`);
}

main();
