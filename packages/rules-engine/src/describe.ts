import type { RuleKind } from "./types.js";

/** User-facing copy for Rules (from the mockup's sentence / caption / cardLine). */
export function ruleSentence(kind: RuleKind, n: number | null): string {
  switch (kind) {
    case "pin_first":
      return "Play a song first";
    case "repeat":
      return `Play a song ${n} times in a row`;
    case "every_n":
      return `Play a song after every ${n} songs`;
  }
}

export function ruleCaption(kind: RuleKind, n: number | null): string {
  switch (kind) {
    case "pin_first":
      return "#01 · this song leads the mix";
    case "repeat":
      return `${n}× · same song, in a row`;
    case "every_n":
      return `every ${n} · lands after each ${n} songs`;
  }
}

export function mixRuleCardLine(kind: RuleKind, n: number | null, songName: string): string {
  switch (kind) {
    case "pin_first":
      return `Pin first · ${songName}`;
    case "repeat":
      return `Repeat · ${songName} · ${n}×`;
    case "every_n":
      return `Every ${n} · ${songName}`;
  }
}
