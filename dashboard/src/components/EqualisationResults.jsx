"use client";

import {
  formatPct,
  formatPublished,
  formatSignedBn,
  formatSignedCurrency,
  formatSignedPct,
  formatSmallBn,
} from "../lib/formatters";
import {
  BASELINE_SCHEDULE_RATES,
  describeBadr,
  getBenchmarks,
  getBudget,
  getDatasetInfo,
  getEntrants,
  getFirstYear,
  getIncomeChangeGroups,
  getIncomeChangeGroupsByYear,
  getReformSchedules,
  getScheduleSplit,
  getSensitivity,
  getReform,
  getValidation,
} from "../lib/dataHelpers";
import BudgetChart from "./charts/BudgetChart";
import GroupImpactChart, { GroupDefinitions } from "./charts/GroupImpactChart";
import SensitivityChart from "./charts/SensitivityChart";
import YieldChart from "./charts/YieldChart";
import { Card, MetricCard, Notes, SourceLabel, TabLink, TableScroll } from "./controls";
import SectionHeading from "./SectionHeading";

// Where each sensitivity scenario's elasticity comes from: the static case
// has none, the official HMRC/OBR case's source is in the results file's
// benchmarks block, and the rest are CenTax's central case and range.
const CENTAX_SOURCE = {
  label: "Advani, Lonsdale & Summers (2024), CenTax",
  url: "https://centax.org.uk/wp-content/uploads/2024/10/AdvaniLonsdaleSummers2024_CGTReform.pdf#page=38",
};

function officialSource(official) {
  return {
    // The 3.6 and 1.4 are in para 1.9, on PDF p.3; the results file's locator
    // also names Table 1.1, which is on p.5, so the label names the paragraph.
    label: `OBR (${formatPublished(official.published.slice(0, 7))}), para 1.9`,
    url: `${official.url}#page=3`,
  };
}

// The Reform tab's precomputed results: equalisation with income tax, as the
// pipeline scored it, with the detail a live run does not produce (the yield
// by schedule and the sensitivity to the elasticity).
export default function EqualisationResults({ data, onNavigate, onChooseCustom }) {
  const budget = getBudget(data);
  const firstYear = getFirstYear(data);
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
  // Quintiles hold equal numbers of households, so the top fifth's share of
  // the total fall is its average over the sum of the five averages.
  const topShare =
    topQuintile.avg_change_gbp / headlineGroups.quintile.reduce((sum, group) => sum + group.avg_change_gbp, 0);
  const split = getScheduleSplit(data);
  // Equalisation with the relief kept: the step before it is withdrawn.
  const keptRelief = split.steps.find((row) => row.step === "residential");
  // The spread of the first-year yield across the behavioural cases in the
  // sensitivity chart (the static case excluded): the official case and
  // CenTax's upper case can turn it negative.
  const behavioural = sensitivity.filter((row) => row.e_retention !== 0);
  const lowest = behavioural.reduce((a, b) => (b.revenue_2026_bn < a.revenue_2026_bn ? b : a));
  const highest = behavioural.reduce((a, b) => (b.revenue_2026_bn > a.revenue_2026_bn ? b : a));
  const caseName = (row) =>
    row.e_retention === official.e_retention
      ? "the official HMRC/OBR elasticity"
      : `a retention elasticity of ${row.e_retention.toFixed(1)}`;
  const pct = (rate) => formatPct(rate * 100, 0);

  return (
    <div className="space-y-6">
      <Card>
        <SectionHeading
          title="Headline results"
          description={`For the reform's first year, at CenTax's central behavioural response, on ${dataset.shortLabel}. Distributional figures cover all households.`}
        />
        <div className="grid gap-4 md:grid-cols-2">
          <MetricCard
            label="Change in government balance"
            value={formatSignedBn(firstYearRow.gov_balance_change_bn, 1)}
            note="After taxpayers realise fewer gains."
            tip={`Across the behavioural cases in the sensitivity chart, the first-year change in CGT revenue runs from ${formatSignedBn(lowest.revenue_2026_bn, 1)} at ${caseName(lowest)} to ${formatSignedBn(highest.revenue_2026_bn, 1)} at ${caseName(highest)}.`}
          />
          <MetricCard
            label="Share of the fall in household income borne by the top fifth"
            value={formatPct(100 * topShare, 0)}
            note={`Households in the top fifth lose ${formatSignedCurrency(topQuintile.avg_change_gbp)} (${formatSignedPct(topQuintile.relative_change_pct)} of net income) on average.`}
          />
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="flex min-w-0 flex-col">
          <SectionHeading
            title="Budgetary impact by year"
            description="Each bar shows the change in the government's balance in one fiscal year, after taxpayers realise fewer gains."
          />
          <BudgetChart budget={budget} />
          <Notes className="mt-auto">
            <p>
              Baseline revenue grows as the engine uprates the dataset to each year; the{" "}
              <TabLink onNavigate={onNavigate} tab="methodology" section="pathway">
                Methodology
              </TabLink>{" "}
              tab compares that projection with the OBR&apos;s forecast.
            </p>
            {entrantShare > 0.05 ? (
              <p>
                Entrants by uprating (
                see the{" "}
                <TabLink onNavigate={onNavigate} tab="baseline" section="entrants">
                  Baseline
                </TabLink>{" "}
                tab
                ) contribute {formatSmallBn(firstYearRow.cgt_change_from_entrants_bn)} of the{" "}
                {firstYear} change ({formatPct(100 * entrantShareOfChange, 0)}).
              </p>
            ) : null}
          </Notes>
        </Card>

        <Card className="flex min-w-0 flex-col">
          <SectionHeading
            title="Change in household net income by income group"
            description="Each bar shows the average change in net income for one group of households, ranked by income before the reform."
          />
          <GroupImpactChart groupsByYear={getIncomeChangeGroupsByYear(data)} initialYear={firstYear} />
          <Notes className="mt-auto">
            <GroupDefinitions />
            <p>
              The switches group households by income quintile or quartile, household type or
              region. Gains that taxpayers no longer realise in response to the higher rates count
              as lower income in the year, alongside the extra tax paid, so the total fall in net
              income exceeds the revenue raised.
            </p>
          </Notes>
        </Card>
      </div>

        <Card className="min-w-0">
          <SectionHeading
            title="Where the yield comes from"
            description="Each bar adds the reform's parts one at a time in its first year, first with no behavioural response and then with CenTax's central response."
          />
          <YieldChart steps={split.steps} />
          <Notes>
            <p>
              The main rates come first, then residential property gains, then withdrawing
              Business Asset Disposal Relief. Each segment is what that change adds once the ones
              before it are in place, with no behavioural response and at the central elasticity.
            </p>
            <p>
          {validation.badr_gains_bn > 0 ? (
            <>
              On {dataset.shortLabel}, the relief&apos;s qualifying gains are charged on their own
              schedule; the{" "}
              <TabLink onNavigate={onNavigate} tab="baseline" section="benchmarks">
                Baseline
              </TabLink>{" "}
              tab compares them with HMRC&apos;s statistics.{" "}
            </>
          ) : (
            <>
              {dataset.shortLabel} records no gains that qualify for the relief, so withdrawing it
              changes nothing here.{" "}
            </>
          )}
          Equalising the rates while keeping the relief at current law changes CGT revenue by{" "}
          {formatSignedBn(keptRelief.static_cgt_change_bn, 1)} before behaviour and{" "}
          {formatSignedBn(keptRelief.central_cgt_change_bn, 1)} at the central elasticity.{" "}
          <TabLink onNavigate={onChooseCustom}>Custom</TabLink> rates scores any rate for the
          relief, or withdraws it, for every year.
            </p>
          </Notes>
        </Card>

        <Card className="min-w-0 scroll-mt-24" id="sensitivity">
          <SectionHeading
            title="Sensitivity to the behavioural elasticity"
            description="Each bar shows the first-year change in CGT revenue under a different assumption about how strongly taxpayers cut the gains they realise."
          />
          <SensitivityChart rows={sensitivity} centralRetention={central.e_retention} />
          <Notes>
          <p>
            The revenue estimate depends on how strongly taxpayers reduce
            realisations when rates rise. Each row re-runs the reform with a
            different elasticity of realised gains with respect to the{" "}
            retention{" "}
            <TabLink onNavigate={onNavigate} tab="methodology" section="elasticity">
              rate
            </TabLink>{" "}
            (1 − t). The dark bar is this dashboard&apos;s central assumption,
            CenTax&apos;s central {central.e_retention.toFixed(1)}; the bars either
            side are CenTax&apos;s range, {centaxRange.lower.toFixed(1)} to{" "}
            {centaxRange.upper.toFixed(1)}, from{" "}
            <SourceLabel href={CENTAX_SOURCE.url} label="CenTax" />. The last bar is the official
            HMRC/OBR assumption, from the{" "}
            <SourceLabel href={officialSource(official).url} label="OBR" /> (January 2025, para
            1.9). The{" "}
            <TabLink onNavigate={onNavigate} tab="methodology" section="elasticity-gap">
              Methodology
            </TabLink>{" "}
            tab explains how the official elasticity and CenTax&apos;s differ and{" "}
            <TabLink onNavigate={onNavigate} tab="methodology" section="elasticity">
              why
            </TabLink>{" "}
            CenTax expect a larger response to a rate rise on its own.{" "}
            CenTax&apos;s range is
            anchored on{" "}
            <a
              href="https://www.aeaweb.org/articles?id=10.1257/aeri.20200535"
              target="_blank"
              rel="noopener noreferrer"
              className="underline decoration-1 underline-offset-2 hover:opacity-80"
            >
              Agersnap
            </a>{" "}
            &amp; Zidar (2021) and{" "}
            <a
              href="https://www.nber.org/papers/w28514"
              target="_blank"
              rel="noopener noreferrer"
              className="underline decoration-1 underline-offset-2 hover:opacity-80"
            >
              Lavecchia
            </a>{" "}
            &amp; Tazhitdinova (2024).
          </p>
          </Notes>
        </Card>

      <Card as="details" className="group">
        <summary className="cursor-pointer select-none font-semibold text-slate-800 marker:text-[color:var(--pe-color-primary-600)]">
          What exactly does the reform change?
          <span className="ml-2 text-sm font-normal text-slate-500 group-open:hidden">
            (expand for the full specification)
          </span>
        </summary>
        <div className="mt-4 space-y-3">
          <p className="text-sm leading-6 text-slate-600">
            Effective from the {firstYear} fiscal year and held in place through {budget.at(-1).year}. All results on
            this page compare this reform against current policy on the same baseline. The reformed
            rates are the income tax rates on earnings; from April 2027 savings and property income
            face 22%, 42% and 47% (the property rates in England, Wales and Northern Ireland), and
            Scottish taxpayers&apos; earnings face Scotland&apos;s own bands, which the reform does not
            follow.
          </p>
          <TableScroll>
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
                <td>Gains falling in the basic income tax band are taxed at the {pct(reform.basic_rate.reform)} basic income tax rate.</td>
              </tr>
              <tr>
                <td>Higher CGT rate</td>
                <td>{formatPct(reform.higher_rate.baseline * 100, 0)}</td>
                <td className="font-semibold">{formatPct(reform.higher_rate.reform * 100, 0)}</td>
                <td>Gains in the higher band are taxed at the {pct(reform.higher_rate.reform)} higher income tax rate.</td>
              </tr>
              <tr>
                <td>Additional CGT rate</td>
                <td>{formatPct(reform.additional_rate.baseline * 100, 0)}</td>
                <td className="font-semibold">{formatPct(reform.additional_rate.reform * 100, 0)}</td>
                <td>Gains in the additional band (income over £125,140) are taxed at the {pct(reform.additional_rate.reform)} additional income tax rate.</td>
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
                <td>Annual exempt amount</td>
                <td>£3,000</td>
                <td>£3,000</td>
                <td>Unchanged: the first £3,000 of gains each year stays tax-free.</td>
              </tr>
            </tbody>
          </table>
          </TableScroll>
        </div>
      </Card>
    </div>
  );
}
