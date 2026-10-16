import type { JSX, ReactNode } from "react";
import { ruleSentence, type RuleKind } from "@rulemix/rules-engine";

/** ruleSentence with N rendered via `renderN` (bold in lists, a pill in the editor). */
export function RuleSentence({
  kind,
  n,
  renderN = (v) => <b>{v}</b>,
}: {
  kind: RuleKind;
  n: number | null;
  renderN?: (n: number) => ReactNode;
}): JSX.Element {
  const text = ruleSentence(kind, n);
  if (n === null) return <>{text}</>;
  const s = String(n);
  const i = text.indexOf(` ${s} `);
  if (i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i + 1)}
      {renderN(n)}
      {text.slice(i + 1 + s.length)}
    </>
  );
}
