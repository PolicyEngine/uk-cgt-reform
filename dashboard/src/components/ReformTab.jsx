"use client";

import { formatPct, formatSignedBn, formatSignedCurrency, formatSignedPct } from "../lib/formatters";
import {
  BASELINE_SCHEDULE_RATES,
  getBudget,
  getDatasetInfo,
  getEntrants,
  getFirstYear,
  getFiveYearTotal,
  getIncomeChangeGroups,
  getIncomeChangeGroupsByYear,
  getReformSchedules,
  getSensitivity,
  getReform,
  getValidation,
} from "../lib/dataHelpers";
import BudgetChart from "./charts/BudgetChart";
import GroupImpactChart from "./charts/GroupImpactChart";
import { MetricCard, TipHeader } from "./controls";
import SectionHeading from "./SectionHeading";

// Where each sensitivity scenario's elasticity comes from. Keys match the
// scenario names emitted by the pipeline's SENSITIVITY_CASES.
const ELASTICITY_SOURCES = {
  "Static (no behavioural response)": { label: "None: taxpayers do not respond", url: null },
  "CenTax lower (retention e=0.5)": {
    label: "Advani, Lonsdale & Summers (2024), CenTax",
    url: "https://centax.org.uk/wp-content/uploads/2024/10/AdvaniLonsdaleSummers2024_CGTReform.pdf#page=38",
  },
  "CenTax central (retention e=1.0)": {
    label: "Advani, Lonsdale & Summers (2024), CenTax",
    url: "https://centax.org.uk/wp-content/uploads/2024/10/AdvaniLonsdaleSummers2024_CGTReform.pdf#page=38",
  },
  "HMRC/OBR official (retention e=3.6)": {
    label: "OBR (January 2025), para 1.9",
    url: "https://obr.uk/docs/dlm_uploads/CGT-supplementary-release-Jan-2025.pdf#page=3",
  },
};

function SourceLink({ name }) {
  const source = ELASTICITY_SOURCES[name];
  if (!source) return <td>—</td>;
  if (!source.url) return <td className="font-normal text-slate-500">{source.label}</td>;
  return (
    <td>
      <a
        href={source.url}
        target="_blank"
        rel="noopener noreferrer"
        className="font-normal text-[color:var(--pe-color-primary-600)] underline decoration-1 underline-offset-2 hover:opacity-80"
      >
        {source.label}
      </a>
    </td>
  );
}

export default function ReformTab({ data }) {
  const budget = getBudget(data);
  const firstYear = getFirstYear(data);
  const fiveYearTotal = getFiveYearTotal(data);
  const headlineGroups = getIncomeChangeGroups(data, firstYear);
  const sensitivity = getSensitivity(data);
  const reform = getReform(data);
  const schedules = getReformSchedules(data);
  const validation = getValidation(data);
  const dataset = getDatasetInfo(data);
  const entrants = getEntrants(data);
  const entrantShare = entrants.count / validation.cgt_taxpayers;
  const firstYearRow = budget[0];
  const entrantShareOfChange =
    firstYearRow.cgt_change_from_entrants_bn / firstYearRow.gov_balance_change_bn;
  const recorded = (gains) => (gains > 0 ? "" : ` ${dataset.shortLabel} records no such gains, so this line is inert here.`);
  const topQuintile = headlineGroups.quintile[headlineGroups.quintile.length - 1];

  return (
    <div className="space-y-6">
      <div className="pt-2">
        <SectionHeading
          size="lg"
          title="The proposed reform"
          description={
            <>
              Capital gains are currently taxed at lower rates than income. The
              reform aligns each CGT rate with the corresponding income tax
              rate from {firstYear}: the basic rate rises from{" "}
              {formatPct(reform.basic_rate.baseline * 100, 0)} to{" "}
              {formatPct(reform.basic_rate.reform * 100, 0)}, the higher rate
              from {formatPct(reform.higher_rate.baseline * 100, 0)} to{" "}
              {formatPct(reform.higher_rate.reform * 100, 0)}, and the
              additional rate from{" "}
              {formatPct(reform.additional_rate.baseline * 100, 0)} to{" "}
              {formatPct(reform.additional_rate.reform * 100, 0)}. Taxpayers
              respond by realising fewer gains, modelled with{" "}
              <a
                href="https://centax.org.uk/wp-content/uploads/2024/10/AdvaniLonsdaleSummers2024_CGTReform.pdf#page=38"
                target="_blank"
                rel="noopener noreferrer"
                className="underline decoration-1 underline-offset-2 hover:opacity-80"
              >
                Advani/CenTax&apos;s central retention-rate elasticity of 1.0
              </a>{" "}
              (≈ MTR elasticity of −0.7).
            </>
          }
        />
      </div>

      <section className="section-card">
        <SectionHeading
          title={`Headline results, ${firstYear}`}
          description={`Revenue after the behavioural response on ${dataset.shortLabel}; distributional figures cover all households.`}
        />
        <div className="grid gap-4 md:grid-cols-3">
          <MetricCard
            label={`Revenue raised, ${firstYear}`}
            value={formatSignedBn(firstYearRow.gov_balance_change_bn, 1)}
            note="Net change in the government balance after taxpayers reduce realisations in response to the higher rates."
          />
          <MetricCard
            label="Five-year total, 2026-27 to 2030-31"
            value={formatSignedBn(fiveYearTotal, 1)}
            note="Sum of the annual government balance changes over the five modelled years."
          />
          <MetricCard
            label="Top quintile net income change"
            value={formatSignedPct(topQuintile.relative_change_pct)}
            note={`Average of ${formatSignedCurrency(topQuintile.avg_change_gbp)} per household in the highest-income 20%, which holds most realised gains. Includes the gains taxpayers stop realising under the −0.7 elasticity, not just tax paid.`}
          />
        </div>
      </section>

      <details className="section-card group">
        <summary className="cursor-pointer select-none font-semibold text-slate-800 marker:text-[color:var(--pe-color-primary-600)]">
          What exactly does the reform change?
          <span className="ml-2 text-sm font-normal text-slate-500 group-open:hidden">
            (expand for the full specification)
          </span>
        </summary>
        <div className="mt-4 space-y-3">
          <p className="text-sm leading-6 text-slate-600">
            Effective from the 2026-27 fiscal year and held in place through 2030-31. All results on
            this page compare this reform against current policy on the same baseline.
          </p>
          <table className="data-table">
            <thead>
              <tr>
                <th>Policy parameter</th>
                <th>Baseline (current policy)</th>
                <th>Reform</th>
                <th>What it means</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Basic CGT rate</td>
                <td>{formatPct(reform.basic_rate.baseline * 100, 0)}</td>
                <td className="font-semibold">{formatPct(reform.basic_rate.reform * 100, 0)}</td>
                <td>Gains falling in the basic income tax band are taxed at the 20% basic income tax rate.</td>
              </tr>
              <tr>
                <td>Higher CGT rate</td>
                <td>{formatPct(reform.higher_rate.baseline * 100, 0)}</td>
                <td className="font-semibold">{formatPct(reform.higher_rate.reform * 100, 0)}</td>
                <td>Gains in the higher band are taxed at the 40% higher income tax rate — the largest rise in the package.</td>
              </tr>
              <tr>
                <td>Additional CGT rate</td>
                <td>{formatPct(reform.additional_rate.baseline * 100, 0)}</td>
                <td className="font-semibold">{formatPct(reform.additional_rate.reform * 100, 0)}</td>
                <td>Gains in the additional band (income over £125,140) are taxed at the 45% additional income tax rate.</td>
              </tr>
              <tr>
                <td>Residential property CGT rates</td>
                <td>
                  {formatPct(BASELINE_SCHEDULE_RATES.residential_property.basic_rate * 100, 0)} /{" "}
                  {formatPct(BASELINE_SCHEDULE_RATES.residential_property.higher_rate * 100, 0)}
                </td>
                <td className="font-semibold">
                  {formatPct(schedules.residential_property.basic_rate * 100, 0)} /{" "}
                  {formatPct(schedules.residential_property.higher_rate * 100, 0)} /{" "}
                  {formatPct(schedules.residential_property.additional_rate * 100, 0)}
                </td>
                <td>
                  Gains on UK residential property, charged on their own schedule, take the same
                  income tax rates.{recorded(validation.residential_property_gains_bn)}
                </td>
              </tr>
              <tr>
                <td>Carried interest CGT rate</td>
                <td>{formatPct(BASELINE_SCHEDULE_RATES.carried_interest.higher_rate * 100, 0)} flat</td>
                <td className="font-semibold">
                  {formatPct(schedules.carried_interest.basic_rate * 100, 0)} /{" "}
                  {formatPct(schedules.carried_interest.higher_rate * 100, 0)} /{" "}
                  {formatPct(schedules.carried_interest.additional_rate * 100, 0)}
                </td>
                <td>
                  Carried interest takes the income tax rates too.{recorded(validation.carried_interest_gains_bn)}
                </td>
              </tr>
              <tr>
                <td>Business Asset Disposal Relief lifetime limit</td>
                <td>£{BASELINE_SCHEDULE_RATES.badr_lifetime_limit.toLocaleString("en-GB")}</td>
                <td className="font-semibold">£{schedules.badr_lifetime_limit.toLocaleString("en-GB")}</td>
                <td>
                  The relief is withdrawn: qualifying gains fall onto the main schedule at the
                  reformed rates.{recorded(validation.badr_gains_bn)}
                </td>
              </tr>
              <tr>
                <td>Annual exempt amount</td>
                <td>£3,000</td>
                <td>£3,000</td>
                <td>Unchanged: the first £3,000 of gains each year stays tax-free.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </details>

      <section className="section-card">
        <SectionHeading
          title="Budgetary impact by year"
          description="Baseline and reform CGT revenue, and the net change in the government balance, for each fiscal year. Baseline revenue grows as the dataset is uprated to each year; the reform raises a broadly stable increment on top."
        />
        <BudgetChart budget={budget} />
        {entrantShare > 0.05 ? (
          <p className="mt-4 text-sm leading-6 text-slate-600">
            {formatPct(100 * entrantShare, 0)} of this dataset&apos;s {firstYear} CGT taxpayers
            are entrants by uprating (see the Baseline tab): people whose base-year gains sit at
            or below the frozen £3,000 exempt amount and cross it once the engine uprates gains.
            They contribute {formatSignedBn(firstYearRow.cgt_change_from_entrants_bn, 2)} of the{" "}
            {firstYear} change ({formatPct(100 * entrantShareOfChange, 0)}), so the revenue
            figures are little affected; the share of people affected is.
          </p>
        ) : null}
      </section>

      <section className="section-card">
        <SectionHeading
          title="Who bears the cost of the reform"
          description="Change in household net income, grouped by the household's position in the baseline income distribution. Almost the entire cost falls on the highest-income group, where realised capital gains are concentrated: losses include both the extra tax paid and the gains that taxpayers choose not to realise in response, so they exceed the revenue raised. The switches show the same change grouped by income quintile or quartile, by household type, or by region."
        />
        <GroupImpactChart groupsByYear={getIncomeChangeGroupsByYear(data)} initialYear={firstYear} />
      </section>

      <details className="section-card group">
        <summary className="cursor-pointer select-none font-semibold text-slate-800 marker:text-[color:var(--pe-color-primary-600)]">
          Sensitivity to the behavioural elasticity
          <span className="ml-2 text-sm font-normal text-slate-500 group-open:hidden">
            (expand to see how the estimate moves with the assumed response)
          </span>
        </summary>
        <div className="mt-4">
          <p className="mb-4 text-sm leading-6 text-slate-600">
            The revenue estimate hinges on how strongly taxpayers reduce
            realisations when rates rise. Each row re-runs the reform with a
            different marginal-tax-rate elasticity of realised gains. The bold
            row is this dashboard&apos;s central assumption, converted from
            CenTax&apos;s central retention-rate elasticity of 1.0 at the
            reformed 40–45% rates. That conversion is exact only for a marginal
            rate change, so applying −0.7 across the full 24%→40% jump is
            somewhat more responsive than CenTax&apos;s own convention implies
            (roughly −0.5 here). The last row is the official HMRC/OBR
            assumption, a retention-rate elasticity of 3.6, applied in that
            convention; the Methodology tab explains why it turns the reform&apos;s
            yield so far down. CenTax&apos;s range is anchored on{" "}
            <a
              href="https://www.aeaweb.org/articles?id=10.1257/aeri.20200535"
              target="_blank"
              rel="noopener noreferrer"
              className="underline decoration-1 underline-offset-2 hover:opacity-80"
            >
              Agersnap &amp; Zidar (2021)
            </a>{" "}
            and{" "}
            <a
              href="https://www.nber.org/papers/w28514"
              target="_blank"
              rel="noopener noreferrer"
              className="underline decoration-1 underline-offset-2 hover:opacity-80"
            >
              Lavecchia &amp; Tazhitdinova (2024)
            </a>
            .
          </p>
        <table className="data-table">
          <thead>
            <tr>
              <th>Scenario</th>
              <TipHeader
                label="MTR elasticity"
                tip="Percentage change in realised gains for a one per cent change in the marginal tax rate. Converted from retention-rate elasticities via e_mtr = −e_retention × t/(1−t)."
              />
              <TipHeader
                label={`CGT revenue, ${firstYear}`}
                tip="Change in capital gains tax revenue in the first year of the reform under this elasticity."
              />
              <th>Source</th>
            </tr>
          </thead>
          <tbody>
            {sensitivity.map((row) => (
              <tr
                key={row.name}
                className={row.e_mtr === -0.7 ? "font-semibold" : ""}
              >
                <td>{row.name}</td>
                <td>{row.e_mtr.toFixed(2)}</td>
                <td>{formatSignedBn(row.revenue_2026_bn)}</td>
                <SourceLink name={row.name} />
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </details>
    </div>
  );
}
