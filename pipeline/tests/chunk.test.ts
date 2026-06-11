import { describe, expect, it } from "vitest";
import { chunkSpeeches } from "../src/chunk";
import type { SpeechRecord } from "../src/types";

function speech(id: string, chars: number): SpeechRecord {
  return {
    speechId: id,
    issueId: "X",
    date: "2026-06-01",
    house: "衆議院",
    meeting: "予算委員会",
    speaker: "A",
    group: null,
    position: null,
    chars,
    text: "x".repeat(chars),
    url: "u",
    procedural: false,
  };
}

describe("chunkSpeeches", () => {
  it("上限文字数を超えるところで分割する", () => {
    const chunks = chunkSpeeches([speech("a", 30000), speech("b", 30000), speech("c", 30000)], 60000);
    expect(chunks.map((c) => c.map((s) => s.speechId))).toEqual([["a", "b"], ["c"]]);
  });

  it("単体で上限を超える発言も1チャンクとして通す", () => {
    const chunks = chunkSpeeches([speech("a", 70000)], 60000);
    expect(chunks).toHaveLength(1);
  });

  it("空入力は空配列", () => {
    expect(chunkSpeeches([], 60000)).toEqual([]);
  });
});
