import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RuleEditor } from "./rule-editor";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  push.mockReset();
});

const sentence = () => screen.getByTestId("rule-sentence").textContent;

describe("RuleEditor", () => {
  it("switching chips updates the sentence, with default N per kind", () => {
    render(<RuleEditor rule={null} mixId={null} />);
    expect(sentence()).toBe("Play a song after every 4 songs");
    fireEvent.click(screen.getByRole("button", { name: "Repeat" }));
    expect(sentence()).toBe("Play a song 2 times in a row");
    fireEvent.click(screen.getByRole("button", { name: "Pin first" }));
    expect(sentence()).toBe("Play a song first");
    expect(screen.queryByRole("button", { name: "Increase N" })).toBeNull();
    expect(screen.getByText("#01 · this song leads the mix")).toBeTruthy();
  });

  it("clamps the steppers to 2–10", () => {
    render(<RuleEditor rule={null} mixId={null} />);
    const plus = screen.getByRole("button", { name: "Increase N" });
    for (let i = 0; i < 10; i++) fireEvent.click(plus);
    expect(sentence()).toBe("Play a song after every 10 songs");
    expect((plus as HTMLButtonElement).disabled).toBe(true);
    const minus = screen.getByRole("button", { name: "Decrease N" });
    for (let i = 0; i < 12; i++) fireEvent.click(minus);
    expect(sentence()).toBe("Play a song after every 2 songs");
    expect((minus as HTMLButtonElement).disabled).toBe(true);
  });

  it("shows Save & add to mix only with a mix id", () => {
    render(<RuleEditor rule={null} mixId={null} />);
    expect(screen.queryByRole("button", { name: "Save & add to mix" })).toBeNull();
    cleanup();
    render(<RuleEditor rule={null} mixId="m1" />);
    expect(screen.getByRole("button", { name: "Save & add to mix" })).toBeTruthy();
  });

  it("Save rule posts a song-less rule and returns to /rules", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(Response.json({ rule: { id: "r1" } }, { status: 201 }));
    render(<RuleEditor rule={null} mixId={null} />);
    fireEvent.click(screen.getByRole("button", { name: "Save rule" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/rules"));
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("/api/rules");
    expect(JSON.parse(init?.body as string)).toEqual({ kind: "every_n", n: 4 });
  });

  it("Save & add to mix navigates to the mix with addRule", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({ rule: { id: "r9" } }, { status: 201 }),
    );
    render(<RuleEditor rule={null} mixId="m1" />);
    fireEvent.click(screen.getByRole("button", { name: "Save & add to mix" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/mixes/m1?addRule=r9"));
  });

  it("editing PATCHes the existing rule", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(Response.json({ rule: { id: "r2" } }));
    render(<RuleEditor rule={{ id: "r2", kind: "repeat", n: 3 }} mixId={null} />);
    expect(screen.getByRole("heading", { name: "Edit rule" })).toBeTruthy();
    expect(sentence()).toBe("Play a song 3 times in a row");
    fireEvent.click(screen.getByRole("button", { name: "Save rule" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/rules"));
    expect(fetchMock.mock.calls[0]![0]).toBe("/api/rules/r2");
    expect(fetchMock.mock.calls[0]![1]?.method).toBe("PATCH");
  });
});
