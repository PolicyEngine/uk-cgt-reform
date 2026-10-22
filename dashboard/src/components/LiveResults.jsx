"use client";

import { useState } from "react";

import {
  BASELINE_SCHEDULE_RATES,
  badrLimitLabel,
  getBudget,
  getEntrants,
  getFiveYearTotal,
  getValidation,
} from "../lib/dataHelpers";
import {
  formatPct,
  formatSignedBn,
  formatSmallBn,
  formatSignedCurrency,
  formatSignedMn,
  formatSignedPct,
} from "../lib/formatters";
import {
  BADR_CURRENT_LAW,
  BANDS,
  READY_RECKONER,
  elasticityOption,
  readyReckonerRowFor,
  sameElasticity,
} from "../lib/schedule";
import { colors } from "../lib/colors";
import BudgetChart from "./charts/BudgetChart";
import ChartLegend from "./charts/ChartLegend";
import RateChangeChart from "./charts/RateChangeChart";
import GroupImpactChart, { GroupDefinitions } from "./charts/GroupImpactChart";
import { Card, MetricCard, Notes, SourceLink, TabLink } from "./controls";
import SectionHeading from "./SectionHeading";

const EXEMPT_AMOUNT = "https://www.gov.uk/capital-gains-tax/allowances";

const elasticityName = (e) => elasticityOption(e)?.label ?? `retention elasticity ${e}`;

// Where a live run stands: a cache lookup for a shared link, a computation,
// or an error; a finished run shows its results instead.
export function StatusLine({ status, error }) {
  if (status === "checking") {
    return (
      <p className="mt-4 text-sm leading-6 text-slate-600" role="status">
        Looking for a stored result for this schedule…
      </p>
    );
  }
  if (status === "not_cached") {
    return (
      <p className="mt-4 text-sm leading-6 text-slate-600" role="status">
        Nobody has run this schedule yet, and a link does not start a computation on its own.
        Press Calculate to compute it; it should take 1–2 minutes.
      </p>
    );
  }
  if (status === "running") {
    return (
      <div className="mt-6 flex flex-col items-center gap-3 py-6 text-center" role="status">
        <span
          aria-hidden="true"
          className="h-8 w-8 animate-spin rounded-full border-[3px] border-slate-200 border-t-[color:var(--pe-color-primary-600)]"
        />
        <p className="text-base font-semibold text-slate-800">Processing…</p>
        <p className="text-sm text-slate-500">This should take 1–2 minutes.</p>
      </div>
    );
  }
  if (status === "error") {
    return (
      <p className="mt-4 text-sm leading-6 text-red-700" role="alert">
        {error}
      </p>
    );
  }
  return null;
}

// This schedule against current law, as the rate chart the equalisation
// results use: each band, then the relief.
function ScheduleRates({ metadata }) {
  const baseline = metadata.baseline_rates;
  const reform = metadata.reform;
  const baselineBadr = metadata.baseline_badr ?? BASELINE_SCHEDULE_RATES.badr;
  const reformBadr = metadata.reform_badr ?? BASELINE_SCHEDULE_RATES.badr;
  return (
    <>
      <RateChangeChart
        rows={[
          ...BANDS.map((band) => ({
            key: band.key,
            label: band.label,
            baseline: baseline[band.key],
            reform: reform[band.key],
          })),
          {
            key: "badr",
            label: "Business Asset Disposal Relief",
            baseline: baselineBadr.rate,
            reform: reformBadr.withdrawn ? null : reformBadr.rate,
            baselineNote: `${badrLimitLabel(baselineBadr.lifetime_limit)} lifetime limit`,
            reformNote: reformBadr.withdrawn
              ? "gains pay the main rates"
              : `${badrLimitLabel(reformBadr.lifetime_limit)} lifetime limit`,
          },
        ]}
      />
    </>
  );
}

// HMRC's figures for the ready-reckoner row this run matches. HMRC reports
// receipts, which arrive about a year after the liability, so each HMRC year
// sits beside the run's liability a year earlier.
// HMRC's receipts beside this run's change in the government balance, one
// pair of bars per year, on one £m scale centred on £0.
function ReckonerBars({ rows }) {
  const [hover, setHover] = useState(null);
  const max = Math.max(1, ...rows.flatMap((r) => [Math.abs(r.hmrc ?? 0), Math.abs(r.run ?? 0)]));
  const series = [
    { key: "hmrc", label: "HMRC receipts", fill: colors.gray[700], text: colors.gray[800] },
    { key: "run", label: "This run, change in government balance", fill: colors.primary[600], text: colors.primary[700] },
  ];
  return (
    <>
      <ul className="space-y-4">
        {rows.map((r) => (
          <li key={r.key}>
            <p className="mb-1 text-sm font-semibold text-slate-800">{r.label}</p>
            {series.map((s) => {
              const v = r[s.key];
              const id = `${r.key}-${s.key}`;
              // The longest bar takes 38% of the row, leaving room for its label.
              const width = (38 * Math.abs(v ?? 0)) / max;
              const end = v < 0 ? 50 - width : 50 + width;
              return (
                <div key={s.key} className="relative flex h-6 items-center">
                  <span aria-hidden="true" className="absolute left-1/2 top-0 h-full w-px bg-slate-300" />
                  <span
                    tabIndex={0}
                    aria-label={`${r.label}, ${s.label}: ${formatSignedMn(v)}`}
                    onMouseEnter={() => setHover(id)}
                    onMouseLeave={() => setHover(null)}
                    onFocus={() => setHover(id)}
                    onBlur={() => setHover(null)}
                    className="absolute h-3.5 cursor-default rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--pe-color-primary-500)]"
                    style={{
                      background: s.fill,
                      width: `${Math.max(width, 0.4)}%`,
                      left: v < 0 ? `${50 - width}%` : "50%",
                      opacity: hover && hover !== id ? 0.55 : 1,
                    }}
                  />
                  <span
                    aria-hidden="true"
                    className="absolute text-xs font-semibold tabular-nums"
                    style={{
                      color: s.text,
                      ...(v < 0 ? { right: `${50 + width}%`, marginRight: 6 } : { left: `${50 + width}%`, marginLeft: 6 }),
                    }}
                  >
                    {formatSignedMn(v)}
                  </span>
                  {hover === id ? (
                    <span
                      role="tooltip"
                      className="pointer-events-none absolute bottom-full z-20 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg"
                      style={{ left: `${(50 + end) / 2}%` }}
                    >
                      <span className="block font-semibold text-slate-800">{r.label}</span>
                      <span className="mt-0.5 flex items-center gap-1.5 text-slate-600">
                        <span aria-hidden="true" className="inline-block h-2 w-2 rounded-sm" style={{ background: s.fill }} />
                        {s.label}: <span className="font-semibold tabular-nums text-slate-900">{formatSignedMn(v)}</span>
                      </span>
                    </span>
                  ) : null}
                </div>
              );
            })}
          </li>
        ))}
      </ul>
      <ChartLegend items={series.map((s) => ({ label: s.label, fill: s.fill }))} />
    </>
  );
}

function ReadyReckonerPanel({ row, result, onNavigate }) {
  const liability = (year) =>
    1000 * result.budget.find((budgetRow) => budgetRow.year === year).gov_balance_change_bn;
  const [contextYear] = READY_RECKONER.hmrc_years;
  return (
    <Card as="details" className="group min-w-0">
      <summary className="cursor-pointer select-none text-xl font-semibold tracking-tight text-slate-900 marker:text-[color:var(--pe-color-primary-600)]">
        HMRC ready reckoner
        <span className="ml-2 text-sm font-normal text-slate-500 group-open:hidden">
          (expand to compare with HMRC&apos;s figures)
        </span>
      </summary>
      <p className="mb-4 mt-2 text-sm leading-6 text-slate-600">
        <>
          {`${row.label}: `}
          <SourceLink href={READY_RECKONER.url}>HMRC&apos;s</SourceLink>
          {" receipts beside this run's change in the government balance a year earlier; bars left of £0 lose revenue."}
        </>
      </p>
      <ReckonerBars
        rows={READY_RECKONER.lag.map((lag) => ({
          key: lag.hmrc_year,
          label: `HMRC ${lag.hmrc_year} receipts vs this run's ${lag.model_year}`,
          hmrc: row.hmrc_m[lag.hmrc_year],
          run: liability(lag.model_year),
        }))}
      />
      <Notes>
        <p>
          HMRC&apos;s <SourceLink href={READY_RECKONER.url}>figures</SourceLink> ({READY_RECKONER.source}) are {READY_RECKONER.measure[0].toLowerCase()}
          {READY_RECKONER.measure.slice(1)}, after behavioural responses; HMRC has deferred its 2026
          edition, so they are provisional. HMRC reports receipts, which arrive about a year after
          the liability. The{" "}
          <TabLink onNavigate={onNavigate} tab="benchmarks">
            Benchmarks
          </TabLink>{" "}
          tab scores every row at the central and the official
          elasticity.
        </p>
        <p>
          {`HMRC's ${contextYear} figure, receipts in the reform's first year: ${formatSignedMn(row.hmrc_m[contextYear])}.`}
        </p>
      </Notes>
    </Card>
  );
}

// "£6.8bn less than", "£1.2bn more than": a schedule's figure (£bn) against
// equalisation's, to the precision the cards show.
function difference(value, reference) {
  const gap = value - reference;
  if (Math.abs(gap) < 0.05) return "the same";
  return `${formatSignedBn(Math.abs(gap), 1)} ${gap > 0 ? "more" : "less"}`;
}

// The Reform tab's results for a schedule run live. Equalisation's own
// figures have their home in the precomputed results; here the schedule is
// set against them as differences, with a button to show them.
export default function LiveResults({ data, result, onNavigate, onShowEqualisation }) {
  const firstYear = result.budget[0].year;
  const firstRow = result.budget[0];
  const topQuintile = result.income_change_groups[firstYear].quintile.at(-1);
  // Quintiles hold equal numbers of households, so the top fifth's share of
  // the total fall is its average over the sum of the five averages.
  const quintiles = result.income_change_groups[firstYear].quintile;
  const topShare = topQuintile.avg_change_gbp / quintiles.reduce((sum, group) => sum + group.avg_change_gbp, 0);
  const resultE = result.metadata.elasticity;
  const reformBadr = result.metadata.reform_badr ?? BADR_CURRENT_LAW;
  const matchedRow = readyReckonerRowFor(result.metadata.reform, reformBadr);
  const entrantShare = getEntrants(data).count / getValidation(data).cgt_taxpayers;
  // Equalisation's precomputed figures, which ran at the results file's elasticity.
  const equalisation = {
    elasticity: data.metadata.elasticity,
    revenue: getBudget(data)[0].gov_balance_change_bn,
    fiveYear: getFiveYearTotal(data),
  };
  const likeForLike = sameElasticity(resultE, equalisation.elasticity);
  const bn = (value) => formatSignedBn(value, 1);

  return (
    <>
      <Card>
        <SectionHeading
          title="Headline results"
          description={
            <>
              {`${firstYear}, on ${result.metadata.dataset_short_label}, ${elasticityName(resultE)}. `}
              {likeForLike
                ? `Against equalisation at the same response: ${difference(firstRow.gov_balance_change_bn, equalisation.revenue)} in ${firstYear} and ${difference(result.five_year_total_bn, equalisation.fiveYear)} over five years. `
                : "Equalisation's results use another response, so they are not compared here. "}
              <TabLink onNavigate={onShowEqualisation}>Show</TabLink> equalisation&apos;s results.
            </>
          }
        />
        <div className={`grid gap-4 ${topQuintile.share_affected_pct !== undefined ? "md:grid-cols-3" : "md:grid-cols-2"}`}>
          <MetricCard
            label="Change in government balance"
            value={bn(firstRow.gov_balance_change_bn)}
            note={Number(resultE) === 0 ? "With no behavioural response." : "After the behavioural response."}
          />
          <MetricCard
            label="Top fifth of households: average change in net income"
            value={formatSignedCurrency(topQuintile.avg_change_gbp)}
            note={`${formatSignedPct(topQuintile.relative_change_pct)} of net income; ${formatPct(100 * topShare, 0)} of the total fall in household income.`}
          />
          {topQuintile.share_affected_pct !== undefined ? (
            <MetricCard
              label="Top fifth of households: share with lower net income"
              value={formatPct(topQuintile.share_affected_pct, 1)}
              note="Households in the top fifth whose net income falls."
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
          <BudgetChart budget={result.budget} />
          {entrantShare > 0.05 ? (
            <Notes className="mt-auto">
              <p>
                Entrants by uprating (
                see the{" "}
                <TabLink onNavigate={onNavigate} tab="baseline" section="entrants">
                  Baseline
                </TabLink>{" "}
                tab
                ) contribute {formatSmallBn(firstRow.cgt_change_from_entrants_bn)} of the
                first-year change.
              </p>
            </Notes>
          ) : null}
        </Card>

        <Card className="flex min-w-0 flex-col">
          <SectionHeading
            title="Change in household net income by income group"
            description="Each bar shows the average change in net income for one group of households, ranked by income before the reform."
          />
          <GroupImpactChart groupsByYear={result.income_change_groups} initialYear={firstYear} />
          <Notes className="mt-auto">
            <GroupDefinitions>
              <li>
                Changes in the gains taxpayers realise count as changes in income, alongside the
                change in tax paid.
              </li>
            </GroupDefinitions>
          </Notes>
        </Card>
      </div>

      {/* The specification's long text needs the full width, so the ready
          reckoner sits under it rather than beside it. */}
      <Card as="details" className="group min-w-0">
        <summary className="cursor-pointer select-none text-xl font-semibold tracking-tight text-slate-900 marker:text-[color:var(--pe-color-primary-600)]">
          What exactly does this schedule change?
          <span className="ml-2 text-sm font-normal text-slate-500 group-open:hidden">
            (expand for the full specification)
          </span>
        </summary>
        <div className="mt-4 space-y-3">
          <p className="text-sm leading-6 text-slate-600">
            Effective in every modelled year. Current law is read from the installed engine for
            the first year. Residential property gains take the same rates, and the annual exempt{" "}
            <SourceLink href={EXEMPT_AMOUNT}>amount</SourceLink> stays £3,000.
          </p>
          <ScheduleRates metadata={result.metadata} />
        </div>
      </Card>

      {matchedRow ? <ReadyReckonerPanel row={matchedRow} result={result} onNavigate={onNavigate} /> : null}
    </>
  );
}
