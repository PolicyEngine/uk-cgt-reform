"use client";

import {
  BASELINE_SCHEDULE_RATES,
  describeBadr,
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
  sameBadr,
  sameElasticity,
} from "../lib/schedule";
import BudgetChart from "./charts/BudgetChart";
import GroupImpactChart from "./charts/GroupImpactChart";
import { Card, MetricCard, Notes, TabLink, TableScroll } from "./controls";
import SectionHeading from "./SectionHeading";

const pct = (fraction) => formatPct(fraction * 100, 0);
const elasticityName = (e) => elasticityOption(e)?.label ?? `retention elasticity ${e}`;

// Where a live run stands: a cache lookup for a shared link, a computation,
// an error, or a finished run and whether the cache served it.
export function StatusLine({ status, elapsedSeconds, error, result, datasetLabel }) {
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
        Press Calculate to compute it; it takes about half a minute.
      </p>
    );
  }
  if (status === "running") {
    return (
      <p className="mt-4 text-sm leading-6 text-slate-600" role="status">
        Running the five fiscal years on {datasetLabel}… {elapsedSeconds}s. A schedule nobody has
        run before takes about half a minute; one that has been run before returns at once.
      </p>
    );
  }
  if (status === "error") {
    return (
      <p className="mt-4 text-sm leading-6 text-red-700" role="alert">
        {error}
      </p>
    );
  }
  if (status === "done" && result) {
    const cache = result.metadata.cache ?? {};
    const when = cache.computed_at ? new Date(cache.computed_at) : null;
    return (
      <p className="mt-4 text-sm leading-6 text-slate-600" role="status">
        {cache.hit
          ? `Served from the cache in ${elapsedSeconds}s; first computed ${when ? when.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }) : "earlier"}.`
          : `Computed in ${elapsedSeconds}s. The result is cached, so anyone who runs this schedule again is served it at once.`}
      </p>
    );
  }
  return null;
}

function SpecTable({ metadata }) {
  const baseline = metadata.baseline_rates;
  const reform = metadata.reform;
  const changed = (band) => Math.abs(baseline[band] - reform[band]) > 1e-9;
  return (
    <TableScroll>
    <table className="data-table">
      <thead>
        <tr>
          <th>Policy parameter</th>
          <th>Current law</th>
          <th>This schedule</th>
          <th>What it means</th>
        </tr>
      </thead>
      <tbody>
        {BANDS.map((band) => (
          <tr key={band.key}>
            <td>{band.label.replace(" rate", " CGT rate")}</td>
            <td>{pct(baseline[band.key])}</td>
            <td className={changed(band.key) ? "font-semibold" : ""}>{pct(reform[band.key])}</td>
            <td>{band.note}</td>
          </tr>
        ))}
        <tr>
          <td>Residential property CGT rates</td>
          <td>
            {pct(BASELINE_SCHEDULE_RATES.residential_property.basic_rate)} /{" "}
            {pct(BASELINE_SCHEDULE_RATES.residential_property.higher_rate)}
          </td>
          <td className="font-semibold">
            {pct(reform.basic_rate)} / {pct(reform.higher_rate)} / {pct(reform.additional_rate)}
          </td>
          <td>Gains on UK residential property, charged on their own schedule, take the same rates.</td>
        </tr>
        <tr>
          <td>Business Asset Disposal Relief</td>
          <td>{describeBadr(metadata.baseline_badr ?? BASELINE_SCHEDULE_RATES.badr)}</td>
          <td className={metadata.reform_badr && !sameBadr(metadata.reform_badr, BADR_CURRENT_LAW) ? "font-semibold" : ""}>
            {describeBadr(metadata.reform_badr ?? BASELINE_SCHEDULE_RATES.badr)}
          </td>
          <td>
            {metadata.reform_badr?.withdrawn
              ? "Gains that qualify for the relief (Investors' Relief included) take the main rates above."
              : "Gains that qualify for the relief are charged at its rate, up to the lifetime limit."}
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
  );
}

// HMRC's figures for the ready-reckoner row this run matches. HMRC reports
// receipts, which arrive about a year after the liability, so each HMRC year
// sits beside the run's liability a year earlier.
function ReadyReckonerPanel({ row, result }) {
  const liability = (year) =>
    1000 * result.budget.find((budgetRow) => budgetRow.year === year).gov_balance_change_bn;
  const [contextYear] = READY_RECKONER.hmrc_years;
  return (
    <Card className="min-w-0">
      <SectionHeading
        title="HMRC ready reckoner"
        description={`${row.label}: HMRC's receipts beside this run's liabilities a year earlier.`}
      />
      <TableScroll>
      <table className="data-table">
        <thead>
          <tr>
            <th>Comparison</th>
            <th className="num">HMRC receipts</th>
            <th className="num">This run, change in government balance</th>
          </tr>
        </thead>
        <tbody>
          <tr className="text-slate-500">
            <td>HMRC {contextYear} (receipts in the reform&apos;s first year)</td>
            <td className="num">{formatSignedMn(row.hmrc_m[contextYear])}</td>
            <td className="num">—</td>
          </tr>
          {READY_RECKONER.lag.map((lag) => (
            <tr key={lag.hmrc_year}>
              <td>
                HMRC {lag.hmrc_year} against this run&apos;s {lag.model_year} liabilities
              </td>
              <td className="num font-semibold">{formatSignedMn(row.hmrc_m[lag.hmrc_year])}</td>
              <td className="num">{formatSignedMn(liability(lag.model_year))}</td>
            </tr>
          ))}
        </tbody>
      </table>
      </TableScroll>
      <Notes>
        <p>
          HMRC&apos;s figures ({READY_RECKONER.source}) are {READY_RECKONER.measure[0].toLowerCase()}
          {READY_RECKONER.measure.slice(1)}, after behavioural responses; HMRC has deferred its 2026
          edition, so they are provisional. HMRC reports receipts, which arrive about a year after
          the liability. The Benchmarks tab scores every row at the central and the official
          elasticity.
        </p>
      </Notes>
    </Card>
  );
}

// "£6.8bn less than", "£1.2bn more than": a schedule's figure (£bn) against
// equalisation's, to the precision the cards show.
function difference(value, reference) {
  const gap = value - reference;
  if (Math.abs(gap) < 0.05) return "the same as";
  return `${formatSignedBn(Math.abs(gap), 1)} ${gap > 0 ? "more than" : "less than"}`;
}

// The Reform tab's results for a schedule run live. Equalisation's own
// figures have their home in the precomputed results; here the schedule is
// set against them as differences, with a button to show them.
export default function LiveResults({ data, result, onNavigate, onShowEqualisation }) {
  const firstYear = result.budget[0].year;
  const firstRow = result.budget[0];
  const topQuintile = result.income_change_groups[firstYear].quintile.at(-1);
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
  const reform = result.metadata.reform;

  return (
    <>
      <Card>
        <SectionHeading
          title={`Headline results, ${firstYear}`}
          description={`${pct(reform.basic_rate)} / ${pct(reform.higher_rate)} / ${pct(reform.additional_rate)}, Business Asset Disposal Relief ${describeBadr(reformBadr).toLowerCase()}, on ${result.metadata.dataset_short_label}, ${elasticityName(resultE)}. Distributional figures cover all households.`}
        />
        <div className="grid gap-4 md:grid-cols-3">
          <MetricCard
            label={`Change in government balance, ${firstYear}`}
            value={bn(firstRow.gov_balance_change_bn)}
            note={Number(resultE) === 0 ? "With no behavioural response." : "After the behavioural response."}
          />
          <MetricCard
            label={`Five-year change in government balance, ${firstYear} to ${result.budget.at(-1).year}`}
            value={bn(result.five_year_total_bn)}
            note="Sum of the five modelled years."
          />
          <MetricCard
            label={`Change in net income, top income quintile, ${firstYear}`}
            value={formatSignedPct(topQuintile.relative_change_pct)}
            note={`${formatSignedCurrency(topQuintile.avg_change_gbp)} per household on average.`}
          />
        </div>
        <p className="mt-4 text-sm leading-6 text-slate-600">
          {likeForLike ? (
            <>
              At the same elasticity, this schedule&apos;s change in the government balance is{" "}
              {difference(firstRow.gov_balance_change_bn, equalisation.revenue)} equalisation&apos;s in{" "}
              {firstYear}, and {difference(result.five_year_total_bn, equalisation.fiveYear)} it over
              the five years.{" "}
            </>
          ) : (
            <>
              Equalisation&apos;s precomputed results are at{" "}
              {elasticityName(equalisation.elasticity)}, and this schedule ran at another
              elasticity, so the two are not like for like.{" "}
            </>
          )}
          <TabLink onNavigate={onShowEqualisation}>Show equalisation&apos;s results</TabLink>.
        </p>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="min-w-0">
          <SectionHeading
            title="Budgetary impact by year"
            description="CGT revenue and the change in the government balance, by fiscal year."
          />
          <BudgetChart budget={result.budget} />
          {entrantShare > 0.05 ? (
            <Notes>
              <p>
                Entrants by uprating (
                <TabLink onNavigate={onNavigate} tab="baseline" section="entrants">
                  see the Baseline tab
                </TabLink>
                ) contribute {formatSmallBn(firstRow.cgt_change_from_entrants_bn)} of the{" "}
                {firstYear} change.
              </p>
            </Notes>
          ) : null}
        </Card>

        <Card className="min-w-0">
          <SectionHeading
            title="Change in household net income by income group"
            description="Grouped by the household's position in the baseline income distribution."
          />
          <GroupImpactChart groupsByYear={result.income_change_groups} initialYear={firstYear} />
          <Notes>
            <p>
              The switches group households by income quintile or quartile, household type or
              region. Changes in the gains taxpayers realise in response to the new rates count as
              changes in income in the year, alongside the change in tax paid.
            </p>
          </Notes>
        </Card>
      </div>

      {/* The specification's long text needs the full width, so the ready
          reckoner sits under it rather than beside it. */}
      <Card as="details" className="group min-w-0">
        <summary className="cursor-pointer select-none font-semibold text-slate-800 marker:text-[color:var(--pe-color-primary-600)]">
          What exactly does this schedule change?
          <span className="ml-2 text-sm font-normal text-slate-500 group-open:hidden">
            (expand for the full specification)
          </span>
        </summary>
        <div className="mt-4 space-y-3">
          <p className="text-sm leading-6 text-slate-600">
            Effective from the {firstYear} fiscal year and held in place through{" "}
            {result.budget.at(-1).year}. Current law is read from the installed engine for{" "}
            {firstYear}.
          </p>
          <SpecTable metadata={result.metadata} />
        </div>
      </Card>

      {matchedRow ? <ReadyReckonerPanel row={matchedRow} result={result} /> : null}

      <p className="text-xs leading-5 text-slate-500">
        Run on policyengine.py {result.metadata.policyengine_version} with policyengine-uk{" "}
        {result.metadata.policyengine_uk_version}; reform fingerprint{" "}
        <span className="font-mono">{result.metadata.reform_fingerprint}</span>, projection{" "}
        <span className="font-mono">{result.metadata.projection.fingerprint}</span>
        {result.metadata.timing?.total_seconds
          ? `; ${result.metadata.timing.total_seconds}s of simulation`
          : ""}
        .
      </p>
    </>
  );
}
