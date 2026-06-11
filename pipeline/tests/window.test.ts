import { describe, expect, it } from "vitest";
import { computeWindow } from "../src/window";

const meta = { sessionStartDate: "2026-01-26", fetchWindowDays: 45 };

describe("computeWindow", () => {
  it("今日から45日前を下限にする", () => {
    expect(computeWindow(meta, "2026-06-11")).toEqual({ from: "2026-04-27", until: "2026-06-11" });
  });

  it("会期開始日より前には遡らない", () => {
    expect(computeWindow(meta, "2026-02-01")).toEqual({ from: "2026-01-26", until: "2026-02-01" });
  });
});
