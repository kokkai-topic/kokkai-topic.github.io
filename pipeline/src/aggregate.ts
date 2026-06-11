import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import type { RawMeeting } from "./api";
import {
  MAX_SPEECHES_PER_TOPIC,
  aggregatePeriod,
  buildFacts,
  buildTopicDetail,
  topicNameResolver,
  type PeriodDef,
} from "./aggregate-core";
import type { AssignmentFile, Meta, Registry } from "./types";
import { mondayOfIsoWeek } from "./week";

async function main() {
  const meta: Meta = JSON.parse(await readFile("data/meta.json", "utf8"));
  const registry: Registry = JSON.parse(await readFile("data/topics.json", "utf8"));
  const asgFiles: AssignmentFile[] = [];
  for (const f of (await readdir("data/assignments")).filter((f) => f.endsWith(".json"))) {
    asgFiles.push(JSON.parse(await readFile(`data/assignments/${f}`, "utf8")));
  }

  const meetings: RawMeeting[] = [];
  for (const a of asgFiles) {
    try {
      meetings.push(JSON.parse(await readFile(`cache/raw/${a.issueId}.json`, "utf8")));
    } catch {
      console.error(
        `ERROR: cache/raw/${a.issueId}.json がありません。npm run fetch -- --from <日付> --until <日付> で再取得してください`,
      );
      process.exit(1);
    }
  }

  const facts = buildFacts(meetings, asgFiles);
  if (facts.length === 0) {
    console.error("集計対象の発言がありません。fetch → batch → 分類 → ingest を先に実行してください");
    process.exit(1);
  }

  const today = new Date().toISOString().slice(0, 10);
  const d30 = new Date(today + "T00:00:00Z");
  d30.setUTCDate(d30.getUTCDate() - 30);
  const weeks = [...new Set(facts.map((f) => f.week))].sort().reverse();
  const weekLabel = (w: string) => {
    const mon = mondayOfIsoWeek(w);
    return `${Number(mon.slice(5, 7))}/${Number(mon.slice(8, 10))}の週`;
  };
  const defs: PeriodDef[] = [
    { key: "session", label: "会期全体", from: meta.sessionStartDate, until: today },
    { key: "last30", label: "直近30日", from: d30.toISOString().slice(0, 10), until: today },
    ...weeks.map((w) => ({ key: w, label: weekLabel(w), week: w })),
  ];

  const name = topicNameResolver(registry);
  await rm("data/aggregates", { recursive: true, force: true });
  await mkdir("data/aggregates/periods", { recursive: true });
  for (const def of defs) {
    const agg = aggregatePeriod(facts, def, name);
    await writeFile(`data/aggregates/periods/${def.key}.json`, JSON.stringify(agg, null, 1));
  }

  const session = aggregatePeriod(facts, defs[0], name);
  const parties = Object.entries(session.byParty)
    .sort((a, b) => b[1].totalChars - a[1].totalChars)
    .map(([g]) => g);
  await writeFile(
    "data/aggregates/index.json",
    JSON.stringify(
      {
        generatedAt: today,
        sessionLabel: meta.sessionLabel,
        periods: defs.map((d) => ({ key: d.key, label: d.label })),
        parties,
      },
      null,
      1,
    ),
  );

  await rm("data/topic-details", { recursive: true, force: true });
  await mkdir("data/topic-details", { recursive: true });
  const sessionFacts = facts.filter((f) => f.date >= meta.sessionStartDate);
  let detailCount = 0;
  for (const t of registry.topics) {
    const detail = buildTopicDetail(sessionFacts, t);
    if (detail.totalChars === 0) continue;
    if (detail.speechesTruncated) {
      console.warn(`WARN: ${t.id} ${t.name}: 発言一覧を最新${MAX_SPEECHES_PER_TOPIC}件に打ち切りました`);
    }
    await writeFile(`data/topic-details/${t.id}.json`, JSON.stringify(detail, null, 1));
    detailCount++;
  }

  console.log(
    `aggregated: ${facts.length} speeches, ${detailCount} topics with data, ${defs.length} periods`,
  );
}

main();
