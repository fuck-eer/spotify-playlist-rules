import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { AccountMenu } from "./account-menu";

afterEach(cleanup);

describe("AccountMenu", () => {
  it("opens and offers Sign out, which posts to the logout route", async () => {
    render(<AccountMenu />);
    const trigger = screen.getByRole("button", { name: "Account" });
    trigger.focus();
    fireEvent.keyDown(trigger, { key: "Enter" });
    const item = await screen.findByRole("menuitem", { name: "Sign out" });
    const form = item.closest("form") ?? document.querySelector("form[action='/api/auth/logout']");
    expect(form?.getAttribute("action")).toBe("/api/auth/logout");
    expect(form?.getAttribute("method")).toBe("post");
  });
});
