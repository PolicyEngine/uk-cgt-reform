import { describe, expect, test } from "bun:test";
import results from "../public/data/cgt_equalisation_results.json";
import { applyApproach } from "../src/lib/dataHelpers";
import {
  availableGroupings,
  scenarioConvention,
  scenarioLabel,
} from "../src/lib/presentation";

describe("analysis presentation", () => {
  test("changing revenue scope preserves household results and adds only the reported offset", () => {
    const gross = applyApproach(results, "cgt_only");
    const net = applyApproach(results, "total_revenue");
    expect(gross.income_change_groups).toEqual(net.income_change_groups);
    gross.budget.forEach((row, index) => {
      expect(
        net.budget[index].gov_balance_change_bn - row.gov_balance_change_bn,
      ).toBeCloseTo(row.income_shifting_offset_bn, 8);
    });
    expect(gross.budget[0].gov_balance_change_bn).toBe(
      results.budget[0].gov_balance_change_bn,
    );
  });

  test("all years have ten genuine income groups and the requested age and region outputs", () => {
    Object.values(results.income_change_groups).forEach((groups) => {
      expect(groups.decile).toHaveLength(10);
      expect(groups.age).toHaveLength(6);
      expect(groups.region).toHaveLength(12);
      expect(availableGroupings(groups).map((option) => option.value)).toEqual([
        "decile",
        "age",
        "region",
        "household_type",
      ]);
    });
  });

  test("older explorer payloads offer only the groups actually returned", () => {
    expect(
      availableGroupings({ quintile: [{}], quartile: [{}], region: [{}] }),
    ).toEqual([{ value: "region", label: "Region" }]);
  });

  test("assumption labels retain the different elasticity definitions and relief response", () => {
    expect(
      scenarioConvention({
        id: "policyengine",
        elasticity: -0.7,
        applied_as: "mtr",
      }),
    ).toBe("-0.7 tax-rate elasticity");
    expect(
      scenarioConvention({
        id: "official",
        elasticity: 2.5,
        applied_as: "retention",
        badr_elasticity: 1.4,
      }),
    ).toBe("2.5 retention-rate elasticity; 1.4 for BADR");
    expect(scenarioConvention({ id: "static", elasticity: 0 })).toBe(
      "Gains held fixed",
    );
    expect(scenarioLabel({ id: "centax_central", elasticity: 1 })).toBe(
      "CenTax · 1.0",
    );
  });
});
