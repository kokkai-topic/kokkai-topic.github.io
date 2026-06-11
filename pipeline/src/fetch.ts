import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { fetchMeetings } from "./api";
import type { Meta } from "./types";
import { computeWindow } from "./window";

async function main() {
  const args = process.argv.slice(2);
  const meta: Meta = JSON.parse(await readFile("data/meta.json", "utf8"));
  const today = new Date().toISOString().slice(0, 10);
  let { from, until } = computeWindow(meta, today);
  const fi = args.indexOf("--from");
  if (fi >= 0) from = args[fi + 1];
  const ui = args.indexOf("--until");
  if (ui >= 0) until = args[ui + 1];

  await mkdir("cache/raw", { recursive: true });
  let fetched = 0;
  let skipped = 0;
  for await (const m of fetchMeetings(from, until)) {
    const path = `cache/raw/${m.issueID}.json`;
    try {
      await access(path);
      skipped++;
      continue;
    } catch {
      // 未取得
    }
    await writeFile(path, JSON.stringify(m, null, 1));
    fetched++;
    console.log(`fetched: ${m.date} ${m.nameOfHouse} ${m.nameOfMeeting} (${m.issueID})`);
  }
  console.log(`done: ${fetched} new, ${skipped} cached (window ${from}..${until})`);
}

main();
