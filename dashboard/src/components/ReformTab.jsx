"use client";

import {
  formatBn,
  formatCount,
  formatElasticity,
  formatPct,
  formatPublished,
  formatSignedBn,
  formatSignedCurrency,
  formatSignedPct,
} from "../lib/formatters";
import {
  BASELINE_SCHEDULE_RATES,
  describeBadr,
  getBenchmarks,
  getBudget,
  getDatasetInfo,
  getEntrants,
  getFirstYear,
  getFiveYearTotal,
  getIncomeChangeGroups,
  getIncomeChangeGroupsByYear,
  getReformSchedules,
  getScheduleSplit,
  getSensitivity,
  getReform,
  getValidation,
} from "../lib/dataHelpers";
import BudgetChart from "./charts/BudgetChart";
import GroupImpactChart from "./charts/GroupImpactChart";
import { MetricCard, TipHeader } from "./controls";
import SectionHeading from "./SectionHeading";

// Where each sensitivity scenario's elasticity comes from: the static case
// has none, the official HMRC/OBR case's source is in the results file's
// benchmarks block, and the rest are CenTax's central case and range.
const CENTAX_SOURCE = {
  label: "Advani, Lonsdale & Summers (2024), CenTax",
  url: "https://centax.org.uk/wp-content/uploads/2024/10/AdvaniLonsdaleSummers2024_CGTReform.pdf#page=38",
};
const STATIC_SOURCE = { label: "None: taxpayers do not respond", url: null };

function officialSource(official) {
  return {
    label: `OBR (${formatPublished(official.published.slice(0, 7))}), ${official.locator.toLowerCase()}`,
    url: `${official.url}#page=3`,
  };
}

function SourceLink({ row, official }) {
  let source = CENTAX_SOURCE;
  if (row.e_retention === 0) source = STATIC_SOURCE;
  else if (row.e_retention === official.e_retention) source = officialSource(official);
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
  const { central, official, centax_range: centaxRange } = getBenchmarks(data).elasticities;
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
  const split = getScheduleSplit(data);
  // Equalisation with the relief kept: the step before it is withdrawn.
  const keptRelief = split.steps.find((row) => row.step === "residential");

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
              {formatPct(reform.additional_rate.reform * 100, 0)}. It also
              withdraws Business Asset Disposal Relief, so gains that qualify for
              it take the new rates too, as in CenTax&apos;s rates-only estimate;
              the table below splits the yield by schedule. Taxpayers
              respond by realising fewer gains, modelled with{" "}
              <a
                href="https://centax.org.uk/wp-content/uploads/2024/10/AdvaniLonsdaleSummers2024_CGTReform.pdf#page=38"
                target="_blank"
                rel="noopener noreferrer"
                className="underline decoration-1 underline-offset-2 hover:opacity-80"
              >
                CenTax&apos;s central elasticity of 1.0
              </a>{" "}
              with respect to the share of each gain they keep, applied in that
              form. CenTax&apos;s elasticity comes from a package that also reforms
              the tax base; for a rate rise alone CenTax expect a larger response,
              which the sensitivity table below explores.
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
            note={`Average of ${formatSignedCurrency(topQuintile.avg_change_gbp)} per household in the highest-income 20%, which holds most realised gains. Includes the gains taxpayers stop realising under the central elasticity, not just tax paid.`}
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
            this page compare this reform against current policy on the same baseline. The reformed
            rates are the income tax rates on earnings; from April 2027 savings and property income
            face 22%, 42% and 47% (the property rates in England, Wales and Northern Ireland), and
            Scottish taxpayers&apos; earnings face Scotland&apos;s own bands, which the reform does not
            follow.
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
                <td>Business Asset Disposal Relief</td>
                <td>{describeBadr(BASELINE_SCHEDULE_RATES.badr)}</td>
                <td className="font-semibold">{describeBadr(schedules.badr)}</td>
                <td>
                  {schedules.badr.withdrawn
                    ? "Gains that qualify for the relief (Investors' Relief included) fall onto the main schedule at the reformed rates."
                    : "Gains that qualify for the relief keep their own rate."}
                  {recorded(validation.badr_gains_bn)}
                </td>
              </tr>
              <tr>
                <td>Carried interest</td>
                <td>Taxed as income since April 2026</td>
                <td>Unchanged</td>
                <td>
                  Carried interest moved from capital gains tax into the income tax framework on 6
                  April 2026, so equalising CGT with income tax leaves it where it is.
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
          title={`Where the yield comes from, ${split.year}`}
          description="The reform built up one schedule at a time: the main rates first, then residential property gains, then withdrawing Business Asset Disposal Relief. Each row is what that change adds once the rows above it are in place, with no behavioural response and at the central elasticity."
        />
        <table className="data-table">
          <thead>
            <tr>
              <th>Step</th>
              <th>Change in CGT, static</th>
              <th>Change in CGT, central elasticity</th>
            </tr>
          </thead>
          <tbody>
            {split.steps.map((row) => (
              <tr key={row.step}>
                <td>{row.label}</td>
                <td>{formatSignedBn(row.static_increment_bn, 1)}</td>
                <td>{formatSignedBn(row.central_increment_bn, 1)}</td>
              </tr>
            ))}
            <tr className="font-semibold">
              <td>The reform</td>
              <td>{formatSignedBn(split.steps.at(-1).static_cgt_change_bn, 1)}</td>
              <td>{formatSignedBn(split.steps.at(-1).central_cgt_change_bn, 1)}</td>
            </tr>
          </tbody>
        </table>
        <p className="mt-4 text-sm leading-6 text-slate-600">
          {validation.badr_gains_bn > 0 ? (
            <>
              On {dataset.shortLabel}, {formatCount(validation.badr_claimants)} people hold{" "}
              {formatBn(validation.badr_gains_bn)} of gains that qualify for the relief in{" "}
              {split.year}; HMRC counted 61,000 claimants and £18.4bn of qualifying gains in
              2024-25 (Capital Gains Tax statistics, Table 4).{" "}
            </>
          ) : (
            <>
              {dataset.shortLabel} records no gains that qualify for the relief, so withdrawing it
              changes nothing here.{" "}
            </>
          )}
          Equalising the rates while keeping the relief at current law raises{" "}
          {formatSignedBn(keptRelief.static_cgt_change_bn, 1)} before behaviour and{" "}
          {formatSignedBn(keptRelief.central_cgt_change_bn, 1)} at the central elasticity: one
          reading of the exemption for genuine entrepreneurs in{" "}
          <a
            href="https://taxjustice.uk/blog/what-would-bunham-mean-for-britain/"
            target="_blank"
            rel="noopener noreferrer"
            className="underline decoration-1 underline-offset-2 hover:opacity-80"
          >
            Wes Streeting&apos;s proposal
          </a>
          , which has not been defined. The Rate explorer scores any rate for the relief, or withdraws it, for every year.
        </p>
      </section>

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
            different elasticity of realised gains with respect to the retention
            rate, the share (1 − t) of each marginal pound of gain a taxpayer
            keeps: the model scales each person&apos;s realised gains by
            ((1 − t₁) / (1 − t₀))<sup>e</sup>, the form CenTax and the OBR state
            their elasticities in. The bold row is this dashboard&apos;s central
            assumption, CenTax&apos;s central {central.e_retention.toFixed(1)}; the
            rows either side are CenTax&apos;s range,{" "}
            {centaxRange.lower.toFixed(1)} to {centaxRange.upper.toFixed(1)}.
            CenTax estimate their elasticity for a package that also removes the
            uplift at death and charges gains on departure, and{" "}
            <a
              href="https://www.nuffieldfoundation.org/wp-content/uploads/2023/03/Taxes-at-the-top-Understanding-what-high-earners-pay-and-options-for-reform.pdf#page=20"
              target="_blank"
              rel="noopener noreferrer"
              className="underline decoration-1 underline-offset-2 hover:opacity-80"
            >
              advise against equalising rates without those reforms
            </a>
            , expecting a larger response to rates alone: the upper rows show how
            much of the yield rests on that. The last row is the official HMRC/OBR
            assumption, {official.e_retention} for main-rate gains and{" "}
            {official.badr_e_retention} for gains qualifying for Business Asset Disposal
            Relief; the Methodology tab explains why it
            turns the reform&apos;s yield so far down. CenTax&apos;s range is
            anchored on{" "}
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
                label="Elasticity, as applied"
                tip="The elasticity of realised gains with respect to the retention rate (1 − t) that the engine applies, as each source states it: realised gains scale by ((1 − t₁) / (1 − t₀)) to the power e, with t the marginal rate on gains."
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
                className={row.e_retention === central.e_retention ? "font-semibold" : ""}
              >
                <td>{row.name}</td>
                <td>{formatElasticity(row)}</td>
                <td>{formatSignedBn(row.revenue_2026_bn)}</td>
                <SourceLink row={row} official={official} />
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </details>
    </div>
  );
}
