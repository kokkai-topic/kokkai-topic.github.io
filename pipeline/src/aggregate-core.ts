import type { RawMeeting } from "./api";
import { normalizeMeeting } from "./normalize";
import type { AssignmentFile, Registry, Topic } from "./types";
import { isoWeek } from "./week";

export const EXCERPT_LEN = 120;
export const MAX_SPEECHES_PER_TOPIC = 200;
export const NO_GROUP_LABEL = "政府・不明";

export interface SpeechFact {
  speechId: string;
  topicId: string;
  date: string;
  week: string;
  house: string;
  meeting: string;
  speaker: string;
  group: string;
  chars: number;
  excerpt: string;
  url: string;
}

export function buildFacts(meetings: RawMeeting[], assignmentFiles: AssignmentFile[]): SpeechFact[] {
  const topicBySpeech = new Map<string, string>();
  for (const f of assignmentFiles) {
    for (const a of f.assignments) topicBySpeech.set(a.speechId, a.topicId);
  }
  const facts: SpeechFact[] = [];
  for (const m of meetings) {
    for (const s of normalizeMeeting(m)) {
      const topicId = topicBySpeech.get(s.speechId);
      if (!topicId || topicId === "procedural") continue; // 未分類(ingest前)と議事進行は集計対象外
      facts.push({
        speechId: s.speechId,
        topicId,
        date: s.date,
        week: isoWeek(s.date),
        house: s.house,
        meeting: s.meeting,
        speaker: s.speaker,
        group: s.group ?? NO_GROUP_LABEL,
        chars: s.chars,
        excerpt: s.text.replace(/\s+/g, " ").trim().slice(0, EXCERPT_LEN),
        url: s.url,
      });
    }
  }
  return facts;
}

export interface PeriodDef {
  key: string;
  label: string;
  from?: string;
  until?: string;
  week?: string;
}

export interface TopicShare {
  id: string;
  name: string;
  chars: number;
  share: number;
}

export interface PeriodAggregate {
  key: string;
  label: string;
  totalChars: number;
  topics: TopicShare[];
  byParty: Record<string, { totalChars: number; topics: TopicShare[] }>;
}

export function topicNameResolver(registry: Registry): (id: string) => string {
  const map = new Map(registry.topics.map((t) => [t.id, t.name]));
  return (id) => (id === "other" ? "その他" : (map.get(id) ?? id));
}

function shares(facts: SpeechFact[], topicName: (id: string) => string): { totalChars: number; topics: TopicShare[] } {
  const byTopic = new Map<string, number>();
  let total = 0;
  for (const f of facts) {
    byTopic.set(f.topicId, (byTopic.get(f.topicId) ?? 0) + f.chars);
    total += f.chars;
  }
  const topics = [...byTopic.entries()]
    .map(([id, chars]) => ({ id, name: topicName(id), chars, share: total > 0 ? chars / total : 0 }))
    .sort((a, b) => b.chars - a.chars);
  return { totalChars: total, topics };
}

export function aggregatePeriod(facts: SpeechFact[], def: PeriodDef, topicName: (id: string) => string): PeriodAggregate {
  const inPeriod = facts.filter((f) =>
    def.week ? f.week === def.week : f.date >= (def.from ?? "0000-00-00") && f.date <= (def.until ?? "9999-99-99"),
  );
  const all = shares(inPeriod, topicName);
  const byParty: PeriodAggregate["byParty"] = {};
  for (const g of new Set(inPeriod.map((f) => f.group))) {
    byParty[g] = shares(
      inPeriod.filter((f) => f.group === g),
      topicName,
    );
  }
  return { key: def.key, label: def.label, totalChars: all.totalChars, topics: all.topics, byParty };
}

export interface TopicDetail {
  id: string;
  name: string;
  description: string;
  firstSeen: string;
  totalChars: number;
  sessionShare: number;
  weekly: { week: string; chars: number; share: number }[];
  topSpeakers: { speaker: string; group: string; chars: number }[];
  speeches: {
    date: string;
    house: string;
    meeting: string;
    speaker: string;
    group: string;
    chars: number;
    excerpt: string;
    url: string;
  }[];
  speechesTruncated: boolean;
}

export function buildTopicDetail(facts: SpeechFact[], topic: Topic): TopicDetail {
  const mine = facts.filter((f) => f.topicId === topic.id);
  const totalAll = facts.reduce((s, f) => s + f.chars, 0);
  const totalChars = mine.reduce((s, f) => s + f.chars, 0);

  const weeks = [...new Set(facts.map((f) => f.week))].sort();
  const weekly = weeks.map((week) => {
    const wAll = facts.filter((f) => f.week === week).reduce((s, f) => s + f.chars, 0);
    const wMine = mine.filter((f) => f.week === week).reduce((s, f) => s + f.chars, 0);
    return { week, chars: wMine, share: wAll > 0 ? wMine / wAll : 0 };
  });

  const bySpeaker = new Map<string, { speaker: string; group: string; chars: number }>();
  for (const f of mine) {
    const cur = bySpeaker.get(f.speaker) ?? { speaker: f.speaker, group: f.group, chars: 0 };
    cur.chars += f.chars;
    bySpeaker.set(f.speaker, cur);
  }
  const topSpeakers = [...bySpeaker.values()].sort((a, b) => b.chars - a.chars).slice(0, 10);

  const sorted = [...mine].sort((a, b) => b.date.localeCompare(a.date) || a.speechId.localeCompare(b.speechId));
  const speeches = sorted
    .slice(0, MAX_SPEECHES_PER_TOPIC)
    .map(({ speechId: _speechId, topicId: _topicId, week: _week, ...rest }) => rest);

  return {
    id: topic.id,
    name: topic.name,
    description: topic.description,
    firstSeen: topic.firstSeen,
    totalChars,
    sessionShare: totalAll > 0 ? totalChars / totalAll : 0,
    weekly,
    topSpeakers,
    speeches,
    speechesTruncated: sorted.length > MAX_SPEECHES_PER_TOPIC,
  };
}
