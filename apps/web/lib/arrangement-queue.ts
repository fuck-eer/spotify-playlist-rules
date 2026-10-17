import { applyDraft, type SaveResult } from "./arrangement-client";
import type { ArrangementDraft } from "./arrangement-ops";
import type { MixState } from "./mix-state";

export type CommitResult =
  | { ok: true }
  | { ok: false; conflict: true }
  | { ok: false; error: string }
  | { ok: false; cancelled: true };

/**
 * Arrangement saves for one Mix, one at a time (S1). Each edit applies optimistically; each
 * PUT carries the version returned by the previous one, so rapid edits on this device never
 * look like a cross-device conflict. A failure restores the last confirmed state and drops
 * edits queued behind it (their drafts contain the failed edit).
 */
export class ArrangementQueue {
  private chain: Promise<unknown> = Promise.resolve();
  private pending = 0;
  private epoch = 0;
  private confirmed: MixState | null = null;

  constructor(
    readonly options: {
      get: () => MixState | null;
      set: (s: MixState) => void;
      save: (version: number, draft: ArrangementDraft) => Promise<SaveResult>;
    },
  ) {}

  get busy(): boolean {
    return this.pending > 0;
  }

  commit(next: ArrangementDraft): Promise<CommitResult> {
    const s = this.options.get();
    if (!s) return Promise.resolve({ ok: false, cancelled: true });
    if (this.pending === 0) this.confirmed = s;
    this.options.set(applyDraft(s, next));
    this.pending++;
    const mine = this.epoch;
    const run = this.chain.then(async (): Promise<CommitResult> => {
      if (mine !== this.epoch || !this.confirmed) return { ok: false, cancelled: true };
      const base = this.confirmed;
      const r = await this.options.save(base.arrangement.version, next);
      if (r.ok) {
        const done = applyDraft(base, next);
        this.confirmed = { ...done, arrangement: { ...done.arrangement, version: r.version } };
        const cur = this.options.get() ?? done;
        this.options.set({ ...cur, arrangement: { ...cur.arrangement, version: r.version } });
        return { ok: true };
      }
      this.epoch++;
      if (r.conflict) {
        this.confirmed = r.state;
        this.options.set(r.state);
        return { ok: false, conflict: true };
      }
      this.options.set(base);
      return { ok: false, error: r.message };
    });
    this.chain = run.finally(() => this.pending--).catch(() => undefined);
    return run;
  }
}
