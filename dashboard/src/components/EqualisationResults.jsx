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
  badrLimitLabel,
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
import RateChangeChart, { RateChangeCaption } from "./charts/RateChangeChart";
import YieldChart from "./charts/YieldChart";
import { Card, MetricCard, Notes, SourceLabel, SourceLink, TabLink } from "./controls";
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

  return (
    <div className="space-y-6">
      <Card>
        <SectionHeading
          title="Headline results"
          description={
            <>
              In {firstYear}, the reform&apos;s first year, at{" "}
              <SourceLink href={CENTAX_SOURCE.url}>CenTax&apos;s</SourceLink> central behavioural
              response, on {dataset.shortLabel}. Distributional figures cover all households.
            </>
          }
        />
        <div className={`grid gap-4 ${topQuintile.share_affected_pct !== undefined ? "md:grid-cols-3" : "md:grid-cols-2"}`}>
          <MetricCard
            label="Change in government balance"
            value={formatSignedBn(firstYearRow.gov_balance_change_bn, 1)}
            note="After taxpayers realise fewer gains."
            tip={`Across the behavioural cases in the sensitivity chart, the first-year change in CGT revenue runs from ${formatSignedBn(lowest.revenue_2026_bn, 1)} at ${caseName(lowest)} to ${formatSignedBn(highest.revenue_2026_bn, 1)} at ${caseName(highest)}.`}
          />
          <MetricCard
            label="Average change in net income, top fifth of households"
            value={formatSignedCurrency(topQuintile.avg_change_gbp)}
            note={`${formatSignedPct(topQuintile.relative_change_pct)} of net income; ${formatPct(100 * topShare, 0)} of the total fall in household income.`}
          />
          {topQuintile.share_affected_pct !== undefined ? (
            <MetricCard
              label="Top-fifth households with lower net income"
              value={formatPct(topQuintile.share_affected_pct, 1)}
              note="Households whose net income falls under the reform."
            />
          ) : null}
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
                ) contribute {formatSmallBn(firstYearRow.cgt_change_from_entrants_bn)} of the
                first-year change ({formatPct(100 * entrantShareOfChange, 0)}).
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
            title="Where the yield comes from"
            description={
              <>
                Each bar adds the reform&apos;s parts one at a time in its first year, first with
                no behavioural response and then with{" "}
                <SourceLink href={CENTAX_SOURCE.url}>CenTax&apos;s</SourceLink> central response.
              </>
            }
          />
          <YieldChart steps={split.steps} />
          <Notes>
            <p>
              The main rates come first, then residential property gains, then withdrawing
              Business Asset Disposal <SourceLink href={BADR_GUIDANCE}>Relief</SourceLink>. Each segment is what that change adds once the ones
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
              tab compares them with HMRC&apos;s{" "}
              <SourceLink href={HMRC_TABLE_4}>statistics</SourceLink>.{" "}
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

        <Card as="details" className="group min-w-0 scroll-mt-24" id="sensitivity">
          <summary className="cursor-pointer select-none text-xl font-semibold tracking-tight text-slate-900 marker:text-[color:var(--pe-color-primary-600)]">
            Sensitivity to the behavioural elasticity
            <span className="ml-2 text-sm font-normal text-slate-500 group-open:hidden">
              (expand to see how the result depends on taxpayers&apos; response)
            </span>
          </summary>
          <p className="mb-5 mt-2 text-sm leading-6 text-slate-600">
            Each bar shows the first-year change in CGT revenue under a different assumption about
            how strongly taxpayers cut the gains they realise.
          </p>
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
        <summary className="cursor-pointer select-none text-xl font-semibold tracking-tight text-slate-900 marker:text-[color:var(--pe-color-primary-600)]">
          What exactly does the reform change?
          <span className="ml-2 text-sm font-normal text-slate-500 group-open:hidden">
            (expand for the full specification)
          </span>
        </summary>
        <div className="mt-4 space-y-3">
          <p className="text-sm leading-6 text-slate-600">
            Effective in every modelled year. All results on
            this page compare this reform against current policy on the same baseline. The reformed
            rates are the income tax rates on earnings; from April 2027 savings and property income
            face 22%, 42% and 47% (the property rates in England, Wales and Northern Ireland), and
            Scottish taxpayers&apos; earnings face Scotland&apos;s own bands, which the reform does not
            follow.
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
                baselineNote: `up to a ${badrLimitLabel(BASELINE_SCHEDULE_RATES.badr.lifetime_limit)} lifetime limit`,
                reformNote: schedules.badr.withdrawn
                  ? "qualifying gains, Investors' Relief included, take the main rates above"
                  : undefined,
              },
            ]}
          />
          <RateChangeCaption
            items={[
              `Residential property gains take the same rates as the main ones.${recorded(validation.residential_property_gains_bn)}`,
              <>
                The annual exempt <SourceLink href={EXEMPT_AMOUNT}>amount</SourceLink> stays £3,000.
              </>,
            ]}
          />
        </div>
      </Card>
    </div>
  );
}
