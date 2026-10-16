"use client";

import { ruleCaption } from "@rulemix/rules-engine";
import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type JSX } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { RuleRow } from "@/lib/db/rules-repo";
import { NEUTRAL_DOT } from "@/lib/palette";
import { RuleSentence } from "./rule-sentence";

type Tab = "active" | "pinned" | "archived";
const STAGGER_S = 0.035;
const STAGGER_CAP = 10;

function filterTab(rules: RuleRow[], tab: Tab): RuleRow[] {
  if (tab === "archived") return rules.filter((r) => r.archivedAt !== null);
  if (tab === "pinned") return rules.filter((r) => r.pinned && r.archivedAt === null);
  return rules.filter((r) => r.archivedAt === null);
}

export function RulesLibrary({ initialRules }: { initialRules: RuleRow[] }): JSX.Element {
  const router = useRouter();
  const reduce = useReducedMotion();
  const [rules, setRules] = useState(initialRules);
  const [tab, setTab] = useState<Tab>("active");
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [blocked, setBlocked] = useState<{ id: string; used: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function patch(id: string, body: { pinned?: boolean; archived?: boolean }) {
    setError(null);
    const res = await fetch(`/api/rules/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) return setError("Couldn't update the rule. Try again.");
    const { rule } = (await res.json()) as { rule: RuleRow };
    setRules((rs) => rs.map((r) => (r.id === id ? rule : r)));
  }

  async function del(id: string) {
    setError(null);
    const res = await fetch(`/api/rules/${id}`, { method: "DELETE" });
    if (res.status === 204 || res.status === 404) {
      setRules((rs) => rs.filter((r) => r.id !== id));
      return;
    }
    if (res.status === 409) {
      const { usedInMixes } = (await res.json()) as { usedInMixes: number };
      setBlocked({ id, used: usedInMixes });
      return;
    }
    setError("Couldn't delete the rule. Try again.");
  }

  function askDelete(r: RuleRow) {
    if (r.usedInMixes > 0) void del(r.id);
    else setConfirmId(r.id);
  }

  const empty = (t: Tab) =>
    t === "active" && rules.length === 0 ? (
      <div className="py-16 text-center">
        <h3 className="text-lg font-bold">No rules yet</h3>
        <p className="mt-1 text-sm text-mut">Make one once and use it in any mix.</p>
      </div>
    ) : (
      <p className="py-16 text-center text-sm text-mut">No rules here.</p>
    );

  return (
    <main className="mx-auto min-h-screen max-w-md bg-bg px-5 pb-10 text-tx">
      <header className="flex items-center gap-3 py-4">
        <Link href="/mixes" aria-label="Back" className="rounded-full p-2 hover:bg-s2">
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
        <h1 className="flex-1 text-xl font-bold">Rules</h1>
        <Button asChild size="sm">
          <Link href="/rules/new">New rule</Link>
        </Button>
      </header>
      {error && (
        <p role="alert" className="mb-2 text-sm text-err">
          {error}
        </p>
      )}
      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
        <TabsList>
          <TabsTrigger value="active">Active</TabsTrigger>
          <TabsTrigger value="pinned">Pinned</TabsTrigger>
          <TabsTrigger value="archived">Archived</TabsTrigger>
        </TabsList>
        {(["active", "pinned", "archived"] as const).map((t) => {
          const list = filterTab(rules, t);
          return (
            <TabsContent key={t} value={t}>
              {list.length === 0
                ? empty(t)
                : list.map((r, i) => (
                    <motion.div
                      key={r.id}
                      data-testid="rule-row"
                      className="flex items-center gap-3 border-b border-line py-3"
                      initial={reduce ? false : { opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2, delay: Math.min(i, STAGGER_CAP) * STAGGER_S }}
                    >
                      <span
                        className="size-2.5 shrink-0 rounded-full"
                        style={{ background: NEUTRAL_DOT }}
                        aria-hidden="true"
                      />
                      <div className="min-w-0 flex-1">
                        <div data-sentence>
                          <RuleSentence kind={r.kind} n={r.n} />
                        </div>
                        <div className="mt-0.5 font-mono text-[11px] text-dim">
                          {ruleCaption(r.kind, r.n)}
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" aria-label="More">
                            ⋯
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onSelect={() => router.push(`/rules/${r.id}/edit`)}>
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onSelect={() => void patch(r.id, { pinned: !r.pinned })}
                          >
                            {r.pinned ? "Unpin" : "Pin"}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onSelect={() => void patch(r.id, { archived: r.archivedAt === null })}
                          >
                            {r.archivedAt === null ? "Archive" : "Unarchive"}
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => askDelete(r)}>Delete</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </motion.div>
                  ))}
            </TabsContent>
          );
        })}
      </Tabs>

      <AlertDialog open={confirmId !== null} onOpenChange={(o) => !o && setConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this rule?</AlertDialogTitle>
            <AlertDialogDescription>It isn&apos;t used in any mix.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const id = confirmId;
                setConfirmId(null);
                if (id) void del(id);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={blocked !== null} onOpenChange={(o) => !o && setBlocked(null)}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>
              {blocked && (blocked.used === 1 ? "Used in 1 mix" : `Used in ${blocked.used} mixes`)}
            </DialogTitle>
            <DialogDescription>
              {blocked && blocked.used === 1
                ? "Remove it from that mix to delete it, or archive it now."
                : "Remove it from those mixes to delete it, or archive it now."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setBlocked(null)}>
              Not now
            </Button>
            <Button
              onClick={() => {
                const id = blocked?.id;
                setBlocked(null);
                if (id) void patch(id, { archived: true });
              }}
            >
              Archive
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
