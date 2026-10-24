// A live run's split of its headline-year yield (the result's
// `schedule_split`, from explore.score_schedule_split) as the yield chart's
// bars: no behavioural response, CenTax central and the run's own elasticity,
// smallest elasticity first. For equalisation the run computes only its own
// case; the other two come from the results file's split of the same year.
import { elasticityOption, elasticityShortName, sameElasticity } from "./schedule";

const REFERENCE_KEYS = ["static", "central"];
const CASE_FIELDS = (key) => [`${key}_cgt_change_bn`, `${key}_increment_bn`];

const tenth = (e) => Number(e).toFixed(1);

// The axis label for one bar, as lines. The run's own elasticity is marked
// "your choice" where it is a named case, "Your elasticity" otherwise.
function caseLabel(key, e, userE) {
  const mine = sameElasticity(e, userE);
  if (key === "static") return mine ? ["No behavioural", "response,", "your choice"] : ["No behavioural", "response"];
  if (key === "central") return ["CenTax central", mine ? `(${tenth(e)}), your choice` : `(${tenth(e)})`];
  return elasticityOption(e)
    ? [elasticityShortName(e), `(${tenth(e)}), your choice`]
    : ["Your elasticity", `(${tenth(e)})`];
}

// `result` is a live run; `precomputedSplit` the results file's
// schedule_split block for the run's headline year (or undefined). Returns
// { year, steps, cases } for the chart, or null when the run has no split
// (a result cached before it).
export function liveYieldSplit(result, precomputedSplit) {
  const split = result?.schedule_split;
  if (!split) return null;
  const elasticities = { ...split.elasticities };
  let steps = split.steps.map((row) => ({ ...row }));
  if (split.reference_cases_from_results_file && precomputedSplit) {
    const byStep = new Map(precomputedSplit.steps.map((row) => [row.step, row]));
    // The file's rows must be the same steps, or its bars cannot sit beside these.
    if (steps.length === byStep.size && steps.every((row) => byStep.has(row.step))) {
      steps = steps.map((row) => {
        const file = byStep.get(row.step);
        const merged = { ...row };
        REFERENCE_KEYS.forEach((key) =>
          CASE_FIELDS(key).forEach((field) => {
            merged[field] = file[field];
          }),
        );
        return merged;
      });
      REFERENCE_KEYS.forEach((key) => {
        elasticities[key] = precomputedSplit.elasticities[key];
      });
    }
  }
  const userE = result.metadata.elasticity;
  const cases = Object.entries(elasticities)
    .filter(([key]) => steps.every((row) => Number.isFinite(row[`${key}_increment_bn`])))
    .sort((a, b) => a[1] - b[1])
    .map(([key, e]) => ({ key, elasticity: e, label: caseLabel(key, e, userE) }));
  return { year: split.year, steps, cases };
}

// Short names for the steps when the schedule is not equalisation's
// income tax rates; the chart's own names otherwise.
export function stepNames(rates, incomeTaxRates) {
  const incomeTax = Object.keys(incomeTaxRates).every((band) => Math.abs(rates[band] - incomeTaxRates[band]) < 1e-9);
  return incomeTax
    ? {}
    : { main_rates: "New rates on other gains", residential: "New rates on residential property" };
}
