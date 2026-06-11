import { describe, expect, it } from "vitest";
import { countChars, normalizeMeeting } from "../src/normalize";
import { makeMeeting } from "./fixtures/meeting";

describe("countChars", () => {
  it("空白・改行を除いて数える", () => {
    expect(countChars("あい う\nえ\tお")).toBe(5);
  });

  it("全角スペース（U+3000）も除いて数える", () => {
    expect(countChars("あい　うえお")).toBe(5);
  });
});

describe("normalizeMeeting", () => {
  const records = normalizeMeeting(makeMeeting());

  it("speechOrder=0 のヘッダを除外する", () => {
    expect(records.map((r) => r.speechId)).toEqual(["s1", "s2", "s3"]);
  });

  it("50文字以下を議事進行と判定する", () => {
    expect(records[0].procedural).toBe(true); // 委員長の開会宣言
    expect(records[1].procedural).toBe(false);
    expect(records[2].procedural).toBe(false);
  });

  it("50文字ちょうどは議事進行、51文字は議事進行でない（境界）", () => {
    const boundary = normalizeMeeting(
      makeMeeting({
        speechRecord: [
          { speechID: "b1", speechOrder: 1, speaker: "X", speakerGroup: null, speakerPosition: null, speakerRole: null, speech: "あ".repeat(50), speechURL: "u1" },
          { speechID: "b2", speechOrder: 2, speaker: "X", speakerGroup: null, speakerPosition: null, speakerRole: null, speech: "あ".repeat(51), speechURL: "u2" },
        ],
      }),
    );
    expect(boundary[0].procedural).toBe(true);
    expect(boundary[1].procedural).toBe(false);
  });

  it("会議メタデータと会派を引き継ぐ", () => {
    expect(records[1]).toMatchObject({
      issueId: "100000000X00120260601",
      date: "2026-06-01",
      house: "衆議院",
      meeting: "予算委員会",
      speaker: "佐藤花子",
      group: "立憲民主党",
      chars: 126, // 「○佐藤委員」5字＋本文21字＋「あ」100字（全角スペースは除外）
      url: "https://kokkai.ndl.go.jp/txt/100000000X00120260601/2",
    });
    expect(records[2].group).toBeNull(); // 大臣は会派なし
  });
});
