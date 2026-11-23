import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { Gauge } from "./Gauge";

describe("Gauge component (Circular SVG Goniometer)", () => {
  it("renders circular meter with correct live angle and target ROM", () => {
    const html = renderToString(<Gauge liveAngle={45} targetRomDeg={60} />);
    expect(html).toContain('role="meter"');
    expect(html).toContain("45°");
    expect(html).toContain("Target: 60°");
    expect(html).toContain('aria-valuenow="45"');
    expect(html).toContain('aria-valuemin="0"');
    expect(html).toContain('aria-valuemax="180"');
    expect(html).toContain('aria-valuetext="45 degrees. Target is 60 degrees."');
  });

  it("indicates when target ROM has been reached", () => {
    const htmlUnreached = renderToString(
      <Gauge liveAngle={50} targetRomDeg={60} />,
    );
    expect(htmlUnreached).not.toContain("target-reached");

    const htmlReached = renderToString(
      <Gauge liveAngle={65} targetRomDeg={60} />,
    );
    expect(htmlReached).toContain("target-reached");
    expect(htmlReached).toContain('aria-valuenow="65"');
  });

  it("safely handles boundary angles: clamps negative to 0° and excess to maxAngle", () => {
    const htmlNegative = renderToString(
      <Gauge liveAngle={-15} targetRomDeg={60} />,
    );
    expect(htmlNegative).toContain("0°");
    expect(htmlNegative).toContain('aria-valuenow="0"');

    const htmlExcess = renderToString(
      <Gauge liveAngle={210} targetRomDeg={60} maxAngle={180} />,
    );
    expect(htmlExcess).toContain("180°");
    expect(htmlExcess).toContain('aria-valuenow="180"');
  });

  it("safely handles missing, NaN, and non-finite sensor values without crashing", () => {
    const htmlNaN = renderToString(
      <Gauge liveAngle={NaN} targetRomDeg={NaN} />,
    );
    expect(htmlNaN).toContain('role="meter"');
    expect(htmlNaN).toContain("0°");
    expect(htmlNaN).not.toContain("NaN");

    const htmlUndefined = renderToString(
      <Gauge liveAngle={undefined} targetRomDeg={undefined} />,
    );
    expect(htmlUndefined).toContain("0°");
    expect(htmlUndefined).not.toContain("undefined");
  });

  it("supports custom maxAngle limits", () => {
    const html = renderToString(
      <Gauge liveAngle={90} targetRomDeg={80} maxAngle={120} />,
    );
    expect(html).toContain('aria-valuemax="120"');
    expect(html).toContain("120°");
    expect(html).toContain("60°"); // Midpoint label (120 / 2)
  });

  it("uses design-system CSS custom properties for theme compatibility", () => {
    const html = renderToString(<Gauge liveAngle={45} targetRomDeg={60} />);
    expect(html).toContain("var(--hk-color-border");
    expect(html).toContain("var(--hk-color-accent");
    expect(html).toContain("var(--hk-color-muted");
    expect(html).toContain("var(--hk-color-text");
  });

  it("supports custom ariaLabel and targetLabel for Live screen integration", () => {
    const html = renderToString(
      <Gauge
        liveAngle={40}
        targetRomDeg={80}
        ariaLabel="Angle"
        targetLabel="Aim for 80°"
      />,
    );
    expect(html).toContain('role="meter"');
    expect(html).toContain('aria-label="Angle"');
    expect(html).toContain("Aim for 80°");
  });
});
