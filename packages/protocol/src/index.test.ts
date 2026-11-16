import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { PROTOCOL_VERSION, type Sample } from "./index";

// JSON has no -0: JSON.stringify(-0) === "0". A sensor value of -0 means the same as 0,
// so the generator maps -0 to 0. Otherwise the round-trip test fails on a difference
// that does not matter for sensor data.
const num = fc.double({ noNaN: true, noDefaultInfinity: true }).map((n) => (Object.is(n, -0) ? 0 : n));

const sampleArb: fc.Arbitrary<Sample> = fc.record(
  {
    t: num,
    ax: num,
    ay: num,
    az: num,
    gx: num,
    gy: num,
    gz: num,
    alpha: num,
    beta: num,
    gamma: num,
    rms: fc.double({ min: 0, max: 1, noNaN: true }).map((n) => (Object.is(n, -0) ? 0 : n)),
  },
  { requiredKeys: ["t", "ax", "ay", "az", "gx", "gy", "gz", "alpha", "beta", "gamma"] },
);

describe("@haunt-kit/protocol", () => {
  it("is protocol version 1", () => {
    expect(PROTOCOL_VERSION).toBe(1);
  });

  it("a Sample survives a JSON round-trip", () => {
    fc.assert(
      fc.property(sampleArb, (s) => {
        expect(JSON.parse(JSON.stringify(s))).toEqual(s);
      }),
    );
  });
});
