import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { fetchMeetings } from "./api";
import type { Meta } from "./types";
import { computeWindow } from "./window";

async function main() {
  const args = process.argv.slice(2);
  const meta: Meta = JSON.parse(await readFile("data/meta.json", "utf8"));
  const today = new Date().toISOString().slice(0, 10);
  let { from, until } = computeWindow(meta, today);
  const dateArg = (flag: string): string | null => {
    const i = args.indexOf(flag);
    if (i < 0) return null;
    const v = args[i + 1];
    if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) {
      console.error(`${flag} には YYYY-MM-DD 形式の日付を指定してください`);
      process.exit(1);
    }
    return v;
  };
  from = dateArg("--from") ?? from;
  until = dateArg("--until") ?? until;

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
