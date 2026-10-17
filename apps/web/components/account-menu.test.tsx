import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AccountMenu } from "./account-menu";

afterEach(cleanup);

describe("AccountMenu", () => {
  it("opens and offers Sign out, which posts to the logout route", async () => {
    render(<AccountMenu />);
    const trigger = screen.getByRole("button", { name: "Account" });
    trigger.focus();
    fireEvent.keyDown(trigger, { key: "Enter" });
    const item = await screen.findByRole("menuitem", { name: "Sign out" });
    const form = document.querySelector<HTMLFormElement>("form[action='/api/auth/logout']")!;
    expect(form.getAttribute("method")).toBe("post");
    const submit = vi.fn((e: Event) => e.preventDefault());
    form.addEventListener("submit", submit);
    fireEvent.click(item);
    expect(submit).toHaveBeenCalled();
  });

  it("offers the Android app download", async () => {
    render(<AccountMenu />);
    const trigger = screen.getByRole("button", { name: "Account" });
    trigger.focus();
    fireEvent.keyDown(trigger, { key: "Enter" });
    const item = await screen.findByRole("menuitem", { name: "Get the Android app" });
    expect(item.getAttribute("href")).toBe("/android/rulemix.apk");
  });
});
