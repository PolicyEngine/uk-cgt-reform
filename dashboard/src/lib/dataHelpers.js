/**
 * Accessors for the cgt_equalisation_results.json payload.
 *
 * Deliberately no fallbacks: if a field is missing the consumer throws
 * visibly rather than rendering placeholders.
 */

export function getMetadata(data) {
  return data.metadata;
}

export function getCalibration(data) {
  return data.calibration;
}

export function getValidation(data) {
  return data.validation;
}

export function getBudget(data) {
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

export function getSensitivity(data) {
  return data.sensitivity;
}

// External benchmarks beside this dataset's own scores (issue #7): the
// static reform against JRF, the 2019/20-rules uplift against CenTax, and
// HMRC's ready-reckoner rows.
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

export function getScheduleSplit(data) {
  return data.schedule_split;
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

// ---------------------------------------------------------------------------
// The two approaches to income shifting (comparison.APPROACHES in the
// pipeline). Net of income shifting: CenTax's central case as published, and
// the cases measured on the CGT base (CenTax's bounds and the official case)
// plus the OBR's income tax and National Insurance on income no longer
// presented as gains. Gross of income shifting: CenTax before its
// adjustments, and every case with nothing added back. A view puts the chosen approach's
// cases where the tabs read the central and official ones, so the tabs
// themselves need not know which approach is shown.
// ---------------------------------------------------------------------------

export function getApproachOptions(data) {
  return data.approaches.approaches;
}

export function getDefaultApproach(data) {
  return data.approaches.default;
}

export function getIncomeShifting(data) {
  return data.approaches.income_shifting;
}

function findApproach(block, approachId) {
  return (
    block.approaches.find((approach) => approach.id === approachId) ??
    block.approaches.find((approach) => approach.id === block.default)
  );
}

// The schedule split's case key for each approach's central case.
const SPLIT_CASE = { centax_central: "central", centax_unadjusted: "unadjusted" };

// "…, plus the OBR's income tax and NI on shifted income": the name of a case
// that carries the income-shifting offset.
export function withOffsetLabel(name) {
  return `${name}, plus the OBR's income tax and NI on shifted income`;
}

function addByYear(values, offsets) {
  return Object.fromEntries(Object.entries(values).map(([year, v]) => [year, v + offsets[year]]));
}

function centralSplit(split, centralId) {
  const key = SPLIT_CASE[centralId];
  return {
    ...split,
    steps: split.steps.map((row) => ({
      ...row,
      central_cgt_change_bn: row[`${key}_cgt_change_bn`],
      central_increment_bn: row[`${key}_increment_bn`],
    })),
  };
}

// A results file as the chosen approach shows it.
export function applyApproach(data, approachId) {
  const approach = findApproach(data.approaches, approachId);
  const offsetIds = new Set(approach.offset_case_ids);
  const byId = Object.fromEntries(data.sensitivity.map((row) => [row.id, row]));
  const sensitivity = approach.case_ids.map((id) => {
    const row = byId[id];
    if (!offsetIds.has(id)) return { ...row, includes_income_shifting_offset: false };
    return {
      ...row,
      name: withOffsetLabel(row.name),
      revenue_2026_bn: row.revenue_2026_bn + row.income_shifting_offset_2026_bn,
      includes_income_shifting_offset: true,
    };
  });
  const central = data.approach_results?.[approach.id];
  const elasticities = data.benchmarks.elasticities;
  const rr = data.benchmarks.ready_reckoner;
  const officialOffset = offsetIds.has("official");
  return {
    ...data,
    approach,
    metadata: { ...data.metadata, elasticity: byId[approach.central_id].e_retention },
    budget: central ? central.budget : data.budget,
    income_change_groups: central ? central.income_change_groups : data.income_change_groups,
    sensitivity,
    // Every case, as computed (no offset added), for tabs that set the two
    // approaches side by side.
    sensitivity_all: data.sensitivity,
    schedule_split: centralSplit(data.schedule_split, approach.central_id),
    benchmarks: {
      ...data.benchmarks,
      elasticities: {
        ...elasticities,
        // CenTax's published central, whichever approach is shown.
        centax_central: elasticities.central,
        central: approach.central_id === "centax_unadjusted" ? elasticities.unadjusted : elasticities.central,
        official: { ...elasticities.official, includes_income_shifting_offset: officialOffset },
      },
      ready_reckoner: {
        ...rr,
        rows: rr.rows.map((row) => ({
          ...row,
          model_m: {
            centax_central: row.model_m[approach.central_id],
            official: officialOffset
              ? addByYear(row.model_m.official, row.income_shifting_offset_m.official)
              : row.model_m.official,
          },
        })),
      },
    },
  };
}

// Explorer budget rows as an approach shows them: the official case adds the
// income-shifting offset under the approach net of income shifting.
export function applyApproachToBudget(rows, approach, elasticityId) {
  if (!approach.offset_case_ids.includes(elasticityId)) return rows;
  return rows.map((row) => ({
    ...row,
    gov_balance_change_bn: row.gov_balance_change_bn + row.income_shifting_offset_bn,
  }));
}
