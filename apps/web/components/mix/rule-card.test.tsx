import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Reorder } from "motion/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { MixRuleRow } from "@/lib/db/mix-rules-repo";
import { RuleCard } from "./rule-card";

afterEach(cleanup);

const rule: MixRuleRow = {
  id: "mr1",
  ruleId: "r1",
  kind: "repeat",
  n: 3,
  position: 0,
  trackUri: "spotify:track:drift",
  songName: "Drift",
};

function renderCard(index: number, onRemove = vi.fn()) {
  render(
    <Reorder.Group axis="y" values={[rule]} onReorder={() => {}}>
      <RuleCard rule={rule} index={index} onRemove={onRemove} onMove={() => {}} />
    </Reorder.Group>,
  );
}

describe("RuleCard", () => {
  it("card 0 is #01 in R1", () => {
    renderCard(0);
    expect(screen.getByText("#01")).toBeTruthy();
    expect(screen.getByTestId("rule-dot").style.background).toBe("rgb(232, 176, 75)");
    expect(screen.getByText("Repeat · Drift · 3×")).toBeTruthy();
  });

  it("card 9 is #10 in R10", () => {
    renderCard(9);
    expect(screen.getByText("#10")).toBeTruthy();
    expect(screen.getByTestId("rule-dot").style.background).toBe("rgb(200, 176, 138)");
  });

  it("remove calls back", () => {
    const onRemove = vi.fn();
    renderCard(0, onRemove);
    fireEvent.click(screen.getByRole("button", { name: "Remove rule" }));
    expect(onRemove).toHaveBeenCalledWith(rule);
  });
});
