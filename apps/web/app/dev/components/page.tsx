import { notFound } from "next/navigation";
import type { JSX } from "react";
import { DotLine, type DotItem } from "@/components/dots/dot-line";
import { RuleIntentGraphic } from "@/components/dots/rule-intent-graphic";
import { NEUTRAL_DOT, RULE_COLORS, ruleColor } from "@/lib/palette";

const SAMPLE: DotItem[] = Array.from({ length: 30 }, (_, i) => {
  if (i === 0) return { key: "0", color: ruleColor(0), label: "#1" };
  if (i % 5 === 4) return { key: String(i), color: ruleColor(1), label: "#2", ...(i === 14 ? { badge: "moved from #14" } : {}) };
  if (i === 7) return { key: "7", color: ruleColor(2), label: "#3", loop: 3 };
  return { key: String(i), color: NEUTRAL_DOT };
});

export default function DevComponentsPage(): JSX.Element {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <main className="mx-auto max-w-3xl space-y-10 p-8">
      <h1 className="text-xl font-bold">Design system</h1>
      <section className="space-y-3">
        <h2 className="text-mut font-mono text-xs uppercase">Rule palette</h2>
        <div className="flex flex-wrap gap-3">
          {RULE_COLORS.map((c, i) => (
            <div key={c} className="flex flex-col items-center gap-1">
              <span className="block size-8 rounded-full" style={{ background: `var(--color-r${i + 1})` }} />
              <span className="text-dim font-mono text-[10px]">R{i + 1} {c}</span>
            </div>
          ))}
        </div>
      </section>
      <section className="space-y-3">
        <h2 className="text-mut font-mono text-xs uppercase">Preview line (30 items, 22 shown)</h2>
        <div className="bg-s1 rounded-lg p-4">
          <DotLine items={SAMPLE} ariaLabel="Sample preview" />
        </div>
      </section>
      <section className="space-y-3">
        <h2 className="text-mut font-mono text-xs uppercase">Rule intent graphics (n=4)</h2>
        {(["pin_first", "every_n", "repeat"] as const).map((k) => (
          <div key={k} className="bg-s1 rounded-lg p-4">
            <p className="text-dim mb-2 font-mono text-xs">{k}</p>
            <RuleIntentGraphic kind={k} n={k === "pin_first" ? null : 4} />
          </div>
        ))}
      </section>
    </main>
  );
}
