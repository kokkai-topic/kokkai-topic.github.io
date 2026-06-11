import { describe, expect, it } from "vitest";
import { isoWeek, mondayOfIsoWeek } from "../src/week";

describe("isoWeek", () => {
  it("年初・年末の境界を正しく扱う", () => {
    expect(isoWeek("2026-06-11")).toBe("2026-W24");
    expect(isoWeek("2025-12-29")).toBe("2026-W01"); // 月曜・翌年のW01に属する
    expect(isoWeek("2026-01-04")).toBe("2026-W01");
    expect(isoWeek("2025-12-28")).toBe("2025-W52");
  });

  it("53週ある年（2026年）のW53を正しく扱う", () => {
    expect(isoWeek("2026-12-31")).toBe("2026-W53");
  });
});

describe("mondayOfIsoWeek", () => {
  it("週キーから月曜日の日付を返す", () => {
    expect(mondayOfIsoWeek("2026-W24")).toBe("2026-06-08");
    expect(mondayOfIsoWeek("2026-W01")).toBe("2025-12-29");
    expect(mondayOfIsoWeek("2026-W53")).toBe("2026-12-28");
  });
});
