/**
 * Accessors for the cgt_equalisation_results.json payload.
 *
 * Deliberately no fallbacks: if a required field is missing the accessor or
 * its consumer throws visibly rather than rendering placeholders. The
 * formatters' dash is for optional fields only.
 */

// A required numeric field: throws when it is missing or not a number, so a
// renamed field fails the page instead of reading as "—".
export function requireNumber(record, field, where) {
  const value = record?.[field];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${where}: required field "${field}" is missing or not a number`);
  }
  return value;
}

export function getMetadata(data) {
  return data.metadata;
}

export function getCalibration(data) {
  return data.calibration;
}

export function getValidation(data) {
  return data.validation;
}

// The baseline in HMRC's own year (2024-25, the dataset's own year, no
// projection), for the Baseline tab: { year, validation, rates,
// liability_bn, ... }. A results file from before the block existed falls
// back to the headline year's validation, with no rates or liability bounds.
export function getBaselineComparison(data) {
  if (data.baseline_comparison) return data.baseline_comparison;
  return { year: getHeadlineYear(data), validation: data.validation, rates: null, liability_bn: null };
}

// The revenue cards read each year's change in the government balance.
export function getBudget(data) {
  for (const row of data.budget) requireNumber(row, "gov_balance_change_bn", `budget row ${row.year}`);
  return data.budget;
}

export function getIncomeChangeGroups(data, year) {
  return data.income_change_groups[year];
}

// Every year's groupings, keyed by fiscal label (the shape GroupImpactChart takes).
export function getIncomeChangeGroupsByYear(data) {
  return data.income_change_groups;
}

export function getYearLabels(data) {
  return Object.keys(data.income_change_groups);
}

// One year's sensitivity rows (the block is keyed by fiscal label). Every
// row's elasticity and revenue change are required: the Reform tab's
// revenue card reads its range from them.
export function getSensitivity(data, year) {
  const rows = data.sensitivity[year];
  if (!Array.isArray(rows)) throw new Error(`sensitivity: no rows for ${year}`);
  for (const row of rows) {
    requireNumber(row, "e_retention", `sensitivity row ${year}`);
    requireNumber(row, "revenue_bn", `sensitivity row ${year}`);
  }
  return rows;
}

// One year's sensitivity curve: the reform's change in CGT revenue at each
// retention elasticity on the pipeline's grid ({ elasticity, revenue_bn },
// sorted) and the interpolated £0 crossing (`break_even`, or null). Null
// for a results file from before the block existed; the chart then draws
// through the sensitivity rows.
export function getSensitivityCurve(data, year) {
  const block = data.sensitivity_curve?.[year];
  if (!block) return null;
  for (const point of block.grid) {
    requireNumber(point, "elasticity", `sensitivity curve ${year}`);
    requireNumber(point, "revenue_bn", `sensitivity curve ${year}`);
  }
  return block;
}

// The years the per-year blocks (sensitivity, yield by schedule) cover.
export function getSensitivityYears(data) {
  return Object.keys(data.sensitivity);
}

// External benchmarks beside this dataset's own scores (issue #7): the
// static reform against JRF, regional shares against HMRC's for the same year,
// and HMRC's ready-reckoner rows.
export function getBenchmarks(data) {
  return data.benchmarks;
}

const BASELINE_CGT_RATES = { basic_rate: 0.18, higher_rate: 0.24, additional_rate: 0.24 };

export function getReform(data) {
  // The pipeline emits flat reform rates ({basic_rate: 0.2, ...}); normalise to
  // {basic_rate: {baseline, reform}, ...} so components render both columns.
  const reform = data.metadata.reform;
  return Object.fromEntries(
    Object.entries(BASELINE_CGT_RATES).map(([band, baseline]) => {
      const value = reform[band];
      return [band, typeof value === "number" ? { baseline, reform: value } : value];
    }),
  );
}

// The schedules policyengine-uk 2.99.0 charges separately that the reform
// reaches, with their current law for the reform's first year (2026-27):
// Business Asset Disposal Relief charges 18% up to a £1m lifetime limit.
// Carried interest has been taxed as income since April 2026.
export const BASELINE_SCHEDULE_RATES = {
  residential_property: { basic_rate: 0.18, higher_rate: 0.24, additional_rate: 0.24 },
  badr: { withdrawn: false, rate: 0.18, lifetime_limit: 1_000_000 },
};

// "£1m", "£500k": a lifetime limit for the relief.
export function badrLimitLabel(limit) {
  return limit >= 1_000_000
    ? `£${limit / 1_000_000}m`
    : `£${(limit / 1_000).toLocaleString("en-GB")}k`;
}

// "18% up to a £1m lifetime limit", "Withdrawn": a treatment of the relief.
export function describeBadr(badr) {
  if (badr.withdrawn) return "Withdrawn";
  return `${Math.round(badr.rate * 100)}% up to a ${badrLimitLabel(badr.lifetime_limit)} lifetime limit`;
}

// One year's yield by schedule (the block is keyed by fiscal label).
export function getScheduleSplit(data, year) {
  const split = data.schedule_split[year];
  if (!split) throw new Error(`schedule_split: no block for ${year}`);
  return split;
}

export function getScheduleSplitYears(data) {
  return Object.keys(data.schedule_split);
}

export function getReformSchedules(data) {
  return data.metadata.reform_schedules;
}

export function getFirstYear(data) {
  // metadata.years may hold calendar ints (2026) while income_change_groups is keyed
  // by fiscal labels ("2026-27") — normalise to the fiscal label.
  const year = data.metadata.years[0];
  if (typeof year === "number") {
    return `${year}-${String(year + 1).slice(2)}`;
  }
  return year;
}

// The year the headline cards, the revenue-and-response chart and
// the group chart's default report (a fiscal label, "2027-28").
export function getHeadlineYear(data) {
  const year = data.metadata.headline_year;
  if (typeof year !== "string") throw new Error('metadata: required field "headline_year" is missing');
  return year;
}

// The budget row for one fiscal label.
export function getBudgetRow(data, year) {
  const row = getBudget(data).find((r) => r.year === year);
  if (!row) throw new Error(`budget: no row for ${year}`);
  return row;
}

export function getFiveYearTotal(data) {
  return data.budget.reduce((sum, row) => sum + row.gov_balance_change_bn, 0);
}

// The dataset a results file was produced on.
export function getDatasetInfo(data) {
  const md = data.metadata;
  return {
    key: md.dataset_key,
    label: md.dataset_label,
    shortLabel: md.dataset_short_label,
    role: md.dataset_role,
    uri: md.dataset,
    sha256: md.dataset_sha256,
    producer: md.dataset_producer,
    observation: md.dataset_observation,
    notes: md.dataset_notes,
    columns: md.dataset_columns,
  };
}

// Persons taxable only because uprating carried base-year gains at or below
// the frozen exempt amount past it (see the pipeline's impacts module).
export function getEntrants(data) {
  return data.validation.entrants_by_uprating;
}

export function getEntrantShare(data) {
  const validation = data.validation;
  return validation.entrants_by_uprating.count / validation.cgt_taxpayers;
}
