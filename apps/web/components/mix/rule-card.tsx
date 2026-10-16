"use client";

import { mixRuleCardLine } from "@rulemix/rules-engine";
import { Reorder, useDragControls } from "motion/react";
import type { KeyboardEvent } from "react";
import type { MixRuleRow } from "@/lib/db/mix-rules-repo";
import { ruleColor } from "@/lib/palette";

export function RuleCard({
  rule,
  index,
  onRemove,
  onMove,
  onDragEnd,
}: {
  rule: MixRuleRow;
  index: number;
  onRemove: (r: MixRuleRow) => void;
  onMove: (r: MixRuleRow, delta: -1 | 1) => void;
  onDragEnd?: () => void;
}) {
  const controls = useDragControls();
  const label = `#${String(index + 1).padStart(2, "0")}`;
  const line = mixRuleCardLine(rule.kind, rule.n, rule.songName ?? "Unknown song");

  function onKey(e: KeyboardEvent<HTMLButtonElement>): void {
    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      onMove(rule, e.key === "ArrowUp" ? -1 : 1);
    }
  }

  return (
    <Reorder.Item
      value={rule}
      dragListener={false}
      dragControls={controls}
      onDragEnd={() => onDragEnd?.()}
      data-testid="rule-card"
      className="mb-1.5 flex select-none items-center gap-3 rounded-lg bg-s1 p-3"
      transition={{ duration: 0.2 }}
    >
      <span className="w-[26px] font-mono text-[13px] font-bold text-mut">{label}</span>
      <span
        data-testid="rule-dot"
        className="size-2 flex-none rounded-[2px]"
        style={{ background: ruleColor(index) }}
      />
      <span className="flex-1 text-sm">{line}</span>
      <button
        type="button"
        aria-label={`Reorder ${label}`}
        className="cursor-grab touch-none p-1 text-dim"
        onPointerDown={(e) => controls.start(e)}
        onKeyDown={onKey}
      >
        <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          {[6, 10, 14].flatMap((y) =>
            [7, 13].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.5" />),
          )}
        </svg>
      </button>
      <button
        type="button"
        aria-label="Remove rule"
        className="p-1 text-lg leading-none text-dim"
        onClick={() => onRemove(rule)}
      >
        ×
      </button>
    </Reorder.Item>
  );
}
