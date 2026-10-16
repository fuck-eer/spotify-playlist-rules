const CELL = 9;
const GAP = 3;
const SIZE = CELL * 3 + GAP * 2;

/** rulemix mark: a white 3×3 tile grid followed by the lowercase wordmark. */
export function Logo({ className }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-3 ${className ?? ""}`}>
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden="true">
        {Array.from({ length: 9 }, (_, i) => (
          <rect
            key={i}
            x={(i % 3) * (CELL + GAP)}
            y={Math.floor(i / 3) * (CELL + GAP)}
            width={CELL}
            height={CELL}
            rx={2}
            fill="#fff"
          />
        ))}
      </svg>
      <span className="font-mono text-3xl font-bold tracking-tight">rulemix</span>
    </span>
  );
}
