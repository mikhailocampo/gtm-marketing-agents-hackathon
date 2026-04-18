export type YM = { year: number; month: number }; // month 0-indexed

export function isoDate(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function parseIso(date: string): { y: number; m: number; d: number } {
  const [y, m, d] = date.split("-").map(Number);
  return { y, m: m - 1, d };
}

export function daysInMonth(ym: YM): number {
  return new Date(ym.year, ym.month + 1, 0).getDate();
}

// Grid starts on Monday. Returns array of 42 ISO date strings.
export function monthGridDates(ym: YM): {
  date: string;
  inMonth: boolean;
}[] {
  const first = new Date(ym.year, ym.month, 1);
  // 0=Sun..6=Sat; convert so Monday=0
  const dayOfWeek = (first.getDay() + 6) % 7;
  const start = new Date(ym.year, ym.month, 1 - dayOfWeek);
  const out: { date: string; inMonth: boolean }[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    out.push({
      date: isoDate(d.getFullYear(), d.getMonth(), d.getDate()),
      inMonth: d.getMonth() === ym.month,
    });
  }
  return out;
}

export function monthLabel(ym: YM): string {
  return new Date(ym.year, ym.month, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

export function formatDay(iso: string): string {
  const { y, m, d } = parseIso(iso);
  return new Date(y, m, d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function isToday(date: string): boolean {
  const now = new Date();
  return date === isoDate(now.getFullYear(), now.getMonth(), now.getDate());
}
