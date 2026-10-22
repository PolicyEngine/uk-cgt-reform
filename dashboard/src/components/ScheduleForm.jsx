"use client";

import { useState } from "react";
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
  STEP_PCT,
  checkForm,
} from "../lib/schedule";
import {
  FIELD,
  FieldLabel,
  HINT,
  InfoTip,
  PRIMARY_BUTTON,
  Pill,
  TabLink,
  Toggle,
  fieldBorder,
} from "./controls";

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

// "CenTax central (retention elasticity 1.0)" → a short name for the select
// and its detail for the line beneath.
function splitLabel(label) {
  const match = label.match(/^(.*?)\s*\((.*)\)$/);
  if (!match) return { name: label, detail: "" };
  return { name: match[1], detail: match[2][0].toUpperCase() + match[2].slice(1) };
}

function FieldError({ id, children }) {
  return (
    <p id={id} className="mt-2 text-xs leading-5 text-red-700">
      {children}
    </p>
  );
}

// A percentage input with its "%" inside the field.
function PercentInput({ id, value, onChange, invalid, describedBy, min = PCT_MIN }) {
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
        className={`${FIELD} ${fieldBorder(invalid)} w-full pr-9`}
      />
      <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-base font-semibold text-slate-400">
        %
      </span>
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
  return <Pill tone="teal">{`${gap > 0 ? "+" : "−"}${Math.abs(gap)} pp`}</Pill>;
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
    <section id={`step-${id}`} role="tabpanel" aria-labelledby={`step-tab-${id}`} className="min-h-[15rem]">
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

// One policy's parameters as one panel with sub-tabs (CGT rates, relief,
// behavioural response) and one button: Next, or Calculate on the last
// sub-tab. It is a form: Enter moves to the next sub-tab, or calculates on
// the last; `running` (a run in flight) disables it.
export default function ScheduleForm({ form, onChange, onCalculate, running, onNavigate, about }) {
  const [showAbout, setShowAbout] = useState(false);
  const check = checkForm(form);
  const set = (patch) => onChange({ ...form, ...patch });
  const setBadr = (patch) => set({ badrForm: { ...form.badrForm, ...patch } });
  const errorFor = (field) => (check.errorField === field ? check.error : null);
  const elasticity = ELASTICITIES.find((option) => String(option.e_retention) === String(form.elasticity));

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
    { id: "relief", label: "Relief", summary: badrSummary, error: check.errorField === "badr_rate" },
    { id: "response", label: "Behaviour", summary: elasticity ? splitLabel(elasticity.label).name : "" },
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

      {current === "relief" ? (
        <Step
          id="relief"
          intro="Business Asset Disposal Relief: a lower rate on qualifying business disposals."
          tip={BADR_NOTE}
          tipLabel="About Business Asset Disposal Relief"
        >
          <div className="max-w-xl">
            <Toggle
              label="Business Asset Disposal Relief"
              fullWidth
              options={[
                { value: "keep", label: "Keep" },
                { value: "withdraw", label: "Withdraw" },
              ]}
              value={form.badrForm.mode}
              onChange={(mode) => setBadr({ mode })}
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
        </Step>
      ) : null}

      {current === "response" ? (
        <Step
          id="response"
          intro={
            <>
              How strongly taxpayers cut the gains they realise as rates rise.{" "}
              <InfoTip label="About the behavioural response">{ELASTICITY_NOTE}</InfoTip> The options run from
              no response, through CenTax&apos;s estimates, to the HMRC/OBR official assumption;{" "}
              <TabLink onNavigate={onNavigate} tab="methodology" section="elasticity">
                Methodology
              </TabLink>{" "}
              explains how they differ.
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
          <div className="max-w-xl">
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
            <p id="elasticity-detail" className={`mt-2 ${HINT}`}>
              {elasticity ? splitLabel(elasticity.label).detail : ""}
            </p>
          </div>
        </Step>
      ) : null}

      <div className="mt-6 flex justify-end">
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
