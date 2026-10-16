import type { JSX } from "react";
import type { RuleKind } from "@rulemix/rules-engine";
import { DRAFT_DOT, NEUTRAL_DOT } from "@/lib/palette";
import { DotLine, type DotItem } from "./dot-line";

const COUNT = 12;

/** Illustrative 12-dot row showing what a Rule does. */
export function RuleIntentGraphic({
  kind,
  n,
  color = DRAFT_DOT,
}: {
  kind: RuleKind;
  n: number | null;
  color?: string;
}): JSX.Element {
  const items: DotItem[] = Array.from({ length: COUNT }, (_, i) => {
    let on = false;
    if (kind === "pin_first") on = i === 0;
    else if (kind === "every_n" && n !== null && n > 0) on = (i + 1) % (n + 1) === 0;
    else if (kind === "repeat") on = i === 3;
    const d: DotItem = { key: on ? `r${i}` : `b${i}`, color: on ? color : NEUTRAL_DOT };
    if (on && kind === "repeat" && n !== null) d.loop = n;
    return d;
  });
  const label =
    kind === "pin_first"
      ? "Pin first"
      : kind === "every_n"
        ? `Insert every ${n ?? "?"}`
        : `Repeat ${n ?? "?"} times`;
  return <DotLine items={items} maxDots={COUNT} ariaLabel={`${label} illustration`} />;
}
