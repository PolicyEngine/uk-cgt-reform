import { describe, expect, test } from "bun:test";
import results from "../../public/data/cgt_equalisation_results.json";
import { getBudgetRow, getHeadlineYear, getScheduleSplit, getSensitivity } from "./dataHelpers";

describe("headline year", () => {
  test("the results file reports 2027-28 by default", () => {
    expect(getHeadlineYear(results)).toBe("2027-28");
  });

  test("the single-year blocks are for the headline year", () => {
    const year = getHeadlineYear(results);
    expect(getScheduleSplit(results).year).toBe(year);
    expect(new Set(getSensitivity(results).map((row) => row.year))).toEqual(new Set([year]));
    expect(Object.keys(results.income_change_groups)).toContain(year);
  });

  test("the central sensitivity case is the headline year's budget row", () => {
    const year = getHeadlineYear(results);
    const central = getSensitivity(results).find((row) => row.e_retention === results.metadata.elasticity);
    expect(central.revenue_bn).toBeCloseTo(getBudgetRow(results, year).cgt_change_bn, 6);
  });

  test("a missing headline year or budget row fails visibly", () => {
    expect(() => getHeadlineYear({ metadata: {} })).toThrow("headline_year");
    expect(() => getBudgetRow(results, "2031-32")).toThrow("2031-32");
  });
});

describe("income deciles", () => {
  test("every year carries ten deciles, bottom to top", () => {
    for (const groups of Object.values(results.income_change_groups)) {
      expect(groups.decile).toHaveLength(10);
      expect(groups.decile[0].group).toBe("Lowest 10%");
      expect(groups.decile.at(-1).group).toBe("Highest 10%");
    }
  });
});
