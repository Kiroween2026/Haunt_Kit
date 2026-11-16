import { describe, expect, it } from "vitest";
import { PACKAGE_NAME } from "./index";

describe("@haunt-kit/relay", () => {
  it("exports its package name", () => {
    expect(PACKAGE_NAME).toBe("@haunt-kit/relay");
  });
});
