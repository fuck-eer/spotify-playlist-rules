"use client";

import { useEffect, useRef, useState } from "react";
import { placeholder } from "./cover";

export interface BenchRow {
  uri: string;
  name: string;
  artist: string;
  imageUrl: string | null;
}

/** `On the bench` popover: rows restore at the end (Enter) or via the row menu; drag a row out to place it. */
export function BenchPanel({
  rows,
  total,
  onClose,
  onRestoreEnd,
  onRestoreSlot,
  onRowPointerDown,
}: {
  rows: BenchRow[];
  total: number;
  onClose: () => void;
  onRestoreEnd: (uri: string) => void;
  /** k = play slot 1..total+1 */
  onRestoreSlot: (uri: string, k: number) => void;
  onRowPointerDown: (uri: string, e: React.PointerEvent) => void;
}) {
  const [menu, setMenu] = useState<string | null>(null);
  const [slot, setSlot] = useState<{ value: string; error: string | null } | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        const t = e.target as HTMLElement;
        if (!t.closest?.("[data-testid=bench-cluster]")) onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onDown);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label="On the bench"
      data-testid="bench-panel"
      className="absolute bottom-14 right-3 z-50 w-72 rounded-xl bg-s2 p-3 shadow-xl"
    >
      <h3 className="text-sm font-bold">On the bench</h3>
      {rows.length === 0 ? (
        <p className="mt-2 text-xs text-t2">Nothing on the bench.</p>
      ) : (
        <>
          <p className="mt-1 text-xs text-t2">Drag a song onto the line to bring it back.</p>
          <ul className="mt-2 flex max-h-64 flex-col gap-1 overflow-auto">
            {rows.map((r) => (
              <li key={r.uri}>
                <button
                  type="button"
                  aria-haspopup="menu"
                  aria-expanded={menu === r.uri}
                  aria-label={`${r.name}, ${r.artist}`}
                  style={{ touchAction: "none" }}
                  onPointerDown={(e) => onRowPointerDown(r.uri, e)}
                  onClick={() => {
                    setMenu(menu === r.uri ? null : r.uri);
                    setSlot(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      onRestoreEnd(r.uri);
                    } else if (e.key === " ") {
                      e.preventDefault();
                      setMenu(menu === r.uri ? null : r.uri);
                    }
                  }}
                  className="flex w-full items-center gap-2 rounded-lg p-1 text-left hover:bg-s1"
                >
                  <span
                    className="h-9 w-9 shrink-0 overflow-hidden rounded ring-2 ring-[#7a7a7a]"
                    style={{ background: placeholder(r.uri) }}
                  >
                    {r.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- Spotify CDN art, sized by CSS
                      <img src={r.imageUrl} alt="" className="h-full w-full object-cover" />
                    ) : null}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm">{r.name}</span>
                    <span className="block truncate text-xs text-t2">{r.artist}</span>
                  </span>
                </button>
                {menu === r.uri ? (
                  <div role="menu" className="ml-11 mt-1 flex flex-col gap-1 text-sm">
                    <button
                      type="button"
                      role="menuitem"
                      className="text-left"
                      onClick={() => setSlot({ value: "", error: null })}
                    >
                      Put back at slot…
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      className="text-left"
                      onClick={() => onRestoreEnd(r.uri)}
                    >
                      Put back at the end
                    </button>
                    {slot ? (
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          const k = Number(slot.value);
                          if (!Number.isInteger(k) || k < 1 || k > total + 1) {
                            setSlot({ ...slot, error: `Pick a slot from 1 to ${total}.` });
                            return;
                          }
                          onRestoreSlot(r.uri, k);
                        }}
                      >
                        <input
                          aria-label="Slot number"
                          inputMode="numeric"
                          autoFocus
                          value={slot.value}
                          onChange={(e) => setSlot({ value: e.target.value, error: null })}
                          className="w-20 rounded bg-s1 px-2 py-1 text-sm"
                        />
                        {slot.error ? (
                          <span role="alert" className="ml-2 text-xs text-err">
                            {slot.error}
                          </span>
                        ) : null}
                      </form>
                    ) : null}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
