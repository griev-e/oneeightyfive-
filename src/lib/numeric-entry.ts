/**
 * The one-decimal weight keypad rule, shared by every surface that enters a
 * body weight (log sheet, history edit, questionnaire steps): up to three
 * integer digits, at most one decimal place, no leading "." and no second ".".
 */
export function applyWeightKey(cur: string, key: string): string {
  if (key === "del") return cur.slice(0, -1);
  if (key === "." && (cur.includes(".") || cur === "")) return cur;
  if (cur.includes(".") && cur.split(".")[1].length >= 1) return cur;
  if (!cur.includes(".") && cur.length >= 3 && key !== ".") return cur;
  return cur + key;
}
