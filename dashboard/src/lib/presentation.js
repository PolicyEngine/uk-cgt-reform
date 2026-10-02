/** Labels describe cases, not positions on a common elasticity scale. */
export function scenarioLabel(row) {
  if (row.id === "static") return "No behavioural response";
  if (row.id === "policyengine") return "PolicyEngine";
  if (row.id === "official") return "HMRC / OBR";
  return `CenTax · ${Number(row.elasticity).toFixed(1)}`;
}

export function scenarioConvention(row) {
  if (row.id === "static") return "Gains held fixed";
  const form =
    row.applied_as === "mtr"
      ? "tax-rate elasticity"
      : "retention-rate elasticity";
  return `${row.elasticity} ${form}${row.badr_elasticity != null && row.badr_elasticity !== row.elasticity ? `; ${row.badr_elasticity} for BADR` : ""}`;
}

export function approachLabel(approach) {
  return approach.id === "total_revenue"
    ? "Including income shifting"
    : "CGT only";
}

export const GROUP_LABELS = {
  decile: "Income deciles",
  age: "Age",
  region: "Region",
  household_type: "Household type",
  quintile: "Income quintiles",
  quartile: "Income quartiles",
};

export function availableGroupings(groups) {
  return Object.entries(GROUP_LABELS)
    .filter(([key]) => groups[key]?.length)
    .map(([value, label]) => ({ value, label }));
}
