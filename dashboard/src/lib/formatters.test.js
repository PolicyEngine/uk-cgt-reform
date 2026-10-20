import { describe, expect, test } from "bun:test";
import {
  formatBn,
  formatCount,
  formatCurrency,
  formatMn,
  formatPct,
  formatPublished,
  formatSignedBn,
  formatSignedCurrency,
  formatSignedMn,
  formatSignedPct,
  formatSmallBn,
} from "./formatters";

const MINUS = "−";
const DASH = "—";

describe("formatBn and formatSignedBn", () => {
  test("negative values put a true minus before the pound sign", () => {
    expect(formatBn(-0.5)).toBe(`${MINUS}£0.50bn`);
    expect(formatSignedBn(-0.5)).toBe(`${MINUS}£0.50bn`);
  });

  test("positive values carry no sign", () => {
    expect(formatBn(1.2)).toBe("£1.20bn");
    expect(formatSignedBn(10.5165, 1)).toBe("£10.5bn");
  });

  test("a value that rounds to zero carries no sign", () => {
    expect(formatSignedBn(-0.04, 1)).toBe("£0.0bn");
    expect(formatBn(-0.001)).toBe("£0.00bn");
  });

  test("missing values show a dash", () => {
    for (const missing of [null, undefined, "", NaN, "abc"]) {
      expect(formatBn(missing)).toBe(DASH);
      expect(formatSignedBn(missing)).toBe(DASH);
    }
  });
});

describe("formatSmallBn", () => {
  test("steps down from £bn to £m, £k and pounds", () => {
    expect(formatSmallBn(0.0087)).toBe("£0.01bn");
    expect(formatSmallBn(0.0012)).toBe("£1.2m");
    expect(formatSmallBn(7.3e-5)).toBe("£73k");
    expect(formatSmallBn(3e-7)).toBe("£300");
    expect(formatSmallBn(0)).toBe("£0");
  });

  test("negatives keep the minus sign, and rounding to zero drops it", () => {
    expect(formatSmallBn(-6.0e-5)).toBe(`${MINUS}£60k`);
    expect(formatSmallBn(-2e-10)).toBe("£0");
  });

  test("a negative half rounds away from zero, as a positive one does", () => {
    expect(formatSmallBn(5e-7)).toBe("£1k");
    expect(formatSmallBn(-5e-7)).toBe(`${MINUS}£1k`);
    expect(formatSmallBn(-4e-7)).toBe(`${MINUS}£400`);
  });

  test("missing values show a dash", () => {
    expect(formatSmallBn(null)).toBe(DASH);
    expect(formatSmallBn(undefined)).toBe(DASH);
  });
});

describe("other formatters", () => {
  test("currency, £m and percentages share the sign rules", () => {
    expect(formatCurrency(-1234.4)).toBe(`${MINUS}£1,234`);
    expect(formatSignedCurrency(-0.4)).toBe("£0");
    expect(formatMn(-850)).toBe(`${MINUS}£850m`);
    expect(formatSignedMn(-0.2)).toBe("£0m");
    expect(formatPct(12.345)).toBe("12.3%");
    expect(formatSignedPct(-0.04)).toBe("0.0%");
    expect(formatSignedPct(-2.5)).toBe(`${MINUS}2.5%`);
  });

  test("halves round away from zero whatever the sign", () => {
    expect(formatCurrency(0.5)).toBe("£1");
    expect(formatCurrency(-0.5)).toBe(`${MINUS}£1`);
    expect(formatMn(999.5)).toBe("£1,000m");
    expect(formatMn(-999.5)).toBe(`${MINUS}£1,000m`);
    expect(formatSignedBn(0.005)).toBe("£0.01bn");
    expect(formatSignedBn(-0.005)).toBe(`${MINUS}£0.01bn`);
  });

  test("missing values show a dash", () => {
    expect(formatCurrency(undefined)).toBe(DASH);
    expect(formatMn(null)).toBe(DASH);
    expect(formatPct(NaN)).toBe(DASH);
    expect(formatCount(undefined)).toBe(DASH);
    expect(formatPublished(undefined)).toBe(DASH);
  });

  test("counts and dates", () => {
    expect(formatCount(558900.5)).toBe("559k");
    expect(formatCount(2802.1)).toBe("2.8k");
    expect(formatPublished("2026-09")).toBe("September 2026");
    expect(formatPublished("2026-06-29")).toBe("29 June 2026");
    expect(formatPublished("2026")).toBe("2026");
  });
});
