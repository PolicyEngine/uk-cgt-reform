"use client";

import { useState } from "react";
import { badrLimitLabel, describeBadr } from "../lib/dataHelpers";
import { formatPct, formatSignedPoints } from "../lib/formatters";
import {
  BADR_CURRENT_LAW,
  BADR_LIMITS,
  BANDS,
  CURRENT_LAW,
  ELASTICITIES,
  ELASTICITY_MAX,
  ELASTICITY_MIN,
  ELASTICITY_STEP,
  PCT_MAX,
  PCT_MIN,
  STEP_PCT,
  checkForm,
  elasticityOption,
  elasticityShortName,
} from "../lib/schedule";
import {
  FIELD,
  FieldLabel,
  HINT,
  InfoTip,
  PRIMARY_BUTTON,
  Pill,
  SourceLink,
  TabLink,
  fieldBorder,
} from "./controls";

// The sources of the elasticities the select offers.
const CENTAX_ELASTICITY =
  "https://centax.org.uk/wp-content/uploads/2024/10/AdvaniLonsdaleSummers2024_CGTReform.pdf#page=38";
const OBR_COSTING = "https://obr.uk/docs/dlm_uploads/CGT-supplementary-release-Jan-2025.pdf";

// One short line under each rate; the band's full note sits in its tooltip.
const BAND_HINTS = {
  basic_rate: "Within the basic rate band",
  higher_rate: "Up to £125,140",
  additional_rate: "Above £125,140",
};
const BADR_NOTE =
  "A lower rate on gains from selling all or part of a business, or certain shares (Investors' Relief is included): 18% from April 2026, on up to £1m of such gains over a person's lifetime. Withdrawing it means these gains pay the main rates. The model gives it on every qualifying gain, as if each person claims it.";
const ELASTICITY_NOTE =
  "The elasticity of realised gains with respect to the retention rate (1 − t): taxpayers realise fewer gains as the share of each gain they keep falls.";

const RETENTION_ELASTICITY_NOTE =
  "How much taxpayers cut the gains they realise when the tax rate on them rises. At 0 they do not respond; at 1.0, CenTax's central value, a 10% fall in the share of each gain kept after tax cuts realised gains by 10%; the HMRC/OBR official value is 3.6 for the main rates.";

// The select's value for a typed elasticity.
const CUSTOM = "custom";

// "CenTax central (retention elasticity 1.0)" → a short name for the select
// and its detail for the line beneath. The static case reads "No response".
const SHORT_NAMES = { Static: "No response" };
function splitLabel(label) {
  const match = label.match(/^(.*?)\s*\((.*)\)$/);
  if (!match) return { name: SHORT_NAMES[label] ?? label, detail: "" };
  return { name: SHORT_NAMES[match[1]] ?? match[1], detail: match[2][0].toUpperCase() + match[2].slice(1) };
}

function FieldError({ id, children }) {
  return (
    <p id={id} className="mt-2 text-xs leading-5 text-red-700">
      {children}
    </p>
  );
}

// A number input with up/down buttons that step it by `step` within its
// bounds, and an optional unit ("%") inside the field.
function SteppedInput({ id, value, onChange, invalid, describedBy, min, max, step, decimals, unit, stepLabel }) {
  const factor = 10 ** decimals;
  const move = (direction) => {
    const current = Number(value);
    const base = value === "" || !Number.isFinite(current) ? min : current;
    const next = Math.min(max, Math.max(min, Math.round((base + direction * step) * factor) / factor));
    onChange(String(next));
  };
  const stepButton =
    "flex h-1/2 w-7 items-center justify-center text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 focus:outline-none focus-visible:bg-slate-100 disabled:opacity-30";
  return (
    <div className="relative">
      <input
        id={id}
        type="number"
        inputMode="decimal"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        onChange={(event) => onChange(event.target.value)}
        className={`${FIELD} ${fieldBorder(invalid)} w-full ${unit ? "pr-16" : "pr-10"}`}
      />
      {unit ? (
        <span className="pointer-events-none absolute inset-y-0 right-9 flex items-center text-base font-semibold text-slate-400">
          {unit}
        </span>
      ) : null}
      <span className="absolute inset-y-px right-px flex flex-col overflow-hidden rounded-r-lg border-l border-slate-200">
        <button
          type="button"
          aria-label={`Increase by ${stepLabel}`}
          className={`${stepButton} border-b border-slate-200`}
          disabled={Number(value) >= max}
          onClick={() => move(1)}
        >
          <svg aria-hidden="true" viewBox="0 0 10 6" className="h-1.5 w-2.5" fill="currentColor"><path d="M5 0l5 6H0z" /></svg>
        </button>
        <button
          type="button"
          aria-label={`Decrease by ${stepLabel}`}
          className={stepButton}
          disabled={value !== "" && Number(value) <= min}
          onClick={() => move(-1)}
        >
          <svg aria-hidden="true" viewBox="0 0 10 6" className="h-1.5 w-2.5" fill="currentColor"><path d="M0 0h10L5 6z" /></svg>
        </button>
      </span>
    </div>
  );
}

// A percentage input with its "%" inside the field, stepping by STEP_PCT.
function PercentInput({ min = PCT_MIN, ...props }) {
  return (
    <SteppedInput {...props} min={min} max={PCT_MAX} step={STEP_PCT} decimals={2} unit="%" stepLabel="one point" />
  );
}

function Select({ id, value, onChange, options, describedBy }) {
  return (
    <select
      id={id}
      value={value}
      aria-describedby={describedBy}
      onChange={(event) => onChange(event.target.value)}
      className={`${FIELD} ${fieldBorder()} w-full pr-8 text-sm`}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

// The rate's distance from current law, in percentage points.
function ChangeChip({ value, reference }) {
  const number = Number(value);
  if (value === "" || !Number.isFinite(number)) return null;
  const gap = Math.round((number - reference * 100) * 100) / 100;
  if (gap === 0) return <span className="text-sm text-slate-400">No change</span>;
  return <Pill tone="teal">{formatSignedPoints(gap)}</Pill>;
}

// The sub-tabs along the top of the panel, one per group of parameters,
// each with the value it currently holds; a red dot marks one with an error.
function SubTabs({ steps, current, onSelect }) {
  return (
    <div role="tablist" aria-label="Parameters" className="-mx-5 -mt-5 mb-5 flex overflow-x-auto border-b border-slate-200 px-3 sm:-mx-6 sm:-mt-6 sm:px-4">
      {steps.map((step) => {
        const selected = step.id === current;
        return (
          <button
            key={step.id}
            type="button"
            role="tab"
            id={`step-tab-${step.id}`}
            aria-selected={selected}
            aria-controls={`step-${step.id}`}
            onClick={() => onSelect(step.id)}
            className={`-mb-px flex shrink-0 flex-col border-b-2 px-3 pb-3 pt-4 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[color:var(--pe-color-primary-500)] sm:px-4 ${
              selected
                ? "border-[color:var(--pe-color-primary-600)]"
                : "border-transparent hover:border-slate-300"
            }`}
          >
            <span className={`flex items-center gap-1.5 text-sm font-semibold ${selected ? "text-[color:var(--pe-color-primary-700)]" : "text-slate-600"}`}>
              {step.label}
              {step.error ? <span aria-label="has an error" className="h-1.5 w-1.5 rounded-full bg-red-600" /> : null}
            </span>
            <span className="text-xs tabular-nums text-slate-500">{step.summary}</span>
          </button>
        );
      })}
    </div>
  );
}

// One sub-tab's content, with a line saying what it sets.
function Step({ id, intro, tip, tipLabel, children }) {
  return (
    <section id={`step-${id}`} role="tabpanel" aria-labelledby={`step-tab-${id}`}>
      <p className="mb-4 text-sm leading-6 text-slate-600">
        {intro}
        {tip ? (
          <>
            {" "}
            <InfoTip label={tipLabel}>{tip}</InfoTip>
          </>
        ) : null}
      </p>
      {children}
    </section>
  );
}

// The rates table's columns: band, the reform's rate, current law, change.
// Below `sm` a row wraps to the band over the input and its comparison.
const RATE_GRID = "grid grid-cols-2 items-center gap-x-4 gap-y-2 sm:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,0.8fr)_minmax(0,0.6fr)]";

function RateRow({ band, value, onChange, error }) {
  const id = `rate-${band.key}`;
  const currentLaw = formatPct(CURRENT_LAW.rates[band.key] * 100, 0);
  return (
    <div className="border-t border-slate-200 py-3">
      <div className={RATE_GRID}>
        <div className="col-span-2 sm:col-span-1">
          <div className="flex items-center gap-2">
            <label htmlFor={id} className="text-sm font-semibold text-slate-800">
              {band.label}
            </label>
            <InfoTip label={`About the ${band.label.toLowerCase()}`}>{band.note}</InfoTip>
          </div>
          <p id={`${id}-hint`} className={HINT}>
            {BAND_HINTS[band.key]}
          </p>
        </div>
        <div className="max-w-[10rem]">
          <PercentInput
            id={id}
            value={value}
            onChange={onChange}
            invalid={Boolean(error)}
            describedBy={error ? `${id}-error` : `${id}-hint`}
          />
        </div>
        <div className="flex items-center gap-2 sm:contents">
          <span className="text-sm tabular-nums text-slate-600">
            <span className="sm:hidden">Current law </span>
            {currentLaw}
          </span>
          <span>
            <ChangeChip value={value} reference={CURRENT_LAW.rates[band.key]} />
          </span>
        </div>
      </div>
      {error ? <FieldError id={`${id}-error`}>{error}</FieldError> : null}
    </div>
  );
}

// One policy's parameters as one panel with sub-tabs (CGT rates; relief and
// behavioural response) and one button: Next, or Calculate on the last
// sub-tab. It is a form: Enter moves to the next sub-tab, or calculates on
// the last; `running` (a run in flight) disables it.
export default function ScheduleForm({ form, onChange, onCalculate, running, onNavigate, about }) {
  const [showAbout, setShowAbout] = useState(false);
  const check = checkForm(form);
  const set = (patch) => onChange({ ...form, ...patch });
  const setBadr = (patch) => set({ badrForm: { ...form.badrForm, ...patch } });
  const errorFor = (field) => (check.errorField === field ? check.error : null);
  const custom = form.customElasticity !== null && form.customElasticity !== undefined;
  // The case the select shows; with Custom on, the case a typed value equals.
  const elasticity = custom ? elasticityOption(check.elasticity) : elasticityOption(form.elasticity);
  const responseSummary = custom
    ? check.elasticity === null
      ? "Elasticity –"
      : elasticityShortName(check.elasticity)
    : elasticity
      ? splitLabel(elasticity.label).name
      : "";

  const badrSummary = form.badrForm.mode === "withdraw"
    ? "Withdrawn"
    : `${form.badrForm.rate || "–"}% to ${badrLimitLabel(form.badrForm.limit)}`;
  const steps = [
    {
      id: "rates",
      label: "CGT rates",
      summary: BANDS.map((band) => `${form.percents[band.key] || "–"}%`).join(" · "),
      error: BANDS.some((band) => check.errorField === band.key),
    },
    {
      id: "response",
      label: "Relief and behaviour",
      summary: [badrSummary, responseSummary].filter(Boolean).join(" · "),
      error: check.errorField === "badr_rate" || check.errorField === "elasticity",
    },
  ];
  const [step, setStep] = useState(steps[0].id);
  const current = steps.some((candidate) => candidate.id === step) ? step : steps[0].id;
  const next = steps[steps.findIndex((candidate) => candidate.id === current) + 1];
  // Calculate is on the last sub-tab only; before it, Enter moves on.
  const submit = (event) => {
    event.preventDefault();
    if (next) setStep(next.id);
    else if (check.rates && !running) onCalculate(check);
  };

  return (
    <form onSubmit={submit} noValidate>
      <SubTabs steps={steps} current={current} onSelect={setStep} />

      {current === "rates" ? (
        <Step id="rates" intro="The CGT rate on gains in each income tax band.">
          <div
            aria-hidden="true"
            className={`${RATE_GRID} hidden pb-2 text-xs font-semibold text-slate-500 sm:grid`}
          >
            <span>Band</span>
            <span>Reform</span>
            <span>Current law</span>
            <span>Change</span>
          </div>
          {BANDS.map((band) => (
            <RateRow
              key={band.key}
              band={band}
              value={form.percents[band.key]}
              onChange={(value) => set({ percents: { ...form.percents, [band.key]: value } })}
              error={errorFor(band.key)}
            />
          ))}
        </Step>
      ) : null}

      {current === "response" ? (
        <Step
          id="response"
          intro={
            <>
              Keep or withdraw the relief, and choose how strongly taxpayers respond.
              {about ? (
                <>
                  {" "}
                  <button
                    type="button"
                    aria-expanded={showAbout}
                    onClick={() => setShowAbout((open) => !open)}
                    className="inline-flex items-center gap-1 font-semibold text-[color:var(--pe-color-primary-700)] hover:opacity-80"
                  >
                    <span aria-hidden="true" className={`text-xs transition-transform ${showAbout ? "rotate-90" : ""}`}>▶</span>
                    {about.label}
                  </button>
                </>
              ) : null}
            </>
          }
        >
          {about && showAbout ? <div className="mb-4 rounded-lg bg-slate-50 px-4 py-3">{about.content}</div> : null}
          <div className="max-w-xl space-y-6">
            <div>
              <div className="mb-2 flex items-center gap-2">
                <label htmlFor="badr-mode" className="text-sm font-semibold text-slate-800">
                  Business Asset Disposal Relief
                </label>
                <InfoTip label="About Business Asset Disposal Relief">{BADR_NOTE}</InfoTip>
              </div>
              <Select
                id="badr-mode"
                value={form.badrForm.mode}
                onChange={(mode) => setBadr({ mode })}
                options={[
                  { value: "keep", label: "Keep the relief" },
                  { value: "withdraw", label: "Withdraw the relief" },
                ]}
              />
              {form.badrForm.mode === "keep" ? (
                <div className="mt-4 grid grid-cols-2 gap-4">
                  <div>
                    <FieldLabel htmlFor="badr-rate">Rate</FieldLabel>
                    <PercentInput
                      id="badr-rate"
                      min={0}
                      value={form.badrForm.rate}
                      onChange={(rate) => setBadr({ rate })}
                      invalid={Boolean(errorFor("badr_rate"))}
                      describedBy={errorFor("badr_rate") ? "badr-rate-error" : undefined}
                    />
                  </div>
                  <div>
                    <FieldLabel htmlFor="badr-limit">Lifetime limit</FieldLabel>
                    <Select
                      id="badr-limit"
                      value={String(form.badrForm.limit)}
                      onChange={(value) => setBadr({ limit: Number(value) })}
                      options={BADR_LIMITS.map((limit) => ({ value: String(limit), label: badrLimitLabel(limit) }))}
                    />
                  </div>
                </div>
              ) : null}
              {errorFor("badr_rate") ? <FieldError id="badr-rate-error">{errorFor("badr_rate")}</FieldError> : null}
              <p className={`mt-2 ${HINT}`}>
                Current law {describeBadr(BADR_CURRENT_LAW).toLowerCase()}
                {form.badrForm.mode === "withdraw" ? "; withdrawn, qualifying gains take the main rates." : "."}
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
            <div>
              <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-800">
                Behavioural response
                <InfoTip label="About the behavioural response">{ELASTICITY_NOTE}</InfoTip>
              </h3>
              <label htmlFor="elasticity" className="sr-only">
                Behavioural response
              </label>
              <Select
                id="elasticity"
                value={custom ? CUSTOM : String(form.elasticity)}
                onChange={(value) =>
                  value === CUSTOM
                    ? set({ customElasticity: String(form.elasticity) })
                    : set({ elasticity: Number(value), customElasticity: null })
                }
                describedBy="elasticity-detail"
                options={[
                  ...ELASTICITIES.map((option) => ({
                    value: String(option.e_retention),
                    label: splitLabel(option.label).name,
                  })),
                  { value: CUSTOM, label: "Custom" },
                ]}
              />
              {custom ? (
                <div className="mt-4">
                  <div className="mb-1.5 flex items-center gap-2">
                    <label htmlFor="elasticity-custom" className="text-xs font-semibold text-slate-600">
                      Retention elasticity
                    </label>
                    <InfoTip label="About the retention elasticity">{RETENTION_ELASTICITY_NOTE}</InfoTip>
                  </div>
                  <div className="max-w-[10rem]">
                    <SteppedInput
                      id="elasticity-custom"
                      value={form.customElasticity}
                      onChange={(value) => set({ customElasticity: value })}
                      min={ELASTICITY_MIN}
                      max={ELASTICITY_MAX}
                      step={ELASTICITY_STEP}
                      decimals={1}
                      stepLabel={String(ELASTICITY_STEP)}
                      invalid={Boolean(errorFor("elasticity"))}
                      describedBy={errorFor("elasticity") ? "elasticity-error" : "elasticity-detail"}
                    />
                  </div>
                  {errorFor("elasticity") ? <FieldError id="elasticity-error">{errorFor("elasticity")}</FieldError> : null}
                </div>
              ) : null}
              <p id="elasticity-detail" className={`mt-2 ${HINT}`}>
                {custom
                  ? "How strongly taxpayers cut realised gains as rates rise: CenTax's central value is 1.0, the official 3.6."
                  : elasticity
                    ? splitLabel(elasticity.label).detail
                    : ""}
              </p>
              <p className={`mt-2 ${HINT}`}>
                From no response, through <SourceLink href={CENTAX_ELASTICITY}>CenTax&apos;s</SourceLink>{" "}
                estimates, to the HMRC/OBR official{" "}
                <SourceLink href={OBR_COSTING}>assumption</SourceLink>;{" "}
                <TabLink onNavigate={onNavigate} tab="methodology" section="elasticity">
                  Methodology
                </TabLink>{" "}
                describes each value.
              </p>
            </div>
          </div>
        </Step>
      ) : null}

      <div className="mt-4 flex justify-end">
        {next ? (
          <button type="submit" className={`${PRIMARY_BUTTON} w-full sm:w-auto`}>
            Next →
          </button>
        ) : (
          <button type="submit" disabled={!check.rates || running} className={`${PRIMARY_BUTTON} w-full sm:w-auto`}>
            {running ? "Calculating…" : "Calculate"}
          </button>
        )}
      </div>
    </form>
  );
}
