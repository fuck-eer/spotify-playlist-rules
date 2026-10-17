import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { SignIn } from "./sign-in";

afterEach(cleanup);

describe("SignIn", () => {
  it("shows logo, tagline, Spotify button and dev-mode note", () => {
    render(<SignIn error={null} />);
    expect(screen.getByText("rulemix")).toBeTruthy();
    expect(screen.getByText("Your playlist, your order. Spotify just plays it.")).toBeTruthy();
    const btn = screen.getByRole("link", { name: "Continue with Spotify" });
    expect(btn.getAttribute("href")).toBe("/api/auth/login");
    expect(
      screen.getByText("Dev mode: access is limited to the owner and 4 friends."),
    ).toBeTruthy();
    expect(screen.queryByText("Sign-in didn't finish. Try again.")).toBeNull();
  });

  it("links to the Android APK", () => {
    render(<SignIn error={null} />);
    const a = screen.getByRole("link", { name: "Get the Android app" });
    expect(a.getAttribute("href")).toBe("/android/rulemix.apk");
    expect(a.hasAttribute("download")).toBe(true);
  });

  it("shows the retry message after a failed sign-in", () => {
    render(<SignIn error="denied" />);
    expect(screen.getByText("Sign-in didn't finish. Try again.")).toBeTruthy();
  });
});
