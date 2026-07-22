/** The four-field macro shape every food row shares (logs, meals, day sums). */
export type MacroTotals = {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
};

export function sumMacros(rows: readonly MacroTotals[]): MacroTotals {
  const total = { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 };
  for (const row of rows) {
    total.calories += row.calories;
    total.proteinG += row.proteinG;
    total.carbsG += row.carbsG;
    total.fatG += row.fatG;
  }
  return total;
}
