import { describe, expect, test } from "bun:test";
import results from "../../public/data/cgt_equalisation_results.json";
import { liveYieldSplit, stepNames } from "./yieldSplit";

const YEAR = "2027-28";
const fileSplit = results.schedule_split[YEAR];

// A run's split in the shape explore.score_schedule_split returns.
function run(elasticities, { equalise = false, userE = 2.5 } = {}) {
  const steps = [
    { step: "main_rates", label: "Main rates" },
    { step: "residential", label: "Residential property gains at the same rates" },
    ...(equalise ? [{ step: "badr_withdrawn", label: "Business Asset Disposal Relief withdrawn" }] : []),
  ].map((row, i) => {
    const out = { ...row };
    Object.entries(elasticities).forEach(([key, e]) => {
      out[`${key}_increment_bn`] = (i + 1) / (1 + e);
      out[`${key}_cgt_change_bn`] = 0;
    });
    return out;
  });
  return {
    metadata: { elasticity: userE },
    schedule_split: {
      year: YEAR,
      elasticities,
      reference_cases_from_results_file: equalise,
      steps,
    },
  };
}

const labels = (split) => split.cases.map((c) => c.label.join(" "));

describe("the live yield split", () => {
  test("a custom schedule shows three bars, smallest elasticity first", () => {
    const split = liveYieldSplit(run({ static: 0, central: 1, user: 2.5 }), fileSplit);
    expect(split.cases.map((c) => c.key)).toEqual(["static", "central", "user"]);
    expect(labels(split)).toEqual(["No behavioural response", "CenTax central (1.0)", "Your elasticity (2.5)"]);
  });

  test("a value below the central case sits between the references", () => {
    const split = liveYieldSplit(run({ static: 0, central: 1, user: 0.7 }, { userE: 0.7 }));
    expect(split.cases.map((c) => c.key)).toEqual(["static", "user", "central"]);
  });

  test("a named case is marked as the reader's choice", () => {
    const split = liveYieldSplit(run({ static: 0, central: 1, user: 3.6 }, { userE: 3.6 }));
    expect(labels(split)[2]).toBe("HMRC/OBR official (3.6), your choice");
  });

  test("a value equal to the central case is that bar", () => {
    const split = liveYieldSplit(run({ static: 0, central: 1 }, { userE: 1 }));
    expect(labels(split)).toEqual(["No behavioural response", "CenTax central (1.0), your choice"]);
  });

  test("equalisation takes the reference bars from the results file", () => {
    const split = liveYieldSplit(run({ user: 2.5 }, { equalise: true }), fileSplit);
    expect(split.cases.map((c) => c.key)).toEqual(["static", "central", "user"]);
    fileSplit.steps.forEach((row, i) => {
      expect(split.steps[i].static_increment_bn).toBe(row.static_increment_bn);
      expect(split.steps[i].central_increment_bn).toBe(row.central_increment_bn);
    });
    expect(split.steps[0].user_increment_bn).toBeCloseTo(1 / 3.5);
  });

  test("a run cached before the split has none", () => {
    expect(liveYieldSplit({ metadata: { elasticity: 2.5 } })).toBeNull();
  });

  test("steps keep the chart's names only at income tax rates", () => {
    const incomeTax = results.metadata.reform;
    expect(stepNames(incomeTax, incomeTax)).toEqual({});
    expect(stepNames({ basic_rate: 0.18, higher_rate: 0.3, additional_rate: 0.3 }, incomeTax).main_rates).toBe(
      "New rates on other gains",
    );
  });
});
