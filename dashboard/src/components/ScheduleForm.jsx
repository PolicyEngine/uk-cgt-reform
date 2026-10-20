"use client";

import { badrLimitLabel, describeBadr } from "../lib/dataHelpers";
import { formatPct } from "../lib/formatters";
import {
  BADR_CURRENT_LAW,
  BADR_LIMITS,
  BANDS,
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
import { LabelledSelect, Toggle } from "./controls";

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

// One policy's parameters: the three main rates, the relief and the
// behavioural response, with the Calculate button. `showPresets` adds the
// preset and HMRC ready-reckoner pickers (Custom rates). It is a form, so
// Enter in a rate input calculates; `running` (a run in flight) disables it.
export default function ScheduleForm({ form, onChange, showPresets, onCalculate, running, note }) {
  const check = checkForm(form);
  const set = (patch) => onChange({ ...form, ...patch });
  const setBadr = (patch) => set({ badrForm: { ...form.badrForm, ...patch } });
  // Loading a preset or a ready-reckoner row keeps the chosen elasticity.
  const load = (schedule) => onChange(formOf(schedule.rates, schedule.badr, form.elasticity));
  const readyReckonerRow = check.rates ? (readyReckonerRowFor(check.rates, check.badr)?.id ?? "none") : "none";

  const submit = (event) => {
    event.preventDefault();
    if (check.rates && !running) onCalculate(check);
  };

  return (
    <form onSubmit={submit} noValidate>
      {showPresets ? (
        <div className="mb-5 flex flex-wrap items-center gap-4">
          <LabelledSelect
            label="Preset"
            options={[
              ...PRESETS.map((candidate) => ({ value: candidate.id, label: candidate.label })),
              { value: "custom", label: "Custom" },
            ]}
            value={presetFor(check)}
            onChange={(id) => {
              const chosen = PRESETS.find((candidate) => candidate.id === id);
              if (chosen) load(chosen);
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
              if (chosen) load(chosen);
            }}
          />
        </div>
      ) : null}
      <div className="grid gap-4 md:grid-cols-3">
        {BANDS.map((band) => (
          <RateInput
            key={band.key}
            band={band}
            value={form.percents[band.key]}
            onChange={(value) => set({ percents: { ...form.percents, [band.key]: value } })}
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
            value={form.badrForm.mode}
            onChange={(mode) => setBadr({ mode })}
          />
          {form.badrForm.mode === "keep" ? (
            <>
              <label className="inline-flex items-center gap-2 text-sm text-slate-600">
                Rate
                <input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  max={PCT_MAX}
                  step={STEP_PCT}
                  value={form.badrForm.rate}
                  onChange={(event) => setBadr({ rate: event.target.value })}
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
                value={String(form.badrForm.limit)}
                onChange={(value) => setBadr({ limit: Number(value) })}
              />
            </>
          ) : null}
        </div>
        <p className="mt-2 text-xs leading-5 text-slate-500">
          Gains on qualifying business disposals, Investors&apos; Relief included. Current law
          charges {describeBadr(BADR_CURRENT_LAW)}; withdrawn, those gains take the main rates
          above. The relief&apos;s rate may not exceed the additional rate. The model charges
          it on every qualifying gain, without the claim a taxpayer makes in law.
        </p>
      </fieldset>
      <div className="mt-5 flex flex-wrap items-center gap-4">
        <LabelledSelect
          label="Behavioural response"
          options={ELASTICITIES.map((option) => ({
            value: String(option.e_retention),
            label: option.label,
          }))}
          value={String(form.elasticity)}
          onChange={(value) => set({ elasticity: Number(value) })}
        />
        <button
          type="submit"
          disabled={!check.rates || running}
          className="rounded-md bg-[color:var(--pe-color-primary-600)] px-5 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {running ? "Calculating…" : "Calculate"}
        </button>
      </div>
      {note ? <p className="mt-3 text-xs leading-5 text-slate-500">{note}</p> : null}
      {check.error ? <p className="mt-3 text-sm leading-6 text-red-700">{check.error}</p> : null}
      {check.reliefAboveBasic ? (
        <p className="mt-3 text-sm leading-6 text-amber-800">
          The relief&apos;s {formatPct(check.badr.rate * 100, 0)} is above the basic rate of{" "}
          {formatPct(check.rates.basic_rate * 100, 0)}. The model charges the relief&apos;s
          rate on every qualifying gain, but in law the relief is claimed, and a taxpayer whose
          qualifying gains fall in the basic rate band would not claim it, so the model overstates
          the tax on those gains.
        </p>
      ) : null}
    </form>
  );
}
