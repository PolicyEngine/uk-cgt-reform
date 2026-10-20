"use client";

import { badrLimitLabel, describeBadr } from "../lib/dataHelpers";
import { formatPct } from "../lib/formatters";
import {
  BADR_CURRENT_LAW,
  BADR_LIMITS,
  BANDS,
  CURRENT_LAW,
  ELASTICITIES,
  PCT_MAX,
  PCT_MIN,
  PRESETS,
  READY_RECKONER,
  STEP_PCT,
  checkForm,
  formOf,
  presetFor,
  readyReckonerRowFor,
} from "../lib/schedule";

// One short line under each rate; the band's full note sits in its tooltip.
const BAND_HINTS = {
  basic_rate: "Within the basic rate band",
  higher_rate: "Up to £125,140",
  additional_rate: "Above £125,140",
};
const BADR_NOTE =
  "Gains on qualifying business disposals, Investors' Relief included. Withdrawn, those gains take the main rates. The relief's rate may not exceed the additional rate. The model charges it on every qualifying gain, without the claim a taxpayer makes in law.";
const ELASTICITY_NOTE =
  "The elasticity of realised gains with respect to the retention rate (1 − t): taxpayers realise fewer gains as the share of each gain they keep falls.";

const FIELD =
  "w-full [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none rounded-lg border bg-white text-slate-900 shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-[color:var(--pe-color-primary-500)] focus:ring-offset-1";
const fieldBorder = (invalid) =>
  invalid ? "border-red-500" : "border-slate-300 hover:border-slate-400 focus:border-[color:var(--pe-color-primary-600)]";

// "CenTax central (retention elasticity 1.0)" → a short name for the select
// and its detail for the line beneath.
function splitLabel(label) {
  const match = label.match(/^(.*?)\s*\((.*)\)$/);
  if (!match) return { name: label, detail: "" };
  return { name: match[1], detail: match[2][0].toUpperCase() + match[2].slice(1) };
}

function InfoTip({ children, label }) {
  return (
    <span className="info-tip" tabIndex={0} role="note" aria-label={label}>
      ?<span className="info-tip-bubble">{children}</span>
    </span>
  );
}

function SectionLabel({ children, tip }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">{children}</h3>
      {tip ? <InfoTip label={`About ${String(children).toLowerCase()}`}>{tip}</InfoTip> : null}
    </div>
  );
}

function FieldError({ id, children }) {
  return (
    <p id={id} className="mt-2 text-xs leading-5 text-red-700">
      {children}
    </p>
  );
}

// A percentage input with its "%" inside the field.
function PercentInput({ id, value, onChange, invalid, describedBy, min = PCT_MIN, large = true }) {
  return (
    <div className="relative">
      <input
        id={id}
        type="number"
        inputMode="decimal"
        min={min}
        max={PCT_MAX}
        step={STEP_PCT}
        value={value}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        onChange={(event) => onChange(event.target.value)}
        className={`${FIELD} ${fieldBorder(invalid)} ${large ? "py-2 pl-3 pr-9 text-2xl font-semibold" : "py-2 pl-3 pr-8 text-lg font-semibold"}`}
      />
      <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-base font-semibold text-slate-400">
        %
      </span>
    </div>
  );
}

// The rate's distance from current law, in percentage points.
function ChangeChip({ value, reference }) {
  const number = Number(value);
  if (value === "" || !Number.isFinite(number)) return null;
  const gap = Math.round((number - reference * 100) * 100) / 100;
  if (gap === 0) return null;
  return (
    <span className="rounded-full bg-[color:var(--pe-color-primary-100)] px-2 py-0.5 text-xs font-semibold text-[color:var(--pe-color-primary-800)]">
      {gap > 0 ? "+" : "−"}
      {Math.abs(gap)} pp
    </span>
  );
}

function RateCard({ band, value, onChange, error }) {
  const id = `rate-${band.key}`;
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
      <div className="mb-2 flex items-center gap-2">
        <label htmlFor={id} className="text-sm font-semibold text-slate-800">
          {band.label}
        </label>
        <InfoTip label={`About the ${band.label.toLowerCase()}`}>{band.note}</InfoTip>
      </div>
      <PercentInput
        id={id}
        value={value}
        onChange={onChange}
        invalid={Boolean(error)}
        describedBy={error ? `${id}-error` : `${id}-hint`}
      />
      <div id={`${id}-hint`} className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
        <span>{BAND_HINTS[band.key]}</span>
        <span className="flex items-center gap-2">
          <span>Current law {formatPct(CURRENT_LAW.rates[band.key] * 100, 0)}</span>
          <ChangeChip value={value} reference={CURRENT_LAW.rates[band.key]} />
        </span>
      </div>
      {error ? <FieldError id={`${id}-error`}>{error}</FieldError> : null}
    </div>
  );
}

// A two-way segmented control for the relief.
function Segmented({ label, options, value, onChange }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-lg bg-slate-100 p-1">
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={`rounded-md px-4 py-1.5 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--pe-color-primary-500)] ${
              selected
                ? "bg-white text-[color:var(--pe-color-primary-700)] shadow-sm ring-1 ring-[color:var(--pe-color-primary-600)]"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function Select({ id, value, onChange, options, describedBy }) {
  return (
    <select
      id={id}
      value={value}
      aria-describedby={describedBy}
      onChange={(event) => onChange(event.target.value)}
      className={`${FIELD} ${fieldBorder(false)} py-2.5 pl-3 pr-8 text-sm font-medium`}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

const DIVIDER = "border-t border-slate-200 pt-6";
const DOTS = {
  instant: "bg-[color:var(--pe-color-primary-500)]",
  live: "bg-amber-500",
};

// One policy's parameters, grouped (rates, relief, behavioural response),
// with a footer bar: what Calculate will do (`status`: a tone, a text and an
// optional action) and the Calculate button. `showPresets` adds a "Start
// from" group (presets and HMRC ready-reckoner rows). It is a form, so Enter
// in an input calculates; `running` (a run in flight) disables it.
export default function ScheduleForm({ form, onChange, showPresets, onCalculate, running, status }) {
  const check = checkForm(form);
  const set = (patch) => onChange({ ...form, ...patch });
  const setBadr = (patch) => set({ badrForm: { ...form.badrForm, ...patch } });
  // Loading a preset or a ready-reckoner row keeps the chosen elasticity.
  const load = (schedule) => onChange(formOf(schedule.rates, schedule.badr, form.elasticity));
  const readyReckonerRow = check.rates ? (readyReckonerRowFor(check.rates, check.badr)?.id ?? "none") : "none";
  const errorFor = (field) => (check.errorField === field ? check.error : null);
  const elasticity = ELASTICITIES.find((option) => String(option.e_retention) === String(form.elasticity));
  const submit = (event) => {
    event.preventDefault();
    if (check.rates && !running) onCalculate(check);
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-6">
      {showPresets ? (
        <div>
          <SectionLabel>Start from</SectionLabel>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="preset" className="mb-1.5 block text-sm font-semibold text-slate-800">
                Preset
              </label>
              <Select
                id="preset"
                value={presetFor(check)}
                onChange={(id) => {
                  const chosen = PRESETS.find((candidate) => candidate.id === id);
                  if (chosen) load(chosen);
                }}
                options={[
                  ...PRESETS.map((candidate) => ({ value: candidate.id, label: candidate.label })),
                  { value: "custom", label: "Custom" },
                ]}
              />
            </div>
            <div>
              <label htmlFor="ready-reckoner" className="mb-1.5 block text-sm font-semibold text-slate-800">
                HMRC ready-reckoner row
              </label>
              <Select
                id="ready-reckoner"
                value={readyReckonerRow}
                onChange={(id) => {
                  const chosen = READY_RECKONER.rows.find((row) => row.id === id);
                  if (chosen) load(chosen);
                }}
                options={[
                  { value: "none", label: "None" },
                  ...READY_RECKONER.rows.map((row) => ({ value: row.id, label: row.label })),
                ]}
              />
            </div>
          </div>
        </div>
      ) : null}

      <div className={showPresets ? DIVIDER : ""}>
        <SectionLabel>Rates</SectionLabel>
        <div className="grid gap-4 md:grid-cols-3">
          {BANDS.map((band) => (
            <RateCard
              key={band.key}
              band={band}
              value={form.percents[band.key]}
              onChange={(value) => set({ percents: { ...form.percents, [band.key]: value } })}
              error={errorFor(band.key)}
            />
          ))}
        </div>
      </div>

      <div className={DIVIDER}>
        <SectionLabel tip={BADR_NOTE}>Business Asset Disposal Relief</SectionLabel>
        <div className="flex flex-wrap items-end gap-4">
          <Segmented
            label="Business Asset Disposal Relief"
            options={[
              { value: "keep", label: "Keep" },
              { value: "withdraw", label: "Withdraw" },
            ]}
            value={form.badrForm.mode}
            onChange={(mode) => setBadr({ mode })}
          />
          {form.badrForm.mode === "keep" ? (
            <div className="grid w-full gap-4 sm:w-auto sm:grid-cols-[9rem_11rem]">
              <div>
                <label htmlFor="badr-rate" className="mb-1.5 block text-sm font-semibold text-slate-800">
                  Rate
                </label>
                <PercentInput
                  id="badr-rate"
                  min={0}
                  large={false}
                  value={form.badrForm.rate}
                  onChange={(rate) => setBadr({ rate })}
                  invalid={Boolean(errorFor("badr_rate"))}
                  describedBy={errorFor("badr_rate") ? "badr-rate-error" : undefined}
                />
              </div>
              <div>
                <label htmlFor="badr-limit" className="mb-1.5 block text-sm font-semibold text-slate-800">
                  Lifetime limit
                </label>
                <Select
                  id="badr-limit"
                  value={String(form.badrForm.limit)}
                  onChange={(value) => setBadr({ limit: Number(value) })}
                  options={BADR_LIMITS.map((limit) => ({ value: String(limit), label: badrLimitLabel(limit) }))}
                />
              </div>
            </div>
          ) : null}
        </div>
        {errorFor("badr_rate") ? <FieldError id="badr-rate-error">{errorFor("badr_rate")}</FieldError> : null}
        <p className="mt-2 text-xs leading-5 text-slate-500">
          Current law: {describeBadr(BADR_CURRENT_LAW).toLowerCase()}.
          {form.badrForm.mode === "withdraw" ? " Withdrawn, qualifying gains take the main rates." : ""}
        </p>
        {check.reliefAboveBasic ? (
          <p className="mt-2 text-xs leading-5 text-amber-800">
            The relief&apos;s {formatPct(check.badr.rate * 100, 0)} is above the basic rate of{" "}
            {formatPct(check.rates.basic_rate * 100, 0)}. In law the relief is claimed, and a taxpayer
            whose qualifying gains fall in the basic rate band would not claim it; the model charges
            it anyway, so it overstates the tax on those gains.
          </p>
        ) : null}
      </div>

      <div className={DIVIDER}>
        <SectionLabel tip={ELASTICITY_NOTE}>Behavioural response</SectionLabel>
        <div className="max-w-md">
          <label htmlFor="elasticity" className="sr-only">
            Behavioural response
          </label>
          <Select
            id="elasticity"
            value={String(form.elasticity)}
            onChange={(value) => set({ elasticity: Number(value) })}
            describedBy="elasticity-detail"
            options={ELASTICITIES.map((option) => ({
              value: String(option.e_retention),
              label: splitLabel(option.label).name,
            }))}
          />
          <p id="elasticity-detail" className="mt-2 text-xs leading-5 text-slate-500">
            {elasticity ? splitLabel(elasticity.label).detail : ""}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-4 border-t border-slate-200 pt-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-start gap-2 text-sm leading-6 text-slate-600" role="status">
          <span aria-hidden="true" className={`mt-2 inline-block h-2 w-2 shrink-0 rounded-full ${DOTS[status.tone]}`} />
          <span>
            {status.text}
            {status.action ? <> {status.action}</> : null}
          </span>
        </p>
        <button
          type="submit"
          disabled={!check.rates || running}
          className="w-full rounded-lg bg-[color:var(--pe-color-primary-600)] px-8 py-3 text-base font-semibold text-white shadow-sm transition hover:bg-[color:var(--pe-color-primary-700)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--pe-color-primary-500)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
        >
          {running ? "Calculating…" : "Calculate"}
        </button>
      </div>
    </form>
  );
}
