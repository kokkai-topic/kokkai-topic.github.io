import { readFile, writeFile } from "node:fs/promises";
import { ingestBatch } from "./ingest-core";
import type { AssignmentFile, BatchInput, BatchOutput, Meta, Registry } from "./types";

async function main() {
  const args = process.argv.slice(2);
  const bi = args.indexOf("--batch");
  if (bi < 0 || !args[bi + 1]) {
    console.error("usage: npm run ingest -- --batch <batchId>");
    process.exit(1);
  }
  const batchId = args[bi + 1];

  const meta: Meta = JSON.parse(await readFile("data/meta.json", "utf8"));
  if (meta.ingestedBatches.includes(batchId)) {
    console.error(`already ingested: ${batchId}`);
    process.exit(1);
  }
  const input: BatchInput = JSON.parse(await readFile(`cache/llm/input/${batchId}.json`, "utf8"));
  const output: BatchOutput = JSON.parse(await readFile(`cache/llm/output/${batchId}.json`, "utf8"));
  const registry: Registry = JSON.parse(await readFile("data/topics.json", "utf8"));

  const result = ingestBatch(registry, input, output, input.date);
  if (result.errors.length > 0) {
    for (const e of result.errors) console.error("ERROR: " + e);
    process.exit(1);
  }

  const asgPath = `data/assignments/${input.issueId}.json`;
  const asg: AssignmentFile = JSON.parse(await readFile(asgPath, "utf8"));
  const existing = new Set(asg.assignments.map((a) => a.speechId));
  for (const a of result.assignments) {
    if (!existing.has(a.speechId)) asg.assignments.push(a);
  }
  await writeFile(asgPath, JSON.stringify(asg, null, 1));
  await writeFile("data/topics.json", JSON.stringify(result.registry, null, 1));
  meta.ingestedBatches.push(batchId);
  await writeFile("data/meta.json", JSON.stringify(meta, null, 1));

  for (const t of result.added) console.log(`new topic: ${t.id} ${t.name}`);
  console.log(`ingested ${batchId}: ${result.assignments.length} assignments (${asg.assignments.length}/${asg.expected})`);
}

main();
