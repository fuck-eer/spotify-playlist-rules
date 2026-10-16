"use client";

import { MAX_N, MIN_N, ruleCaption, type RuleKind } from "@rulemix/rules-engine";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type JSX } from "react";
import { RuleIntentGraphic } from "@/components/dots/rule-intent-graphic";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { RuleSentence } from "./rule-sentence";

const CHIPS: { kind: RuleKind; label: string }[] = [
  { kind: "pin_first", label: "Pin first" },
  { kind: "repeat", label: "Repeat" },
  { kind: "every_n", label: "Every N songs" },
];
const DEFAULT_N: Record<RuleKind, number | null> = { pin_first: null, every_n: 4, repeat: 2 };

export interface EditableRule {
  id: string;
  kind: RuleKind;
  n: number | null;
}

export function RuleEditor({
  rule,
  mixId,
}: {
  rule: EditableRule | null;
  mixId: string | null;
}): JSX.Element {
  const router = useRouter();
  const [kind, setKind] = useState<RuleKind>(rule?.kind ?? "every_n");
  const [n, setN] = useState<number | null>(rule ? rule.n : DEFAULT_N.every_n);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function pick(k: RuleKind) {
    if (k === kind) return;
    setKind(k);
    setN(rule && rule.kind === k ? rule.n : DEFAULT_N[k]);
  }
  const step = (d: number) =>
    setN((v) => (v === null ? v : Math.min(MAX_N, Math.max(MIN_N, v + d))));

  async function save(addToMix: boolean) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(rule ? `/api/rules/${rule.id}` : "/api/rules", {
        method: rule ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind, n }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const { rule: saved } = (await res.json()) as { rule: { id: string } };
      router.push(addToMix && mixId ? `/mixes/${mixId}?addRule=${saved.id}` : "/rules");
      router.refresh();
    } catch {
      setError("Couldn't save the rule. Try again.");
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col bg-bg px-5 pb-6 text-tx">
      <header className="flex items-center gap-3 py-4">
        <Link href="/rules" aria-label="Back" className="rounded-full p-2 hover:bg-s2">
          <svg
            viewBox="0 0 20 20"
            width="20"
            height="20"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <path d="M12 4l-6 6 6 6" />
          </svg>
        </Link>
        <h1 className="text-xl font-bold">{rule ? "Edit rule" : "New rule"}</h1>
      </header>
      <div className="flex-1">
        <div className="rounded-xl bg-s1 p-4">
          <RuleIntentGraphic kind={kind} n={n} />
          <p className="mt-3 font-mono text-xs text-dim">{ruleCaption(kind, n)}</p>
        </div>
        <div className="mt-4 flex gap-2">
          {CHIPS.map((c) => (
            <button
              key={c.kind}
              type="button"
              aria-pressed={kind === c.kind}
              onClick={() => pick(c.kind)}
              className={cn(
                "rounded-full border bg-s2 px-3.5 py-2 text-[13px]",
                kind === c.kind ? "border-white" : "border-transparent",
              )}
            >
              {c.label}
            </button>
          ))}
        </div>
        <div className="mt-6 flex flex-wrap items-center gap-2 text-2xl font-bold leading-snug">
          <span data-testid="rule-sentence">
            <RuleSentence
              kind={kind}
              n={n}
              renderN={(v) => (
                <span className="inline-block rounded-full bg-s3 px-3 tabular-nums">{v}</span>
              )}
            />
          </span>
          {n !== null && (
            <span className="inline-flex gap-1">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                aria-label="Decrease N"
                disabled={n <= MIN_N}
                onClick={() => step(-1)}
              >
                −
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                aria-label="Increase N"
                disabled={n >= MAX_N}
                onClick={() => step(1)}
              >
                +
              </Button>
            </span>
          )}
        </div>
        <p className="mt-4 text-sm text-mut">You pick the song when you add this rule to a mix.</p>
        {error && (
          <p role="alert" className="mt-3 text-sm text-err">
            {error}
          </p>
        )}
      </div>
      <div className="flex flex-col gap-2">
        {mixId && (
          <Button type="button" disabled={busy} onClick={() => void save(true)}>
            Save &amp; add to mix
          </Button>
        )}
        <Button
          type="button"
          variant={mixId ? "secondary" : "default"}
          disabled={busy}
          onClick={() => void save(false)}
        >
          Save rule
        </Button>
      </div>
    </main>
  );
}
