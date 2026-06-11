export function isoWeek(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00Z");
  const day = (d.getUTCDay() + 6) % 7; // 月曜=0
  d.setUTCDate(d.getUTCDate() - day + 3); // この週の木曜日
  const isoYear = d.getUTCFullYear();
  const jan4 = new Date(Date.UTC(isoYear, 0, 4));
  const jan4Day = (jan4.getUTCDay() + 6) % 7;
  const week1Thu = new Date(Date.UTC(isoYear, 0, 4 - jan4Day + 3));
  const week = 1 + Math.round((d.getTime() - week1Thu.getTime()) / (7 * 86400000));
  return `${isoYear}-W${String(week).padStart(2, "0")}`;
}

export function mondayOfIsoWeek(weekKey: string): string {
  const [y, w] = weekKey.split("-W").map(Number);
  const jan4 = new Date(Date.UTC(y, 0, 4));
  const jan4Day = (jan4.getUTCDay() + 6) % 7;
  const monday = new Date(Date.UTC(y, 0, 4 - jan4Day + (w - 1) * 7));
  return monday.toISOString().slice(0, 10);
}
