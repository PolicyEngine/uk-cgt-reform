"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import options from "../../public/data/explore_options.json";
import {
  BASELINE_SCHEDULE_RATES,
  getBudget,
  getDatasetInfo,
  getEntrants,
  getFirstYear,
  getFiveYearTotal,
  getIncomeChangeGroups,
  getValidation,
} from "../lib/dataHelpers";
import { useExploration } from "../lib/exploreApi";
import { formatPct, formatSignedBn, formatSignedCurrency, formatSignedPct } from "../lib/formatters";
import BudgetChart from "./charts/BudgetChart";
import GroupImpactChart from "./charts/GroupImpactChart";
import { LabelledSelect, MetricCard } from "./controls";
import SectionHeading from "./SectionHeading";

// The request options come from the pipeline (uk-equalising-cgt-explore
// --options), bundled at build time so the controls never wait on a network.
const BANDS = [
  {
    key: "basic_rate",
    param: "basic",
    label: "Basic rate",
    note: "Gains that fall within the basic rate band once stacked on the taxpayer's income.",
  },
  {
    key: "higher_rate",
    param: "higher",
    label: "Higher rate",
    note: "Gains above the basic rate band, up to the additional rate threshold.",
  },
  {
    key: "additional_rate",
    param: "additional",
    label: "Additional rate",
    note: "Gains stacked above £125,140 of income and gains. Current law has no separate rate here: set it equal to the higher rate for a single rate above the basic band.",
  },
];
const PCT_MIN = options.rate_bounds[0] * 100;
const PCT_MAX = options.rate_bounds[1] * 100;
const STEP_PCT = (options.rate_step ?? 0.01) * 100;
const PRESETS = options.presets;
const ELASTICITIES = options.elasticity_options;
const DEFAULT_ELASTICITY = options.default_elasticity;
const CURRENT_LAW = PRESETS.find((preset) => preset.id === "current_law").rates;

const toPercent = (fraction) => Math.round(fraction * 10000) / 100;
const toFraction = (percent) => Math.round(Number(percent) * 100) / 10000;
const percentsOf = (rates) =>
  Object.fromEntries(BANDS.map((band) => [band.key, String(toPercent(rates[band.key]))]));
const sameRates = (a, b) => BANDS.every((band) => Math.abs(a[band.key] - b[band.key]) < 1e-9);

function validatePercents(percents) {
  const numbers = {};
  for (const band of BANDS) {
    const raw = percents[band.key];
    const value = Number(raw);
    if (raw === "" || raw === null || raw === undefined || !Number.isFinite(value)) {
      return { error: `Enter a ${band.label.toLowerCase()} between ${PCT_MIN}% and ${PCT_MAX}%.` };
    }
    if (value < PCT_MIN || value > PCT_MAX) {
      return { error: `The ${band.label.toLowerCase()} must be between ${PCT_MIN}% and ${PCT_MAX}%.` };
    }
    if (Math.abs(value / STEP_PCT - Math.round(value / STEP_PCT)) > 1e-6) {
      return { error: `Rates are whole percentage points; ${value}% for the ${band.label.toLowerCase()} is not.` };
    }
    numbers[band.key] = value;
  }
  if (numbers.basic_rate > numbers.higher_rate) {
    return { error: "The basic rate may not exceed the higher rate." };
  }
  if (numbers.additional_rate < numbers.higher_rate) {
    return {
      error:
        "The additional rate must be at least the higher rate. Set them equal for a single rate above the basic rate band, as in current law.",
    };
  }
  return { rates: Object.fromEntries(BANDS.map((band) => [band.key, toFraction(numbers[band.key])])) };
}

function readUrlState(searchParams) {
  const values = BANDS.map((band) => searchParams.get(band.param));
  if (values.some((value) => value === null || value === "")) return null;
  const percents = Object.fromEntries(BANDS.map((band, i) => [band.key, values[i]]));
  // An absent or empty `e` means the default; Number(null) would be 0, the static case.
  const rawE = searchParams.get("e");
  const e = rawE === null || rawE.trim() === "" ? NaN : Number(rawE);
  const elasticity = ELASTICITIES.some((option) => Math.abs(option.e_mtr - e) < 1e-9)
    ? e
    : DEFAULT_ELASTICITY;
  return { percents, elasticity };
}

function RateInput({ band, value, onChange }) {
  return (
    <label className="block text-sm text-slate-600">
      <span className="font-semibold text-slate-700">{band.label}</span>
      <span className="mt-1 flex items-center gap-2">
        <input
          type="number"
          inputMode="decimal"
          min={PCT_MIN}
          max={PCT_MAX}
          step={STEP_PCT}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="w-28 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-base font-semibold text-slate-800"
        />
        <span>%</span>
      </span>
      <span className="mt-1 block text-xs leading-5 text-slate-500">{band.note}</span>
    </label>
  );
}

function StatusLine({ status, elapsedSeconds, error, result, datasetLabel }) {
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
  const pct = (fraction) => formatPct(fraction * 100, 0);
  const changed = (band) => Math.abs(baseline[band] - reform[band]) > 1e-9;
  return (
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
          <td>
            Gains on UK residential property, charged on their own schedule, take the same rates;
            the law aligned the two schedules from April 2025.
          </td>
        </tr>
        <tr>
          <td>Carried interest CGT rate</td>
          <td>{pct(BASELINE_SCHEDULE_RATES.carried_interest.higher_rate)} flat</td>
          <td>{pct(BASELINE_SCHEDULE_RATES.carried_interest.higher_rate)} flat</td>
          <td>Unchanged. Neither dataset records carried interest, so any treatment is inert here.</td>
        </tr>
        <tr>
          <td>Business Asset Disposal Relief</td>
          <td>£{BASELINE_SCHEDULE_RATES.badr_lifetime_limit.toLocaleString("en-GB")} lifetime limit</td>
          <td>£{BASELINE_SCHEDULE_RATES.badr_lifetime_limit.toLocaleString("en-GB")} lifetime limit</td>
          <td>Unchanged. Neither dataset records relief gains, so any treatment is inert here.</td>
        </tr>
        <tr>
          <td>Annual exempt amount</td>
          <td>£3,000</td>
          <td>£3,000</td>
          <td>Unchanged: the first £3,000 of gains each year stays tax-free.</td>
        </tr>
      </tbody>
    </table>
  );
}

export default function RateExplorerTab({ data, datasetKey }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Read once: a shared link arrives with a full schedule in the URL.
  const initial = useMemo(() => readUrlState(searchParams), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [percents, setPercents] = useState(() => initial?.percents ?? percentsOf(CURRENT_LAW));
  const [elasticity, setElasticity] = useState(() => initial?.elasticity ?? DEFAULT_ELASTICITY);
  const { run, reset, status, result, error, elapsedSeconds } = useExploration();
  const autoRan = useRef(false);
  const lastDataset = useRef(datasetKey);

  const dataset = getDatasetInfo(data);
  const validation = validatePercents(percents);
  const preset = validation.rates
    ? (PRESETS.find((candidate) => sameRates(candidate.rates, validation.rates))?.id ?? "custom")
    : "custom";

  const syncUrl = useCallback(
    (rates, e) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("tab", "explorer");
      BANDS.forEach((band) => params.set(band.param, String(toPercent(rates[band.key]))));
      params.set("e", String(e));
      router.replace(`/?${params.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

  const submit = useCallback(() => {
    if (!validation.rates) return;
    syncUrl(validation.rates, elasticity);
    run({ dataset: datasetKey, rates: validation.rates, elasticity });
  }, [validation.rates, elasticity, datasetKey, run, syncUrl]);

  useEffect(() => {
    if (autoRan.current) return;
    autoRan.current = true;
    if (initial && validatePercents(initial.percents).rates) submit();
  }, [initial, submit]);

  // A result belongs to one dataset: switching datasets clears it.
  useEffect(() => {
    if (lastDataset.current !== datasetKey) {
      lastDataset.current = datasetKey;
      reset();
    }
  }, [datasetKey, reset]);

  const equalisation = {
    firstYear: getFirstYear(data),
    revenue: getBudget(data)[0].gov_balance_change_bn,
    fiveYear: getFiveYearTotal(data),
    topQuintile: getIncomeChangeGroups(data, getFirstYear(data)).quintile.at(-1),
  };
  const entrants = getEntrants(data);
  const entrantShare = entrants.count / getValidation(data).cgt_taxpayers;
  const elasticityOption = ELASTICITIES.find((option) => Math.abs(option.e_mtr - elasticity) < 1e-9);

  const firstYear = result ? result.budget[0].year : null;
  const firstRow = result ? result.budget[0] : null;
  const topQuintile = result ? result.income_change_groups[firstYear].quintile.at(-1) : null;

  return (
    <div className="space-y-6">
      <div className="pt-2">
        <SectionHeading
          size="lg"
          title="Choose the CGT rates"
          description={
            <>
              Set a rate for each band and run it: the same pipeline as the Reform impacts tab
              scores the schedule on {dataset.shortLabel} for 2026-27 to 2030-31, with the same
              behavioural response. The chosen rates apply to the main schedule and to residential
              property gains; carried interest and Business Asset Disposal Relief stay at current
              law (see the Methodology tab). Every completed run is cached, so a schedule anyone
              has run before is served at once.
            </>
          }
        />
      </div>

      <section className="section-card">
        <SectionHeading
          title="Rate schedule"
          description="Rates in percent. Current law charges 18% within the basic rate band and 24% above it; equalising with income tax means 20% / 40% / 45%."
        />
        <div className="grid gap-4 md:grid-cols-3">
          {BANDS.map((band) => (
            <RateInput
              key={band.key}
              band={band}
              value={percents[band.key]}
              onChange={(value) => setPercents((current) => ({ ...current, [band.key]: value }))}
            />
          ))}
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-4">
          <LabelledSelect
            label="Preset"
            options={[
              ...PRESETS.map((candidate) => ({ value: candidate.id, label: candidate.label })),
              { value: "custom", label: "Custom" },
            ]}
            value={preset}
            onChange={(id) => {
              const chosen = PRESETS.find((candidate) => candidate.id === id);
              if (chosen) setPercents(percentsOf(chosen.rates));
            }}
          />
          <LabelledSelect
            label="Behavioural response"
            options={ELASTICITIES.map((option) => ({
              value: String(option.e_mtr),
              label: `${option.label}, MTR elasticity ${option.e_mtr}`,
            }))}
            value={String(elasticity)}
            onChange={(value) => setElasticity(Number(value))}
          />
          <button
            type="button"
            onClick={submit}
            disabled={!validation.rates || status === "running"}
            className="rounded-md bg-[color:var(--pe-color-primary-600)] px-5 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {status === "running" ? "Running…" : "Run this schedule"}
          </button>
        </div>
        {validation.error ? (
          <p className="mt-3 text-sm leading-6 text-red-700">{validation.error}</p>
        ) : null}
        <StatusLine
          status={status}
          elapsedSeconds={elapsedSeconds}
          error={error}
          result={result}
          datasetLabel={dataset.shortLabel}
        />
      </section>

      {result ? (
        <>
          <section className="section-card">
            <SectionHeading
              title={`Headline results, ${firstYear}`}
              description={`${formatPct(result.metadata.reform.basic_rate * 100, 0)} / ${formatPct(result.metadata.reform.higher_rate * 100, 0)} / ${formatPct(result.metadata.reform.additional_rate * 100, 0)} on ${result.metadata.dataset_short_label}, MTR elasticity ${result.metadata.elasticity}; distributional figures cover all households.`}
            />
            <div className="grid gap-4 md:grid-cols-3">
              <MetricCard
                label={`Revenue raised, ${firstYear}`}
                value={formatSignedBn(firstRow.gov_balance_change_bn, 1)}
                note="Net change in the government balance after taxpayers adjust realisations to the new rates."
              />
              <MetricCard
                label="Five-year total, 2026-27 to 2030-31"
                value={formatSignedBn(result.five_year_total_bn, 1)}
                note="Sum of the annual government balance changes over the five modelled years."
              />
              <MetricCard
                label="Top quintile net income change"
                value={formatSignedPct(topQuintile.relative_change_pct)}
                note={`Average of ${formatSignedCurrency(topQuintile.avg_change_gbp)} per household in the highest-income 20%. Includes the gains taxpayers stop realising under the elasticity, not just tax paid.`}
              />
            </div>
            <table className="data-table mt-5">
              <thead>
                <tr>
                  <th>Compared with equalising to income tax</th>
                  <th>This schedule</th>
                  <th>Equalisation (Reform impacts tab)</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Revenue raised, {firstYear}</td>
                  <td>{formatSignedBn(firstRow.gov_balance_change_bn, 1)}</td>
                  <td>{formatSignedBn(equalisation.revenue, 1)}</td>
                </tr>
                <tr>
                  <td>Five-year total</td>
                  <td>{formatSignedBn(result.five_year_total_bn, 1)}</td>
                  <td>{formatSignedBn(equalisation.fiveYear, 1)}</td>
                </tr>
                <tr>
                  <td>Top quintile net income change, {firstYear}</td>
                  <td>
                    {formatSignedPct(topQuintile.relative_change_pct)} (
                    {formatSignedCurrency(topQuintile.avg_change_gbp)})
                  </td>
                  <td>
                    {formatSignedPct(equalisation.topQuintile.relative_change_pct)} (
                    {formatSignedCurrency(equalisation.topQuintile.avg_change_gbp)})
                  </td>
                </tr>
              </tbody>
            </table>
            <p className="mt-3 text-xs leading-5 text-slate-500">
              The equalisation column is the committed result for {dataset.shortLabel} at an MTR
              elasticity of −0.7{elasticityOption && elasticityOption.e_mtr !== -0.7 ? "; this schedule ran with a different elasticity, so the two are not like for like" : ""}.
            </p>
          </section>

          <details className="section-card group">
            <summary className="cursor-pointer select-none font-semibold text-slate-800 marker:text-[color:var(--pe-color-primary-600)]">
              What exactly does this schedule change?
              <span className="ml-2 text-sm font-normal text-slate-500 group-open:hidden">
                (expand for the full specification)
              </span>
            </summary>
            <div className="mt-4 space-y-3">
              <p className="text-sm leading-6 text-slate-600">
                Effective from the 2026-27 fiscal year and held in place through 2030-31. Current
                law is read from the installed engine for 2026-27.
              </p>
              <SpecTable metadata={result.metadata} />
            </div>
          </details>

          <section className="section-card">
            <SectionHeading
              title="Budgetary impact by year"
              description="Baseline and reformed CGT revenue, and the net change in the government balance, for each fiscal year."
            />
            <BudgetChart budget={result.budget} />
            {entrantShare > 0.05 ? (
              <p className="mt-4 text-sm leading-6 text-slate-600">
                {formatPct(100 * entrantShare, 0)} of this dataset&apos;s {firstYear} CGT taxpayers
                are entrants by uprating (see the Baseline tab): people whose base-year gains sit at
                or below the frozen £3,000 exempt amount and cross it once the engine uprates gains.
                They contribute {formatSignedBn(firstRow.cgt_change_from_entrants_bn, 2)} of the{" "}
                {firstYear} change, so the revenue figures are little affected; the share of people
                affected is.
              </p>
            ) : null}
          </section>

          <section className="section-card">
            <SectionHeading
              title="Who bears the cost"
              description="Change in household net income, grouped by the household's position in the baseline income distribution, by household type, or by region. Losses include both the extra tax paid and the gains taxpayers choose not to realise in response."
            />
            <GroupImpactChart groupsByYear={result.income_change_groups} initialYear={firstYear} />
          </section>

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
      ) : null}
    </div>
  );
}
