import { RULE_COLORS } from "@/lib/palette";

/** 2×2 colour tile used as a Mix or Source cover (mockup `.cover`). */
export function CoverTile({ seed, imageUrl }: { seed: string; imageUrl?: string | null }) {
  if (imageUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={imageUrl} alt="" className="size-14 flex-none rounded object-cover" />;
  }
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return (
    <div className="grid size-14 flex-none grid-cols-2 overflow-hidden rounded" aria-hidden="true">
      {[0, 1, 2, 3].map((i) => (
        <i key={i} className="block" style={{ background: RULE_COLORS[(h + i * 3) % RULE_COLORS.length] }} />
      ))}
    </div>
  );
}
