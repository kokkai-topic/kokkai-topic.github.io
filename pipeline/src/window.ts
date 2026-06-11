import type { Meta } from "./types";

export function computeWindow(
  meta: Pick<Meta, "sessionStartDate" | "fetchWindowDays">,
  today: string,
): { from: string; until: string } {
  const t = new Date(today + "T00:00:00Z");
  t.setUTCDate(t.getUTCDate() - meta.fetchWindowDays);
  const lower = t.toISOString().slice(0, 10);
  const from = lower > meta.sessionStartDate ? lower : meta.sessionStartDate;
  return { from, until: today };
}
