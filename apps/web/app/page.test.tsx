import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import Page from "./page";

afterEach(cleanup);

describe("home page", () => {
  it("shows the rulemix wordmark", () => {
    render(<Page />);
    expect(screen.getByText("rulemix")).toBeTruthy();
  });
});
