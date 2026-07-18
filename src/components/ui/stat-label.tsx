/** Micro-caps label over a big tabular number with an optional unit. */
export function StatLabel({
  label,
  unit,
  children,
  className,
}: {
  label: string;
  unit?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="type-label mb-1 text-text-tertiary">{label}</div>
      <div className="flex items-baseline gap-1">
        <span className="type-stat">{children}</span>
        {unit && (
          <span className="type-footnote text-text-tertiary">{unit}</span>
        )}
      </div>
    </div>
  );
}
