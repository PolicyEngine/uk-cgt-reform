import { describe, expect, test } from "bun:test";
import results from "../../public/data/cgt_equalisation_results.json";
import { getBudgetRow, getHeadlineYear, getScheduleSplit, getSensitivity, getSensitivityCurve } from "./dataHelpers";

describe("headline year", () => {
  test("the results file reports 2027-28 by default", () => {
    expect(getHeadlineYear(results)).toBe("2027-28");
  });

  test("the single-year blocks are for the headline year", () => {
    const year = getHeadlineYear(results);
    expect(getScheduleSplit(results, year).year).toBe(year);
    expect(new Set(getSensitivity(results, year).map((row) => row.year))).toEqual(new Set([year]));
    expect(Object.keys(results.income_change_groups)).toContain(year);
  });

  test("the central sensitivity case is the headline year's budget row", () => {
    const year = getHeadlineYear(results);
    const central = getSensitivity(results, year).find((row) => row.e_retention === results.metadata.elasticity);
    expect(central.revenue_bn).toBeCloseTo(getBudgetRow(results, year).cgt_change_bn, 6);
  });

  test("a missing headline year or budget row fails visibly", () => {
    expect(() => getHeadlineYear({ metadata: {} })).toThrow("headline_year");
    expect(() => getBudgetRow(results, "2032-33")).toThrow("2032-33");
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

describe("sensitivity curve", () => {
  test("every year's curve passes through its one-elasticity cases", () => {
    for (const year of Object.keys(results.sensitivity)) {
      const curve = getSensitivityCurve(results, year);
      expect(curve.runs).toBe(curve.grid.length);
      for (const row of getSensitivity(results, year)) {
        // The official case gives BADR gains their own elasticity: off the line.
        if (row.badr_elasticity !== row.e_retention) continue;
        const point = curve.grid.find((p) => p.elasticity === row.e_retention);
        expect(point.revenue_bn).toBe(row.revenue_bn);
      }
    }
  });

  test("the £0 point lies between the two runs either side of it", () => {
    for (const year of Object.keys(results.sensitivity)) {
      const { grid, break_even: crossing } = getSensitivityCurve(results, year);
      if (!crossing) continue;
      const [a, b] = crossing.between.map((e) => grid.find((p) => p.elasticity === e));
      expect(Math.sign(a.revenue_bn)).not.toBe(Math.sign(b.revenue_bn));
      expect(crossing.elasticity).toBeGreaterThan(a.elasticity);
      expect(crossing.elasticity).toBeLessThan(b.elasticity);
    }
  });

  test("a results file without the block returns null", () => {
    expect(getSensitivityCurve({ sensitivity: {} }, "2027-28")).toBeNull();
  });
});

describe("yield by schedule across the grid", () => {
  test("each year's stacked parts add to the sensitivity curve", () => {
    for (const year of Object.keys(results.schedule_split)) {
      const { grid } = results.schedule_split[year];
      const curve = getSensitivityCurve(results, year).grid;
      expect(grid.map((p) => p.elasticity)).toEqual(curve.map((p) => p.elasticity));
      grid.forEach((point, i) => {
        const steps = results.schedule_split[year].steps.map((step) => step.step);
        const parts = steps.reduce((sum, step) => sum + point[`${step}_bn`], 0);
        expect(parts).toBeCloseTo(point.total_bn, 9);
        expect(point.total_bn).toBeCloseTo(curve[i].revenue_bn, 9);
      });
    }
  });
});

describe("CenTax package beside PolicyEngine", () => {
  test("every PolicyEngine bar sits under a CenTax figure for the same year", async () => {
    const { buildPackageRows } = await import("../components/charts/PackageEstimatesChart");
    const { centax_package_context: rows, centax_package_model: model } = results.benchmarks;
    const built = buildPackageRows(rows.filter((r) => !r.id.endsWith("_derived")), model.rows);
    const modelBars = built.flatMap((row) => (row.bars ?? []).filter((b) => b.kind === "model"));
    expect(modelBars).toHaveLength(model.rows.length);
    for (const m of model.rows) {
      expect(built.find((row) => row.year === m.year && row.bars?.some((b) => b.kind === "model"))).toBeTruthy();
    }
  });
});
