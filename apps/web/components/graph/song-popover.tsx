"use client";

import type { RuleKind } from "@rulemix/rules-engine";
import { MinusIcon, PinIcon, PlusIcon, RepeatIcon, StepForwardIcon, XIcon } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ruleColor } from "@/lib/palette";
import { placeholder } from "./cover";
import { ruleName, type TrackMeta } from "./labels";

export const MAX_RULES_COPY = (max: number) => `Up to ${max} rules per mix.`;

export interface SongRule {
  mixRuleId: string;
  index: number;
  kind: RuleKind;
  n: number | null;
}

type Stepper = { kind: "every_n" | "repeat"; n: number; replace: string | null } | null;

const STEPPER = {
  every_n: { prompt: "Every how many songs?", def: 4 },
  repeat: { prompt: "How many times?", def: 2 },
} as const;

function useIsWide(): boolean {
  const [wide, setWide] = useState(true);
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(min-width: 768px)");
    setWide(mq.matches);
    const on = () => setWide(mq.matches);
    mq.addEventListener?.("change", on);
    return () => mq.removeEventListener?.("change", on);
  }, []);
  return wide;
}

/** The song card: popover beside the cover (≥ 768 px) or a bottom sheet (interaction-spec §3). */
export function SongPopover({
  uri,
  track,
  anchor,
  shiftedFrom,
  songRules,
  ruleCount,
  maxRules,
  onAdd,
  onRemove,
  onChange,
  onClose,
  footer,
}: {
  uri: string;
  track: TrackMeta | undefined;
  anchor: HTMLElement | null;
  shiftedFrom: number | null;
  songRules: SongRule[];
  ruleCount: number;
  maxRules: number;
  onAdd: (kind: RuleKind, n: number | null) => void;
  onRemove: (mixRuleId: string) => void;
  onChange: (mixRuleId: string, kind: RuleKind, n: number) => void;
  onClose: () => void;
  footer?: ReactNode;
}) {
  const wide = useIsWide();
  const card = useRef<HTMLDivElement>(null);
  const [stepper, setStepper] = useState<Stepper>(null);
  const full = ruleCount >= maxRules;

  useEffect(() => {
    card.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const onDown = (e: PointerEvent) => {
      if (!wide) return;
      if (
        card.current &&
        !card.current.contains(e.target as Node) &&
        !anchor?.contains(e.target as Node)
      )
        onClose();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
      anchor?.focus();
    };
  }, [anchor, onClose, wide]);

  const rect = anchor?.getBoundingClientRect();
  const style: React.CSSProperties = wide
    ? {
        position: "fixed",
        top: Math.min(
          (rect?.bottom ?? 120) + 8,
          (typeof window === "undefined" ? 800 : window.innerHeight) - 360,
        ),
        left: Math.max(
          8,
          Math.min(
            (rect?.left ?? 40) - 120,
            (typeof window === "undefined" ? 1200 : window.innerWidth) - 328,
          ),
        ),
        width: 320,
      }
    : { position: "fixed", left: 0, right: 0, bottom: 0 };
  const id = uri.split(":").pop() ?? "";

  const iconBtn = (label: string, icon: ReactNode, onClick: () => void) => (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={full}
      onClick={onClick}
      className="grid size-11 place-items-center rounded-full bg-s3 text-white disabled:opacity-40"
    >
      {icon}
    </button>
  );

  return (
    <>
      {!wide ? (
        <div
          data-testid="sheet-scrim"
          className="fixed inset-0 z-40 bg-black/60"
          onClick={onClose}
        />
      ) : null}
      <div
        ref={card}
        role="dialog"
        aria-label={track?.name ?? "Song"}
        tabIndex={-1}
        data-testid="song-popover"
        className={`z-50 bg-s2 p-4 shadow-[0_16px_40px_#000b] outline-none ${wide ? "rounded-xl" : "rounded-t-2xl pb-8"}`}
        style={style}
      >
        {!wide ? <div aria-hidden className="mx-auto mb-3 h-1 w-9 rounded-full bg-[#555]" /> : null}
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            className="size-14 shrink-0 overflow-hidden rounded-full"
            style={{ background: placeholder(uri) }}
          >
            {track?.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- Spotify CDN art
              <img src={track.imageUrl} alt="" className="size-full object-cover" />
            ) : null}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">{track?.name ?? "Unknown song"}</p>
            <p className="truncate text-sm text-mut">{track?.artists.join(", ") ?? ""}</p>
            {shiftedFrom !== null ? (
              <p className="text-xs text-dim">moved from #{shiftedFrom + 1}</p>
            ) : null}
          </div>
          <button type="button" aria-label="Close" onClick={onClose} className="text-mut">
            <XIcon className="size-5" />
          </button>
        </div>
        {songRules.length > 0 ? (
          <ul className="mt-3 flex flex-col gap-1.5">
            {songRules.map((r) => (
              <li key={r.mixRuleId} className="flex items-center gap-2 text-sm">
                <span
                  className="rounded-full px-1.5 font-mono text-[10px] font-bold text-black"
                  style={{ background: ruleColor(r.index) }}
                >
                  #{r.index + 1}
                </span>
                <span className="flex-1">{ruleName(r)}</span>
                {r.kind !== "pin_first" ? (
                  <button
                    type="button"
                    className="text-xs font-semibold text-mut underline"
                    onClick={() =>
                      setStepper({
                        kind: r.kind as "every_n" | "repeat",
                        n: r.n ?? 2,
                        replace: r.mixRuleId,
                      })
                    }
                  >
                    Change
                  </button>
                ) : null}
                <button
                  type="button"
                  className="text-xs font-semibold text-mut underline"
                  onClick={() => onRemove(r.mixRuleId)}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        <div className="mt-4 flex items-center gap-3">
          {iconBtn("Start with", <PinIcon className="size-5" />, () => onAdd("pin_first", null))}
          {iconBtn("After every N", <StepForwardIcon className="size-5" />, () =>
            setStepper({ kind: "every_n", n: STEPPER.every_n.def, replace: null }),
          )}
          {iconBtn("Repeat", <RepeatIcon className="size-5" />, () =>
            setStepper({ kind: "repeat", n: STEPPER.repeat.def, replace: null }),
          )}
        </div>
        {full ? <p className="mt-2 text-xs text-dim">{MAX_RULES_COPY(maxRules)}</p> : null}
        {stepper ? (
          <div className="mt-3 flex items-center gap-2" data-testid="stepper">
            <span className="flex-1 text-sm">{STEPPER[stepper.kind].prompt}</span>
            <button
              type="button"
              aria-label="Decrease"
              disabled={stepper.n <= 2}
              onClick={() => setStepper({ ...stepper, n: stepper.n - 1 })}
              className="grid size-8 place-items-center rounded-full bg-s3 disabled:opacity-40"
            >
              <MinusIcon className="size-4" />
            </button>
            <span
              aria-live="polite"
              data-testid="stepper-value"
              className="w-6 text-center font-mono"
            >
              {stepper.n}
            </span>
            <button
              type="button"
              aria-label="Increase"
              disabled={stepper.n >= 10}
              onClick={() => setStepper({ ...stepper, n: stepper.n + 1 })}
              className="grid size-8 place-items-center rounded-full bg-s3 disabled:opacity-40"
            >
              <PlusIcon className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                if (stepper.replace) onChange(stepper.replace, stepper.kind, stepper.n);
                else onAdd(stepper.kind, stepper.n);
                setStepper(null);
              }}
              className="rounded-full bg-white px-3 py-1 text-sm font-semibold text-black"
            >
              {stepper.replace ? "Save" : "Add"}
            </button>
          </div>
        ) : null}
        <div className="mt-4 flex items-center justify-between gap-2">
          <a
            href={`https://open.spotify.com/track/${encodeURIComponent(id)}`}
            target="_blank"
            rel="noreferrer"
            className="text-sm font-semibold text-mut underline"
          >
            Open in Spotify
          </a>
          {footer}
        </div>
      </div>
    </>
  );
}

/** The `N songs skipped (unavailable)` card. */
export function UnavailableCard({ count, onClose }: { count: number; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/60" onClick={onClose} />
      <div
        role="dialog"
        aria-label="Skipped songs"
        className="fixed bottom-0 left-0 right-0 z-50 mx-auto max-w-md rounded-t-2xl bg-s2 p-4 pb-8 md:bottom-auto md:top-1/3 md:rounded-xl"
      >
        <p className="font-semibold">
          {count} {count === 1 ? "song" : "songs"} skipped (unavailable)
        </p>
        <p className="mt-2 text-sm text-mut">
          Local files, podcasts and songs Spotify can&apos;t play in your country are left out of
          the mix.
        </p>
        <button type="button" onClick={onClose} className="mt-4 text-sm font-semibold underline">
          Close
        </button>
      </div>
    </>
  );
}
