"use client";

import { ruleCaption } from "@rulemix/rules-engine";
import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { RuleSentence } from "@/components/rules/rule-sentence";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import type { RuleRow } from "@/lib/db/rules-repo";
import { NEUTRAL_DOT } from "@/lib/palette";

export interface RulesState {
  status: "idle" | "loading" | "ready" | "error";
  rules: RuleRow[];
}

export function RulePickerSheet({
  open,
  onOpenChange,
  state,
  mixId,
  onPick,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  state: RulesState;
  mixId: string;
  onPick: (r: RuleRow) => void;
}) {
  const reduce = useReducedMotion();
  const active = state.rules.filter((r) => r.archivedAt === null);
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="max-h-[80vh] overflow-y-auto rounded-t-2xl border-0 bg-s2 p-5"
      >
        <SheetTitle className="text-lg">Add a rule</SheetTitle>
        <SheetDescription className="sr-only">Pick a rule from your library.</SheetDescription>
        <div className="mt-2 flex flex-col">
          {state.status === "loading" || state.status === "idle"
            ? [0, 1, 2].map((i) => <Skeleton key={i} className="my-2 h-12 w-full" />)
            : null}
          {state.status === "error" ? (
            <p role="alert" className="py-4 text-sm text-err">
              Couldn&apos;t load your rules. Try again.
            </p>
          ) : null}
          {state.status === "ready"
            ? active.map((r, i) => (
                <motion.button
                  key={r.id}
                  type="button"
                  onClick={() => onPick(r)}
                  initial={reduce ? false : { opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: reduce ? 0 : i * 0.03 }}
                  className="flex items-center gap-3 border-b border-[#222] py-3 text-left"
                >
                  <span
                    className="size-2 flex-none rounded-[2px]"
                    style={{ background: NEUTRAL_DOT }}
                  />
                  <span className="flex-1">
                    <span className="block text-sm">
                      <RuleSentence kind={r.kind} n={r.n} />
                    </span>
                    <span className="mt-0.5 block font-mono text-[11px] text-dim">
                      {ruleCaption(r.kind, r.n)}
                    </span>
                  </span>
                </motion.button>
              ))
            : null}
          <Link
            href={`/rules/new?mix=${mixId}`}
            className="mt-3 rounded-full border border-[#555] px-5 py-3 text-center text-[15px] font-bold"
          >
            New rule
          </Link>
        </div>
      </SheetContent>
    </Sheet>
  );
}
