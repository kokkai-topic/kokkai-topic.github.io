import { describe, expect, it } from "vitest";
import { aggregatePeriod, buildFacts, buildTopicDetail, topicNameResolver } from "../src/aggregate-core";
import type { AssignmentFile, Registry } from "../src/types";
import { makeMeeting } from "./fixtures/meeting";

const registry: Registry = {
  nextId: 2,
  topics: [{ id: "t0001", name: "ガソリン税・暫定税率", description: "説明", firstSeen: "2026-06-01" }],
};

const assignments: AssignmentFile[] = [
  {
    issueId: "100000000X00120260601",
    expected: 3,
    assignments: [
      { speechId: "s1", topicId: "procedural" },
      { speechId: "s2", topicId: "t0001" },
      { speechId: "s3", topicId: "t0001" },
    ],
  },
];

const facts = buildFacts([makeMeeting()], assignments);

describe("buildFacts", () => {
  it("procedural を除外し、会派 null を「政府・不明」にする", () => {
    expect(facts.map((f) => f.speechId)).toEqual(["s2", "s3"]);
    expect(facts[1].group).toBe("政府・不明");
    expect(facts[0].week).toBe("2026-W23");
  });
});

describe("aggregatePeriod", () => {
  const agg = aggregatePeriod(facts, { key: "session", label: "会期全体", from: "2026-01-01", until: "2026-12-31" }, topicNameResolver(registry));

  it("シェアの合計が1になる", () => {
    expect(agg.topics.reduce((s, t) => s + t.share, 0)).toBeCloseTo(1);
    expect(agg.topics[0]).toMatchObject({ id: "t0001", name: "ガソリン税・暫定税率" });
    expect(agg.totalChars).toBe(facts[0].chars + facts[1].chars);
  });

  it("会派別の内訳を持つ", () => {
    expect(Object.keys(agg.byParty).sort()).toEqual(["政府・不明", "立憲民主党"]);
    expect(agg.byParty["立憲民主党"].topics[0].share).toBeCloseTo(1);
  });

  it("週キー指定でフィルタできる", () => {
    const w = aggregatePeriod(facts, { key: "2026-W23", label: "6/1の週", week: "2026-W23" }, topicNameResolver(registry));
    expect(w.totalChars).toBe(agg.totalChars);
    const none = aggregatePeriod(facts, { key: "2026-W30", label: "x", week: "2026-W30" }, topicNameResolver(registry));
    expect(none.totalChars).toBe(0);
  });
});

describe("buildTopicDetail", () => {
  const detail = buildTopicDetail(facts, registry.topics[0]);

  it("週次推移・発言者・発言一覧を作る", () => {
    expect(detail.sessionShare).toBeCloseTo(1);
    expect(detail.weekly).toEqual([{ week: "2026-W23", chars: detail.totalChars, share: 1 }]);
    expect(detail.topSpeakers[0].chars).toBeGreaterThanOrEqual(detail.topSpeakers[1]?.chars ?? 0);
    expect(detail.speeches[0].url).toContain("kokkai.ndl.go.jp");
    expect(detail.speechesTruncated).toBe(false);
  });
});
