import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import type { RawMeeting } from "./api";
import { chunkSpeeches } from "./chunk";
import { normalizeMeeting } from "./normalize";
import type { AssignmentFile, BatchInput, Meta } from "./types";

async function main() {
  await mkdir("cache/llm/input", { recursive: true });
  await mkdir("cache/llm/output", { recursive: true });
  await mkdir("data/assignments", { recursive: true });
  const meta: Meta = JSON.parse(await readFile("data/meta.json", "utf8"));
  const rawFiles = (await readdir("cache/raw")).filter((f) => f.endsWith(".json"));
  const queued: string[] = [];

  for (const f of rawFiles) {
    const m: RawMeeting = JSON.parse(await readFile(`cache/raw/${f}`, "utf8"));
    const speeches = normalizeMeeting(m);
    if (speeches.length === 0) continue;

    const asgPath = `data/assignments/${m.issueID}.json`;
    if (existsSync(asgPath)) {
      const asg: AssignmentFile = JSON.parse(await readFile(asgPath, "utf8"));
      if (asg.assignments.length >= asg.expected) continue; // 分類完了済み
    } else {
      const asg: AssignmentFile = {
        issueId: m.issueID,
        expected: speeches.length,
        assignments: speeches
          .filter((s) => s.procedural)
          .map((s) => ({ speechId: s.speechId, topicId: "procedural" })),
      };
      await writeFile(asgPath, JSON.stringify(asg, null, 1));
    }

    const chunks = chunkSpeeches(speeches.filter((s) => !s.procedural));
    for (let i = 0; i < chunks.length; i++) {
      const batchId = `${m.issueID}-${String(i).padStart(2, "0")}`;
      if (meta.ingestedBatches.includes(batchId)) continue;
      const inputPath = `cache/llm/input/${batchId}.json`;
      if (!existsSync(inputPath)) {
        const input: BatchInput = {
          batchId,
          issueId: m.issueID,
          date: m.date,
          house: m.nameOfHouse,
          meeting: m.nameOfMeeting,
          speeches: chunks[i].map((s) => ({
            id: s.speechId,
            speaker: s.speaker,
            position: s.position,
            group: s.group,
            chars: s.chars,
            text: s.text,
          })),
        };
        await writeFile(inputPath, JSON.stringify(input, null, 1));
      }
      queued.push(batchId);
    }
  }

  if (queued.length === 0) {
    console.log("no pending batches");
  } else {
    console.log(`pending batches (${queued.length}):`);
    for (const b of queued) console.log("  " + b);
  }
}

main();
