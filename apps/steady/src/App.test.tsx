import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { App } from "./App";

describe("Steady App", () => {
  it("renders the title", () => {
    expect(renderToString(<App />)).toContain("Steady");
  });
});
