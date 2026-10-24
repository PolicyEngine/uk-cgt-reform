"use client";

import { useState } from "react";

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
  badrLimitLabel,
  getBenchmarks,
  getBudget,
  getDatasetInfo,
  getEntrants,
  getBudgetRow,
  getHeadlineYear,
  getIncomeChangeGroups,
  getIncomeChangeGroupsByYear,
  getReformSchedules,
  getScheduleSplit,
  getScheduleSplitYears,
  getSensitivityYears,
  getSensitivity,
  getReform,
  getValidation,
} from "../lib/dataHelpers";
import { colors } from "../lib/colors";
import BudgetChart from "./charts/BudgetChart";
import GroupImpactChart, { GROUP_DESCRIPTION, GroupDefinitions, HOUSEHOLD_COLOR } from "./charts/GroupImpactChart";
import SensitivityChart from "./charts/SensitivityChart";
import RateChangeChart from "./charts/RateChangeChart";
import YieldChart from "./charts/YieldChart";
import { Card, DatasetName, MetricCard, Notes, SourceLabel, SourceLink, TabLink, YearPill } from "./controls";
import SectionHeading from "./SectionHeading";

// Where each sensitivity scenario's elasticity comes from: the static case
// has none, the official HMRC/OBR case's source is in the results file's
// benchmarks block, and the rest are CenTax's central case and range.
const CENTAX_SOURCE = {
  label: "Advani, Lonsdale & Summers (2024), CenTax",
  url: "https://centax.org.uk/wp-content/uploads/2024/10/AdvaniLonsdaleSummers2024_CGTReform.pdf#page=38",
};

const BADR_GUIDANCE = "https://www.gov.uk/business-asset-disposal-relief";
const EXEMPT_AMOUNT = "https://www.gov.uk/capital-gains-tax/allowances";
const HMRC_TABLE_4 =
  "https://assets.publishing.service.gov.uk/media/6a7b242a347b198efd290ed7/Table_4_2026_Business_asset_disposal_and_investors_reliefs.ods";
const OBR_EFO = "https://obr.uk/efo/economic-and-fiscal-outlook-march-2026/";
const SAVINGS_PROPERTY_RATES =
  "https://www.gov.uk/government/publications/changes-to-tax-rates-for-property-savings-and-dividend-income";
const SCOTTISH_INCOME_TAX = "https://www.gov.uk/scottish-income-tax";

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
  const headlineYear = getHeadlineYear(data);
  const headlineGroups = getIncomeChangeGroups(data, headlineYear);
  // The yield and sensitivity sections each have a year select, starting
  // at the headline year; the headline card's range stays on that year.
  const [splitYear, setSplitYear] = useState(headlineYear);
  const [sensitivityYear, setSensitivityYear] = useState(headlineYear);
  const headlineSensitivity = getSensitivity(data, headlineYear);
  const sensitivity = getSensitivity(data, sensitivityYear);
  // A year's chart shows only with every case the headline year has, never
  // a partial set of bars.
  const sensitivityComplete =
    sensitivity.length === headlineSensitivity.length &&
    headlineSensitivity.every((row) => sensitivity.some((r) => r.e_retention === row.e_retention));
  const { central, official, centax_range: centaxRange } = getBenchmarks(data).elasticities;
  const validation = getValidation(data);
  const dataset = getDatasetInfo(data);
  const entrants = getEntrants(data);
  const entrantShare = entrants.count / validation.cgt_taxpayers;
  const headlineRow = getBudgetRow(data, headlineYear);
  const entrantShareOfChange =
    headlineRow.cgt_change_from_entrants_bn / headlineRow.gov_balance_change_bn;
  const deciles = headlineGroups.decile;
  const topDecile = deciles?.at(-1);
  // Deciles hold equal numbers of households, so the top decile's share of
  // the total fall is its average over the sum of the ten averages.
  const topShare = topDecile
    ? topDecile.avg_change_gbp / deciles.reduce((sum, group) => sum + group.avg_change_gbp, 0)
    : null;
  const split = getScheduleSplit(data, splitYear);
  // Equalisation with the relief kept: the step before it is withdrawn.
  const keptRelief = split.steps.find((row) => row.step === "residential");
  // The spread of the yield across the behavioural cases in the
  // sensitivity chart (the static case excluded): the official case and
  // CenTax's upper case can turn it negative.
  const behavioural = headlineSensitivity.filter((row) => row.e_retention !== 0);
  const lowest = behavioural.reduce((a, b) => (b.revenue_bn < a.revenue_bn ? b : a));
  const highest = behavioural.reduce((a, b) => (b.revenue_bn > a.revenue_bn ? b : a));
  const caseName = (row) =>
    row.e_retention === official.e_retention
      ? "the official HMRC/OBR elasticity"
      : `a retention elasticity of ${row.e_retention.toFixed(1)}`;

  return (
    <div className="space-y-6">
      <Card>
        <SectionHeading
          title={`Headline results, ${headlineYear}`}
          description={
            <>
              These figures assume taxpayers realise fewer gains as rates rise, by as much as{" "}
              <SourceLink href={CENTAX_SOURCE.url}>CenTax&apos;s</SourceLink> central estimate, and
              use <DatasetName label={dataset.shortLabel} /> data; the household figures cover every
              UK household.
            </>
          }
        />
        <div className={`grid gap-4 ${topDecile?.share_affected_pct !== undefined ? "md:grid-cols-3" : "md:grid-cols-2"}`}>
          <MetricCard
            label="Change in government balance"
            valueColor={colors.primary[700]}
            value={formatSignedBn(headlineRow.gov_balance_change_bn, 1)}
            note="After taxpayers realise fewer gains."
            tip={`Across the behavioural cases in the sensitivity chart, the ${lowest.year} change in CGT revenue runs from ${formatSignedBn(lowest.revenue_bn, 1)} at ${caseName(lowest)} to ${formatSignedBn(highest.revenue_bn, 1)} at ${caseName(highest)}.`}
          />
          {topDecile ? (
            <MetricCard
              label="Top income decile: average change in net income"
              valueColor={HOUSEHOLD_COLOR}
              value={formatSignedCurrency(topDecile.avg_change_gbp)}
              note={`${formatSignedPct(topDecile.relative_change_pct)} of net income; ${formatPct(100 * topShare, 0)} of the total fall in household income.`}
            />
          ) : null}
          {topDecile?.share_affected_pct !== undefined ? (
            <MetricCard
              label="Top income decile: share with lower net income"
              valueColor={HOUSEHOLD_COLOR}
              value={formatPct(topDecile.share_affected_pct, 1)}
              note="Households in the top income decile whose net income falls."
            />
          ) : null}
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="flex min-w-0 flex-col">
          <SectionHeading
            title={`Budgetary impact by year, ${budget[0].year} to ${budget.at(-1).year}`}
            description="Each bar shows the change in the government's balance in one fiscal year, after taxpayers realise fewer gains."
          />
          <BudgetChart budget={budget} />
          <Notes className="mt-auto">
            <p>
              Baseline revenue grows as gains are uprated with the OBR&apos;s{" "}
              <SourceLink href={OBR_EFO}>forecast</SourceLink> of GDP per head;{" "}
              <TabLink onNavigate={onNavigate} tab="methodology" section="projection">
                Methodology
              </TabLink>{" "}
              describes the projection.
            </p>
            <BeyondForecastNote />
            {entrantShare > 0.05 ? (
              <p>
                Entrants by uprating (see{" "}
                <TabLink onNavigate={onNavigate} tab="methodology" section="new-taxpayers">
                  Methodology
                </TabLink>
                ) contribute {formatSmallBn(headlineRow.cgt_change_from_entrants_bn)} of the{" "}
                {headlineYear} change ({formatPct(100 * entrantShareOfChange, 0)}).
              </p>
            ) : null}
          </Notes>
        </Card>

        <Card className="flex min-w-0 flex-col">
          <GroupImpactChart
            groupsByYear={getIncomeChangeGroupsByYear(data)}
            defaultYear={headlineYear}
            description={GROUP_DESCRIPTION}
          />
          <Notes className="mt-auto">
            <GroupDefinitions>
              <li>
                Gains that taxpayers no longer realise count as lower income, alongside the extra
                tax paid, so the total fall in net income exceeds the revenue raised.
              </li>
            </GroupDefinitions>
          </Notes>
        </Card>
      </div>

        <Card className="min-w-0">
          <SectionHeading
            title={`Where the yield comes from, ${split.year}`}
            action={
              <YearSelect years={getScheduleSplitYears(data)} value={splitYear} onChange={setSplitYear} />
            }
            description={
              <>
                Each bar is the reform&apos;s whole change in CGT revenue, split into its three
                parts in the order they are applied: income tax rates on most gains, then on
                residential property gains, then withdrawing the relief. The top bar has no
                behavioural response; the bottom one uses{" "}
                <SourceLink href={CENTAX_SOURCE.url}>CenTax&apos;s</SourceLink> central response.
              </>
            }
          />
          <YieldChart key={splitYear} steps={split.steps} />
          <Notes>
            <p>Each segment is what that step adds once the ones before it are in place.</p>
            {validation.badr_gains_bn > 0 ? (
              <p>
                <DatasetName label={dataset.shortLabel} /> charges gains qualifying for Business Asset
                Disposal{" "}
                <SourceLink href={BADR_GUIDANCE}>Relief</SourceLink> on their own schedule; the{" "}
                <TabLink onNavigate={onNavigate} tab="baseline" section="benchmarks">
                  Baseline
                </TabLink>{" "}
                tab compares them with HMRC&apos;s{" "}
                <SourceLink href={HMRC_TABLE_4}>statistics</SourceLink>.
              </p>
            ) : (
              <p>
                {dataset.shortLabel} records no gains that qualify for Business Asset Disposal{" "}
                <SourceLink href={BADR_GUIDANCE}>Relief</SourceLink>, so withdrawing it
                changes nothing here.
              </p>
            )}
            <p>
              Equalising the rates but keeping the relief changes CGT revenue by{" "}
              {formatSignedBn(keptRelief.static_cgt_change_bn, 1)} with no behavioural response and{" "}
              {formatSignedBn(keptRelief.central_cgt_change_bn, 1)} at the central elasticity;{" "}
              <TabLink onNavigate={onChooseCustom}>Custom</TabLink> rates can score any rate for the
              relief.
            </p>
          </Notes>
        </Card>

        <Card as="details" className="group relative min-w-0 scroll-mt-24" id="sensitivity">
          <summary className="cursor-pointer select-none text-xl font-semibold tracking-tight text-slate-900 marker:text-[color:var(--pe-color-primary-600)] sm:group-open:pr-40">
            {`Sensitivity to the behavioural response, ${sensitivityYear}`}
            <span className="ml-2 text-sm font-normal text-slate-500 group-open:hidden">
              (expand to see how the result depends on taxpayers&apos; response)
            </span>
          </summary>
          {/* The year select sits right of the title once the section is open
              (it stacks under the title on phones). */}
          <div className="mt-3 sm:absolute sm:right-6 sm:top-4 sm:mt-0">
            <YearSelect years={getSensitivityYears(data)} value={sensitivityYear} onChange={setSensitivityYear} />
          </div>
          <p className="mb-5 mt-2 text-sm leading-6 text-slate-600">
            Each bar shows the change in CGT revenue under a different assumption about how
            strongly taxpayers cut the gains they realise.
          </p>
          {sensitivityComplete ? (
            <SensitivityChart key={sensitivityYear} rows={sensitivity} centralRetention={central.e_retention} />
          ) : (
            <p className="text-sm text-slate-500">The sensitivity runs for {sensitivityYear} are not in this results file.</p>
          )}
          <Notes>
          <p>
            Each bar re-runs the reform with a different elasticity of realised gains with respect
            to the retention{" "}
            <TabLink onNavigate={onNavigate} tab="methodology" section="elasticity">
              rate
            </TabLink>{" "}
            (1 − t).
          </p>
          <p>
            The dark bar is the dashboard&apos;s central assumption, CenTax&apos;s central{" "}
            {central.e_retention.toFixed(1)}; the bars either side are CenTax&apos;s range,{" "}
            {centaxRange.lower.toFixed(1)} to {centaxRange.upper.toFixed(1)}, from{" "}
            <SourceLabel href={CENTAX_SOURCE.url} label="CenTax" />, anchored on{" "}
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
          <p>
            The last bar is the official HMRC/OBR assumption (
            <SourceLabel href={officialSource(official).url} label="OBR" />, January 2025, para
            1.9);{" "}
            <TabLink onNavigate={onNavigate} tab="methodology" section="elasticity-gap">
              Methodology
            </TabLink>{" "}
            describes both elasticities and the{" "}
            <TabLink onNavigate={onNavigate} tab="methodology" section="elasticity">
              scope
            </TabLink>{" "}
            of CenTax&apos;s central value.
          </p>
          </Notes>
        </Card>
    </div>
  );
}

// The modelled window's last year lies beyond the OBR's forecast: the one
// extrapolation in the projection, stated under each budget chart.
export function BeyondForecastNote() {
  return (
    <p>
      The OBR&apos;s <SourceLink href={OBR_EFO}>forecast</SourceLink> ends in 2030-31, so in
      2031-32 gains grow at its 2030-31 growth rate of GDP per head (3.15%).
    </p>
  );
}

// The compact year select the per-year sections share; none when the
// results cover a single year.
function YearSelect({ years, value, onChange }) {
  if (years.length < 2) return null;
  return (
    <YearPill years={years} value={value} onChange={onChange} />
  );
}

// The class of the specification's summary line, shared with a live run's.
export const SPEC_SUMMARY =
  "cursor-pointer select-none text-base font-semibold tracking-tight text-slate-900 marker:text-[color:var(--pe-color-primary-600)]";

// The precomputed reform's full specification, folded: it sits in the
// "Choose a reform" panel under the one-line summary once results show.
export function EqualisationSpec({ data }) {
  const reform = getReform(data);
  const schedules = getReformSchedules(data);
  const validation = getValidation(data);
  const dataset = getDatasetInfo(data);
  const recorded = (gains) => (gains > 0 ? "" : ` ${dataset.shortLabel} records no such gains, so this line is inert here.`);
  return (
    <details className="group">
      <summary className={SPEC_SUMMARY}>
        What does the reform change?
        <span className="ml-2 text-sm font-normal text-slate-500 group-open:hidden">
          (expand for the full specification)
        </span>
      </summary>
      <div className="mt-4 space-y-3">
        <p className="text-sm leading-6 text-slate-600">
          Effective in every modelled year. All results on
          this page compare this reform with current policy on the same baseline. The reformed
          rates are the income tax rates on earnings; from April 2027 savings and property{" "}
          <SourceLink href={SAVINGS_PROPERTY_RATES}>income</SourceLink> face 22%, 42% and 47% (the
          property rates in England, Wales and Northern Ireland), and Scottish taxpayers&apos;
          earnings face Scotland&apos;s own <SourceLink href={SCOTTISH_INCOME_TAX}>bands</SourceLink>,
          which the reform does not follow. Residential property gains take the same rates, and the annual exempt{" "}
          <SourceLink href={EXEMPT_AMOUNT}>amount</SourceLink> stays £3,000.
          {recorded(validation.residential_property_gains_bn)}
        </p>
        <RateChangeChart
          rows={[
            { key: "basic", label: "Basic rate", baseline: reform.basic_rate.baseline, reform: reform.basic_rate.reform },
            { key: "higher", label: "Higher rate", baseline: reform.higher_rate.baseline, reform: reform.higher_rate.reform },
            {
              key: "additional",
              label: "Additional rate (income over £125,140)",
              baseline: reform.additional_rate.baseline,
              reform: reform.additional_rate.reform,
            },
            {
              key: "badr",
              label: "Business Asset Disposal Relief",
              baseline: BASELINE_SCHEDULE_RATES.badr.rate,
              reform: schedules.badr.withdrawn ? null : schedules.badr.rate,
              baselineNote: `${badrLimitLabel(BASELINE_SCHEDULE_RATES.badr.lifetime_limit)} lifetime limit`,
              reformNote: schedules.badr.withdrawn ? "gains pay the main rates" : undefined,
            },
          ]}
        />
      </div>
    </details>
  );
}
