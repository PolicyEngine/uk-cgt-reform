import { describe, expect, test } from "bun:test";
import { getTickDecimals, getZeroBasedTicks } from "./chartUtils";
import { formatSignedBn } from "./formatters";

describe("zero-based ticks", () => {
  test("an all-negative series runs from a round tick below it up to £0", () => {
    // The 2.5 elasticity run's five years.
    const { ticks, domain } = getZeroBasedTicks([-5.31, -5.48, -5.66, -5.85, -6.05]);
    expect(domain[1]).toBe(0);
    expect(domain[0]).toBeLessThanOrEqual(-6.05);
    expect(ticks).toContain(0);
    const labels = ticks.map((tick) => formatSignedBn(tick, getTickDecimals(ticks)));
    expect(new Set(labels).size).toBe(labels.length);
  });

  test("an all-positive series starts at £0", () => {
    expect(getZeroBasedTicks([10.8, 11.2, 11.9]).domain[0]).toBe(0);
  });

  test("a mixed series spans both signs and keeps £0", () => {
    const { ticks, domain } = getZeroBasedTicks([-0.8, 27]);
    expect(domain[0]).toBeLessThanOrEqual(-0.8);
    expect(domain[1]).toBeGreaterThanOrEqual(27);
    expect(ticks).toContain(0);
  });

  test("tick decimals are the fewest that keep every label distinct", () => {
    expect(getTickDecimals([-10, -5, 0])).toBe(0);
    expect(getTickDecimals([-7.5, -5, -2.5, 0])).toBe(1);
    expect(getTickDecimals([0, 0.25, 0.5])).toBe(2);
  });
});
