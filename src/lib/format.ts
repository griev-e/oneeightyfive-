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
