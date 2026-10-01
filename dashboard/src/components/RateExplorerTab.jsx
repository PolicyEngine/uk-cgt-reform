"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import options from "../../public/data/explore_options.json";
import {
  BASELINE_SCHEDULE_RATES,
  applyApproachToBudget,
  badrLimitLabel,
  describeBadr,
  getBudget,
  getDatasetInfo,
  getEntrants,
  getFirstYear,
  getFiveYearTotal,
  getIncomeChangeGroups,
  getValidation,
  withOffsetLabel,
} from "../lib/dataHelpers";
import { useExploration } from "../lib/exploreApi";
import {
  formatPct,
  formatSignedBn,
  formatSignedCurrency,
  formatSignedMn,
  formatSignedPct,
} from "../lib/formatters";
import BudgetChart from "./charts/BudgetChart";
import GroupImpactChart from "./charts/GroupImpactChart";
import { LabelledSelect, MetricCard, Toggle } from "./controls";
import SectionHeading from "./SectionHeading";

// The request options come from the pipeline (uk-cgt-reform-explore
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
const CURRENT_LAW = PRESETS.find((preset) => preset.id === "current_law").rates;
// HMRC's ready-reckoner rows (June 2025): schedules a reader can load, with
// HMRC's own post-behavioural receipts to set beside the run.
const READY_RECKONER = options.ready_reckoner;

// Every behavioural option is an elasticity of realised gains with respect to
// the retention rate (1 − t), applied as stated; its label names the source,
// and says so when the approach adds the OBR's income tax on shifted income.
function elasticityLabel(option, approach) {
  return approach?.offset_case_ids.includes(option.id) ? withOffsetLabel(option.label) : option.label;
}

// The options an approach to income shifting offers, and its central case.
function approachOptions(approach) {
  return approach.case_ids.map((id) => ELASTICITIES.find((option) => option.id === id));
}

function approachCentral(approach) {
  return ELASTICITIES.find((option) => option.id === approach.central_id).e_retention;
}

// Links shared before the retention form keyed each case by a marginal-tax-rate
// value; they map to the case they named, as the backend does.
const LEGACY_MTR_ELASTICITIES = new Map([
  [-0.35, 0.5],
  [-0.7, 1.0],
  [-2.52, 3.6],
]);
const sameElasticity = (a, b) => Math.abs(a - b) < 1e-9;

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

// Business Asset Disposal Relief: kept at a rate and lifetime limit, or
// withdrawn. The form holds the rate as a percentage string, like the bands.
const BADR_CURRENT_LAW = options.badr.current_law;
const BADR_LIMITS = options.badr.lifetime_limits;
const badrFormOf = (badr) =>
  badr.withdrawn
    ? { mode: "withdraw", rate: String(toPercent(BADR_CURRENT_LAW.rate)), limit: BADR_CURRENT_LAW.lifetime_limit }
    : { mode: "keep", rate: String(toPercent(badr.rate)), limit: badr.lifetime_limit };
const sameBadr = (a, b) =>
  a.withdrawn === b.withdrawn &&
  (a.withdrawn || (Math.abs(a.rate - b.rate) < 1e-9 && a.lifetime_limit === b.lifetime_limit));


function validateBadr(form, rates) {
  if (form.mode === "withdraw") return { badr: { withdrawn: true, rate: null, lifetime_limit: null } };
  const value = Number(form.rate);
  if (form.rate === "" || !Number.isFinite(value) || value < 0) {
    return { error: "Enter a rate for Business Asset Disposal Relief, or withdraw the relief." };
  }
  if (Math.abs(value / STEP_PCT - Math.round(value / STEP_PCT)) > 1e-6) {
    return { error: `The relief's rate is a whole percentage point; ${value}% is not.` };
  }
  if (rates && value / 100 > rates.additional_rate + 1e-9) {
    return {
      error:
        "The relief's rate may not exceed the additional rate: the relief would then raise the tax on qualifying gains.",
    };
  }
  return { badr: { withdrawn: false, rate: toFraction(value), lifetime_limit: Number(form.limit) } };
}

function readUrlState(searchParams, approach) {
  const values = BANDS.map((band) => searchParams.get(band.param));
  if (values.some((value) => value === null || value === "")) return null;
  const percents = Object.fromEntries(BANDS.map((band, i) => [band.key, values[i]]));
  // An absent or empty `e` means the approach's central case; Number(null)
  // would be 0, the static case. A case the approach does not offer falls
  // back to its central case too.
  const rawE = searchParams.get("e");
  const parsed = rawE === null || rawE.trim() === "" ? NaN : Number(rawE);
  const legacy = [...LEGACY_MTR_ELASTICITIES].find(([mtr]) => sameElasticity(mtr, parsed));
  const e = legacy ? legacy[1] : parsed;
  const elasticity = approachOptions(approach).some((option) => sameElasticity(option.e_retention, e))
    ? e
    : approachCentral(approach);
  // The relief: `bw=1` withdraws it; `br` (percent) and `bl` (£) keep it at
  // other than current law; neither means current law.
  const badrForm = badrFormOf(BADR_CURRENT_LAW);
  if (searchParams.get("bw") === "1") badrForm.mode = "withdraw";
  if (searchParams.get("br")) badrForm.rate = searchParams.get("br");
  const limit = Number(searchParams.get("bl"));
  if (BADR_LIMITS.includes(limit)) badrForm.limit = limit;
  return { percents, elasticity, badrForm };
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
            the two schedules have charged the same rates since 30 October 2024.
          </td>
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
          <td>Carried interest</td>
          <td>Taxed as income since April 2026</td>
          <td>Unchanged</td>
          <td>Carried interest moved into the income tax framework on 6 April 2026.</td>
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

// HMRC's figures for the ready-reckoner row this run matches. HMRC reports
// receipts, which arrive about a year after the liability, so each HMRC year
// sits beside the run's liability a year earlier.
function ReadyReckonerPanel({ row, result }) {
  const liability = (year) =>
    1000 * result.budget.find((budgetRow) => budgetRow.year === year).gov_balance_change_bn;
  const [contextYear] = READY_RECKONER.hmrc_years;
  return (
    <div className="mt-6">
      <h3 className="text-base font-semibold text-slate-800">
        HMRC ready reckoner: {row.label}
      </h3>
      <table className="data-table mt-3">
        <thead>
          <tr>
            <th>Comparison</th>
            <th>HMRC receipts</th>
            <th>This run, change in government balance</th>
          </tr>
        </thead>
        <tbody>
          <tr className="text-slate-500">
            <td>HMRC {contextYear} (receipts in the reform&apos;s first year)</td>
            <td>{formatSignedMn(row.hmrc_m[contextYear])}</td>
            <td>—</td>
          </tr>
          {READY_RECKONER.lag.map((lag) => (
            <tr key={lag.hmrc_year}>
              <td>
                HMRC {lag.hmrc_year} against this run&apos;s {lag.model_year} liabilities
              </td>
              <td className="font-semibold">{formatSignedMn(row.hmrc_m[lag.hmrc_year])}</td>
              <td>{formatSignedMn(liability(lag.model_year))}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-3 text-xs leading-5 text-slate-500">
        HMRC&apos;s figures ({READY_RECKONER.source}) are {READY_RECKONER.measure[0].toLowerCase()}
        {READY_RECKONER.measure.slice(1)}, after behavioural responses; HMRC has deferred its 2026
        edition, so they are provisional. The Benchmarks tab scores every
        row at the central and the official elasticity.
      </p>
    </div>
  );
}

export default function RateExplorerTab({ data, datasetKey }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { approach } = data;
  // Read once: a shared link arrives with a full schedule in the URL.
  const initial = useMemo(() => readUrlState(searchParams, approach), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [percents, setPercents] = useState(() => initial?.percents ?? percentsOf(CURRENT_LAW));
  const [badrForm, setBadrForm] = useState(() => initial?.badrForm ?? badrFormOf(BADR_CURRENT_LAW));
  const [elasticity, setElasticity] = useState(
    () => initial?.elasticity ?? approachCentral(approach),
  );
  const offered = approachOptions(approach);
  // Switching approach keeps a case both offer and otherwise moves to the
  // new approach's central case.
  useEffect(() => {
    if (!offered.some((option) => sameElasticity(option.e_retention, elasticity))) {
      setElasticity(approachCentral(approach));
    }
  }, [approach.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const { run, status, result, error, elapsedSeconds } = useExploration();
  const autoRan = useRef(false);

  const dataset = getDatasetInfo(data);
  const rateCheck = validatePercents(percents);
  const badrCheck = validateBadr(badrForm, rateCheck.rates);
  const validation = {
    rates: rateCheck.rates && badrCheck.badr ? rateCheck.rates : null,
    badr: badrCheck.badr ?? null,
    error: rateCheck.error ?? badrCheck.error,
  };
  const preset = validation.rates
    ? (PRESETS.find(
        (candidate) =>
          sameRates(candidate.rates, validation.rates) && sameBadr(candidate.badr, validation.badr),
      )?.id ?? "custom")
    : "custom";
  // HMRC's rows move rates only: they match with the relief at current law.
  // HMRC's rows each carry rates and a treatment of the relief (its BADR rows
  // move the relief's rate; the rest leave it at current law).
  const rowFor = (rates, badr) =>
    READY_RECKONER.rows.find(
      (row) => sameRates(row.rates, rates) && sameBadr(row.badr ?? BADR_CURRENT_LAW, badr),
    );
  const readyReckonerRow = validation.rates
    ? (rowFor(validation.rates, validation.badr)?.id ?? "none")
    : "none";

  const syncUrl = useCallback(
    (rates, badr, e) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("tab", "explorer");
      BANDS.forEach((band) => params.set(band.param, String(toPercent(rates[band.key]))));
      ["bw", "br", "bl"].forEach((key) => params.delete(key));
      if (badr.withdrawn) params.set("bw", "1");
      else if (!sameBadr(badr, BADR_CURRENT_LAW)) {
        params.set("br", String(toPercent(badr.rate)));
        params.set("bl", String(badr.lifetime_limit));
      }
      params.set("e", String(e));
      router.replace(`/?${params.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

  const submit = useCallback(() => {
    if (!validation.rates) return;
    syncUrl(validation.rates, validation.badr, elasticity);
    const badr = validation.badr.withdrawn
      ? { withdrawn: true }
      : { rate: validation.badr.rate, lifetime_limit: validation.badr.lifetime_limit };
    run({ dataset: datasetKey, rates: validation.rates, badr, elasticity });
  }, [validation.rates, validation.badr, elasticity, datasetKey, run, syncUrl]);

  useEffect(() => {
    if (autoRan.current) return;
    autoRan.current = true;
    if (initial && validatePercents(initial.percents).rates) submit();
  }, [initial, submit]);

  const equalisation = {
    firstYear: getFirstYear(data),
    revenue: getBudget(data)[0].gov_balance_change_bn,
    fiveYear: getFiveYearTotal(data),
    topQuintile: getIncomeChangeGroups(data, getFirstYear(data)).quintile.at(-1),
  };
  const entrants = getEntrants(data);
  const entrantShare = entrants.count / getValidation(data).cgt_taxpayers;
  const resultElasticity = result
    ? ELASTICITIES.find((option) => sameElasticity(option.e_retention, result.metadata.elasticity))
    : null;
  const matchedRow = result
    ? rowFor(result.metadata.reform, result.metadata.reform_badr ?? BADR_CURRENT_LAW)
    : null;
  const centralE = approachCentral(approach);
  const centralOption = ELASTICITIES.find((option) => sameElasticity(option.e_retention, centralE));
  // The run as the approach shows it: under the approach net of income
  // shifting, the official case adds the OBR's income tax on shifted income.
  // A backend older than the approaches does not report it; the run then
  // counts CGT alone and says so.
  const wantsOffset = Boolean(
    resultElasticity && approach.offset_case_ids.includes(resultElasticity.id),
  );
  const offsetMissing =
    wantsOffset && result.budget.some((row) => typeof row.income_shifting_offset_bn !== "number");
  const withOffset = wantsOffset && !offsetMissing;
  const shown = result
    ? (() => {
        const budget = withOffset
          ? applyApproachToBudget(result.budget, approach, resultElasticity.id)
          : result.budget;
        return {
          ...result,
          budget,
          five_year_total_bn: budget.reduce((sum, row) => sum + row.gov_balance_change_bn, 0),
        };
      })()
    : null;

  const firstYear = shown ? shown.budget[0].year : null;
  const firstRow = shown ? shown.budget[0] : null;
  const topQuintile = shown ? shown.income_change_groups[firstYear].quintile.at(-1) : null;

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
              property gains. Business Asset Disposal Relief can be kept, at a rate and lifetime limit
              you choose, or withdrawn; carried interest has been taxed as income since April 2026
              and is left alone. Every completed run is cached, so a schedule anyone
              has run before is served at once.
            </>
          }
        />
      </div>

      <section className="section-card">
        <SectionHeading
          title="Rate schedule"
          description="Rates in percent. Current law charges 18% within the basic rate band and 24% above it; equalising with income tax means 20% / 40% / 45%, and the equalisation on the Reform impacts tab also withdraws Business Asset Disposal Relief."
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
        <fieldset className="mt-5 rounded-lg border border-slate-200 px-4 py-3">
          <legend className="px-1 text-sm font-semibold text-slate-700">
            Business Asset Disposal Relief
          </legend>
          <div className="flex flex-wrap items-center gap-4">
            <Toggle
              options={[
                { value: "keep", label: "Keep the relief" },
                { value: "withdraw", label: "Withdraw it" },
              ]}
              value={badrForm.mode}
              onChange={(mode) => setBadrForm((current) => ({ ...current, mode }))}
            />
            {badrForm.mode === "keep" ? (
              <>
                <label className="inline-flex items-center gap-2 text-sm text-slate-600">
                  Rate
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    max={PCT_MAX}
                    step={STEP_PCT}
                    value={badrForm.rate}
                    onChange={(event) =>
                      setBadrForm((current) => ({ ...current, rate: event.target.value }))
                    }
                    className="w-20 rounded-md border border-slate-300 bg-white px-2 py-1 text-base font-semibold text-slate-800"
                  />
                  %
                </label>
                <LabelledSelect
                  label="Lifetime limit"
                  options={BADR_LIMITS.map((limit) => ({
                    value: String(limit),
                    label: badrLimitLabel(limit),
                  }))}
                  value={String(badrForm.limit)}
                  onChange={(value) =>
                    setBadrForm((current) => ({ ...current, limit: Number(value) }))
                  }
                />
              </>
            ) : null}
          </div>
          <p className="mt-2 text-xs leading-5 text-slate-500">
            Gains on qualifying business disposals, Investors&apos; Relief included. Current law
            charges {describeBadr(BADR_CURRENT_LAW)}; withdrawn, those gains take the main rates
            above. The relief&apos;s rate may not exceed the additional rate.
          </p>
        </fieldset>
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
              if (!chosen) return;
              setPercents(percentsOf(chosen.rates));
              setBadrForm(badrFormOf(chosen.badr ?? BADR_CURRENT_LAW));
            }}
          />
          <LabelledSelect
            label="HMRC ready-reckoner row"
            options={[
              { value: "none", label: "None" },
              ...READY_RECKONER.rows.map((row) => ({ value: row.id, label: row.label })),
            ]}
            value={readyReckonerRow}
            onChange={(id) => {
              const chosen = READY_RECKONER.rows.find((row) => row.id === id);
              if (!chosen) return;
              setPercents(percentsOf(chosen.rates));
              setBadrForm(badrFormOf(chosen.badr ?? BADR_CURRENT_LAW));
            }}
          />
          <LabelledSelect
            label="Behavioural response"
            options={offered.map((option) => ({
              value: String(option.e_retention),
              label: elasticityLabel(option, approach),
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

      {shown ? (
        <>
          <section className="section-card">
            <SectionHeading
              title={`Headline results, ${firstYear}`}
              description={`${formatPct(shown.metadata.reform.basic_rate * 100, 0)} / ${formatPct(shown.metadata.reform.higher_rate * 100, 0)} / ${formatPct(shown.metadata.reform.additional_rate * 100, 0)}, Business Asset Disposal Relief ${describeBadr(shown.metadata.reform_badr ?? BADR_CURRENT_LAW).toLowerCase()}, on ${shown.metadata.dataset_short_label}, ${resultElasticity ? elasticityLabel(resultElasticity, approach) : `retention elasticity ${shown.metadata.elasticity}`}; distributional figures cover all households.`}
            />
            <div className="grid gap-4 md:grid-cols-3">
              <MetricCard
                label={`Revenue raised, ${firstYear}`}
                value={formatSignedBn(firstRow.gov_balance_change_bn, 1)}
                note={
                  withOffset
                    ? "Net change in the government balance after taxpayers adjust realisations to the new rates, plus the income tax the OBR adds back for income no longer presented as gains."
                    : "Net change in the government balance after taxpayers adjust realisations to the new rates."
                }
              />
              <MetricCard
                label="Five-year total, 2026-27 to 2030-31"
                value={formatSignedBn(shown.five_year_total_bn, 1)}
                note="Sum of the annual government balance changes over the five modelled years."
              />
              <MetricCard
                label="Top quintile net income change"
                value={formatSignedPct(topQuintile.relative_change_pct)}
                note={`Average of ${formatSignedCurrency(topQuintile.avg_change_gbp)} per household in the highest-income 20%. Includes the gains taxpayers stop realising under the elasticity, not just tax paid.`}
              />
            </div>
            {offsetMissing ? (
              <p className="mt-3 text-sm leading-6 text-amber-800">
                The explorer&apos;s backend did not report the income tax on shifted income for this
                run, so these figures count CGT alone, not the total revenue this approach shows
                elsewhere.
              </p>
            ) : null}
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
                  <td>{formatSignedBn(shown.five_year_total_bn, 1)}</td>
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
              The equalisation column is the committed result for {dataset.shortLabel}: 20% / 40% /
              45% with Business Asset Disposal Relief withdrawn, at this approach&apos;s central case
              ({centralOption.label})
              {resultElasticity && !sameElasticity(resultElasticity.e_retention, centralE)
                ? "; this schedule ran with a different elasticity, so the two are not like for like"
                : ""}
              .
            </p>
            {matchedRow ? <ReadyReckonerPanel row={matchedRow} result={shown} /> : null}
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
            <BudgetChart budget={shown.budget} />
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
            <GroupImpactChart groupsByYear={shown.income_change_groups} initialYear={firstYear} />
            {withOffset ? (
              <p className="mt-3 text-xs leading-5 text-slate-500">
                The income tax added back for shifted income is in the revenue figures above but not
                in these household figures, which reflect the CGT change alone.
              </p>
            ) : null}
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
