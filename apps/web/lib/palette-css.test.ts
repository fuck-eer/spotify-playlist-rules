import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { RULE_COLORS } from "./palette";

describe("globals.css palette", () => {
  it("mirrors RULE_COLORS as --color-r1..r10", () => {
    const css = readFileSync(fileURLToPath(new URL("../app/globals.css", import.meta.url)), "utf8");
    RULE_COLORS.forEach((c, i) => expect(css).toContain(`--color-r${i + 1}: ${c};`));
  });
});
