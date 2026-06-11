import { describe, expect, it } from "vitest";
import { ingestBatch } from "../src/ingest-core";
import type { BatchInput, BatchOutput, Registry } from "../src/types";

const input: BatchInput = {
  batchId: "X-00",
  issueId: "X",
  date: "2026-06-01",
  house: "衆議院",
  meeting: "予算委員会",
  speeches: [
    { id: "s2", speaker: "佐藤花子", position: null, group: "立憲民主党", chars: 120, text: "..." },
    { id: "s3", speaker: "鈴木一郎", position: "財務大臣", group: null, chars: 210, text: "..." },
  ],
};

const emptyRegistry: Registry = { nextId: 1, topics: [] };

describe("ingestBatch", () => {
  it("新規トピックを採番して割当を解決する", () => {
    const output: BatchOutput = {
      batchId: "X-00",
      assignments: [
        { speechId: "s2", topicId: "new:1" },
        { speechId: "s3", topicId: "new:1" },
      ],
      newTopics: [{ tempId: "new:1", name: "ガソリン税・暫定税率", description: "ガソリン税の暫定税率廃止を巡る議論" }],
    };
    const r = ingestBatch(emptyRegistry, input, output, "2026-06-01");
    expect(r.errors).toEqual([]);
    expect(r.registry.topics).toHaveLength(1);
    expect(r.registry.topics[0]).toMatchObject({ id: "t0001", name: "ガソリン税・暫定税率", firstSeen: "2026-06-01" });
    expect(r.registry.nextId).toBe(2);
    expect(r.assignments).toEqual([
      { speechId: "s2", topicId: "t0001" },
      { speechId: "s3", topicId: "t0001" },
    ]);
  });

  it("同名の新規提案は既存トピックに名寄せする", () => {
    const registry: Registry = {
      nextId: 2,
      topics: [{ id: "t0001", name: "ガソリン税・暫定税率", description: "既存", firstSeen: "2026-05-01" }],
    };
    const output: BatchOutput = {
      batchId: "X-00",
      assignments: [
        { speechId: "s2", topicId: "new:1" },
        { speechId: "s3", topicId: "other" },
      ],
      newTopics: [{ tempId: "new:1", name: "ガソリン税・暫定税率", description: "重複提案" }],
    };
    const r = ingestBatch(registry, input, output, "2026-06-01");
    expect(r.errors).toEqual([]);
    expect(r.registry.topics).toHaveLength(1);
    expect(r.assignments[0].topicId).toBe("t0001");
    expect(r.added).toEqual([]);
  });

  it("割当の欠落・重複・未知IDをエラーにする", () => {
    const output: BatchOutput = {
      batchId: "X-00",
      assignments: [
        { speechId: "s2", topicId: "t9999" },
        { speechId: "s2", topicId: "other" },
      ],
      newTopics: [],
    };
    const r = ingestBatch(emptyRegistry, input, output, "2026-06-01");
    expect(r.errors.join("\n")).toContain("duplicate speechId: s2");
    expect(r.errors.join("\n")).toContain("missing assignment for: s3");
    expect(r.errors.join("\n")).toContain("unknown topicId: t9999");
  });
});
