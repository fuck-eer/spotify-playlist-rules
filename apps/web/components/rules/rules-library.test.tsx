import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { RuleRow } from "@/lib/db/rules-repo";
import { RulesLibrary } from "./rules-library";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const T = "2026-10-16T00:00:00.000Z";
function rule(id: string, over: Partial<RuleRow>): RuleRow {
  return {
    id,
    kind: "every_n",
    n: 4,
    pinned: false,
    archivedAt: null,
    usedInMixes: 0,
    createdAt: T,
    updatedAt: T,
    ...over,
  };
}
const RULES = [
  rule("a", { kind: "pin_first", n: null, pinned: true }),
  rule("b", { kind: "every_n", n: 5, usedInMixes: 2 }),
  rule("c", { kind: "repeat", n: 3, archivedAt: T }),
];
const rows = () =>
  screen.queryAllByTestId("rule-row").map((r) => r.querySelector("[data-sentence]")?.textContent);

function tab(name: string) {
  const t = screen.getByRole("tab", { name });
  fireEvent.mouseDown(t);
  fireEvent.click(t);
}
function openMenu(rowIndex: number) {
  const row = screen.getAllByTestId("rule-row")[rowIndex]!;
  const trigger = within(row).getByRole("button", { name: "More" });
  fireEvent.keyDown(trigger, { key: "Enter" });
}

describe("RulesLibrary", () => {
  it("filters by tab", () => {
    render(<RulesLibrary initialRules={RULES} />);
    expect(rows()).toEqual(["Play a song first", "Play a song after every 5 songs"]);
    tab("Pinned");
    expect(rows()).toEqual(["Play a song first"]);
    tab("Archived");
    expect(rows()).toEqual(["Play a song 3 times in a row"]);
  });

  it("shows empty states", () => {
    render(<RulesLibrary initialRules={[]} />);
    expect(screen.getByText("No rules yet")).toBeTruthy();
    expect(screen.getByText("Make one once and use it in any mix.")).toBeTruthy();
    cleanup();
    render(<RulesLibrary initialRules={[RULES[1]!]} />);
    tab("Archived");
    expect(screen.getByText("No rules here.")).toBeTruthy();
  });

  it("confirms before deleting an unused rule", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 204 }));
    render(<RulesLibrary initialRules={RULES} />);
    openMenu(0);
    fireEvent.click(await screen.findByRole("menuitem", { name: "Delete" }));
    expect(await screen.findByText("Delete this rule?")).toBeTruthy();
    expect(screen.getByText("It isn't used in any mix.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(rows()).toEqual(["Play a song after every 5 songs"]));
    expect(fetchMock.mock.calls[0]![1]?.method).toBe("DELETE");
  });

  it("shows the blocked dialog on 409 and can archive from it", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        Response.json(
          { error: { code: "rule_in_use", message: "Used in 2 mixes" }, usedInMixes: 2 },
          { status: 409 },
        ),
      )
      .mockResolvedValueOnce(Response.json({ rule: { ...RULES[1]!, archivedAt: T } }));
    render(<RulesLibrary initialRules={[{ ...RULES[1]!, usedInMixes: 0 }]} />);
    openMenu(0);
    fireEvent.click(await screen.findByRole("menuitem", { name: "Delete" }));
    fireEvent.click(await screen.findByRole("button", { name: "Delete" }));
    expect(await screen.findByText("Used in 2 mixes")).toBeTruthy();
    expect(
      screen.getByText("Remove it from those mixes to delete it, or archive it now."),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Not now" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Archive" }));
    await waitFor(() => expect(rows()).toEqual([]));
    expect(JSON.parse(fetchMock.mock.calls[1]![1]?.body as string)).toEqual({ archived: true });
  });

  it("uses singular copy for one mix", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json(
        { error: { code: "rule_in_use", message: "Used in 1 mix" }, usedInMixes: 1 },
        { status: 409 },
      ),
    );
    render(<RulesLibrary initialRules={[RULES[1]!]} />);
    openMenu(0);
    fireEvent.click(await screen.findByRole("menuitem", { name: "Delete" }));
    expect(await screen.findByText("Used in 1 mix")).toBeTruthy();
    expect(
      screen.getByText("Remove it from that mix to delete it, or archive it now."),
    ).toBeTruthy();
  });
});
