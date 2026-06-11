import { describe, expect, it, vi } from "vitest";
import { fetchMeetings, type RawMeeting } from "../src/api";

function makeRes(body: unknown) {
  return { ok: true, status: 200, json: async () => body } as Response;
}

const m = (issueID: string): RawMeeting => ({
  issueID,
  session: 218,
  nameOfHouse: "衆議院",
  nameOfMeeting: "予算委員会",
  issue: "第1号",
  date: "2026-06-01",
  meetingURL: "https://kokkai.ndl.go.jp/#/detail?minId=" + issueID,
  speechRecord: [],
});

describe("fetchMeetings", () => {
  it("nextRecordPosition がなくなるまでページングして全会議を返す", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(makeRes({ numberOfRecords: 12, nextRecordPosition: 11, meetingRecord: [m("A")] }))
      .mockResolvedValueOnce(makeRes({ numberOfRecords: 12, nextRecordPosition: null, meetingRecord: [m("B")] }));
    const out: RawMeeting[] = [];
    for await (const mt of fetchMeetings("2026-06-01", "2026-06-07", fetchImpl, 0)) out.push(mt);
    expect(out.map((x) => x.issueID)).toEqual(["A", "B"]);
    expect(fetchImpl.mock.calls[0][0]).toContain("startRecord=1");
    expect(fetchImpl.mock.calls[1][0]).toContain("startRecord=11");
  });

  it("HTTPエラーで例外を投げる", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 500 } as Response);
    await expect(async () => {
      for await (const _ of fetchMeetings("2026-06-01", "2026-06-07", fetchImpl, 0)) {
        /* no-op */
      }
    }).rejects.toThrow("500");
  });
});
