"use client";

import { placeholder } from "./cover";

export function benchAria(n: number): string {
  return `Bench, ${n} ${n === 1 ? "song" : "songs"}. Tap to open.`;
}

/** Collapsed bench pill: last 3 benched covers + `Bench · {n}`; hidden at 0. */
export function BenchCluster({
  bench,
  images,
  open,
  onToggle,
}: {
  bench: string[];
  images: Record<string, string | null | undefined>;
  open: boolean;
  onToggle: () => void;
}) {
  if (bench.length === 0) return null;
  const last = bench.slice(-3);
  return (
    <button
      type="button"
      aria-label={benchAria(bench.length)}
      aria-expanded={open}
      aria-haspopup="dialog"
      data-testid="bench-cluster"
      onClick={onToggle}
      className="absolute bottom-3 right-3 z-20 flex items-center gap-2 rounded-full bg-s2 py-1 pl-1 pr-3 text-xs font-semibold"
    >
      <span className="flex -space-x-3">
        {last.map((u) => (
          <span
            key={u}
            className="h-7 w-7 overflow-hidden rounded-full ring-2 ring-[#7a7a7a]"
            style={{ background: placeholder(u) }}
          >
            {images[u] ? (
              // eslint-disable-next-line @next/next/no-img-element -- Spotify CDN art, sized by CSS
              <img src={images[u]} alt="" className="h-full w-full object-cover" />
            ) : null}
          </span>
        ))}
      </span>
      Bench · {bench.length}
    </button>
  );
}
