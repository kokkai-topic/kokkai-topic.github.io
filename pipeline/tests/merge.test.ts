import { describe, expect, it } from "vitest";
import { applyMergeMap } from "../src/merge-core";
import type { AssignmentFile, Registry } from "../src/types";

const registry: Registry = {
  nextId: 3,
  topics: [
    { id: "t0001", name: "ガソリン税・暫定税率", description: "a", firstSeen: "2026-05-01" },
    { id: "t0002", name: "燃料課税見直し", description: "b", firstSeen: "2026-06-01" },
  ],
};

const files: AssignmentFile[] = [
  {
    issueId: "X",
    expected: 2,
    assignments: [
      { speechId: "s1", topicId: "t0002" },
      { speechId: "s2", topicId: "t0001" },
    ],
  },
];

describe("applyMergeMap", () => {
  it("割当を書き換え、統合元を台帳から削除する", () => {
    const r = applyMergeMap(registry, files, { t0002: "t0001" });
    expect(r.errors).toEqual([]);
    expect(r.registry.topics.map((t) => t.id)).toEqual(["t0001"]);
    expect(r.files[0].assignments.map((a) => a.topicId)).toEqual(["t0001", "t0001"]);
  });

  it("不正なマップを拒否する", () => {
    expect(applyMergeMap(registry, files, { t9999: "t0001" }).errors[0]).toContain("t9999");
    expect(applyMergeMap(registry, files, { t0001: "t0001" }).errors[0]).toContain("self merge");
    const chained = applyMergeMap(
      { ...registry, topics: [...registry.topics, { id: "t0003", name: "c", description: "c", firstSeen: "2026-06-01" }] },
      files,
      { t0002: "t0003", t0003: "t0001" },
    );
    expect(chained.errors.join("\n")).toContain("merge target is itself merged: t0003");
  });
});
