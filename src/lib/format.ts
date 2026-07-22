export function formatInt(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}

/** 125.8 — one decimal, no trailing .0 stripped (steady width for tabular nums) */
export function formatWeight(lbs: number): string {
  return lbs.toFixed(1);
}

/** +0.55 / −0.20, always signed */
export function formatPace(lbsPerWeek: number): string {
  const sign = lbsPerWeek >= 0 ? "+" : "−";
  return `${sign}${Math.abs(lbsPerWeek).toFixed(2)}`;
}

/** 1:07 PM — the time a food log landed, for list subtitles */
export function formatLogTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}
