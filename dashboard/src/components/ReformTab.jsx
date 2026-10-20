"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getDatasetInfo, getFirstYear } from "../lib/dataHelpers";
import { useExploration } from "../lib/exploreApi";
import {
  checkForm,
  formOf,
  initialChoice,
  isPrecomputed,
  precomputedSchedule,
  scheduleParams,
} from "../lib/schedule";
import EqualisationResults from "./EqualisationResults";
import LiveResults, { StatusLine } from "./LiveResults";
import ScheduleForm from "./ScheduleForm";
import SectionHeading from "./SectionHeading";
import { TabLink } from "./controls";

const CENTAX_URL =
  "https://centax.org.uk/wp-content/uploads/2024/10/AdvaniLonsdaleSummers2024_CGTReform.pdf#page=38";

// One policy in the chooser: a header that selects it and opens its box,
// and the box with its parameters.
function PolicyOption({ id, title, summary, selected, open, onToggle, children }) {
  const expanded = selected && open;
  return (
    <div
      className={`rounded-2xl border ${selected ? "border-[color:var(--pe-color-primary-600)]" : "border-slate-200"}`}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        aria-controls={`policy-${id}`}
        className="flex w-full items-start gap-3 rounded-2xl px-4 py-3 text-left transition-colors hover:bg-slate-50"
      >
        <span
          aria-hidden="true"
          className={`mt-1 inline-block h-4 w-4 shrink-0 rounded-full border-2 ${
            selected
              ? "border-[color:var(--pe-color-primary-600)] bg-[color:var(--pe-color-primary-600)] shadow-[inset_0_0_0_2px_white]"
              : "border-slate-400"
          }`}
        />
        <span className="min-w-0 flex-1">
          <span className="block text-base font-semibold text-slate-900">{title}</span>
          <span className="mt-0.5 block text-sm leading-6 text-slate-600">{summary}</span>
        </span>
        <span aria-hidden="true" className="mt-1 text-slate-400">
          {expanded ? "▴" : "▾"}
        </span>
      </button>
      {expanded ? (
        <div id={`policy-${id}`} className="border-t border-slate-200 px-4 pb-4 pt-4">
          {children}
        </div>
      ) : null}
    </div>
  );
}

// The Reform tab: choose equalisation with income tax or custom rates, set
// the parameters, and calculate. Equalisation at its own values shows the
// precomputed results at once; any other schedule runs live through
// /api/explore, as the old Rate explorer tab did.
export default function ReformTab({ data, datasetKey, onNavigate }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const dataset = getDatasetInfo(data);
  const firstYear = getFirstYear(data);
  const precomputed = useMemo(() => precomputedSchedule(data), [data]);
  // Read once: a shared link arrives with a full schedule in the URL.
  const initial = useMemo(() => initialChoice(searchParams, precomputed), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [policy, setPolicy] = useState(initial.policy);
  const [open, setOpen] = useState(true);
  const [forms, setForms] = useState(initial.forms);
  // Which results show: "precomputed", "live" (the exploration below) or "none".
  const [view, setView] = useState(initial.view);
  const { run, reset, status, result, error, elapsedSeconds } = useExploration();
  const autoRan = useRef(false);
  const chooser = useRef(null);

  const replaceSchedule = useCallback(
    (schedule) => {
      const query = scheduleParams(searchParams.toString(), schedule).toString();
      router.replace(query ? `/?${query}` : "/", { scroll: false });
    },
    [router, searchParams],
  );

  const calculate = useCallback(
    (check, options = {}) => {
      if (!check.rates) return;
      if (isPrecomputed(check, precomputed)) {
        reset();
        setView("precomputed");
        replaceSchedule(null);
        return;
      }
      setView("live");
      replaceSchedule(check);
      const badr = check.badr.withdrawn
        ? { withdrawn: true }
        : { rate: check.badr.rate, lifetime_limit: check.badr.lifetime_limit };
      run({ dataset: datasetKey, rates: check.rates, badr, elasticity: check.elasticity }, options);
    },
    [precomputed, datasetKey, run, reset, replaceSchedule],
  );

  // A shared link shows its schedule's result if one is stored (or already
  // computing), but never starts a computation on page load: a crawler or a
  // scripted link could otherwise spend the daily budget without a click.
  // A link to the old Rate explorer tab has its `tab` retired either way.
  useEffect(() => {
    if (autoRan.current) return;
    autoRan.current = true;
    if (initial.view === "live") calculate(checkForm(initial.forms.custom), { cacheOnly: true });
    else if (searchParams.get("tab") === "explorer") replaceSchedule(null);
  }, [initial, calculate, searchParams, replaceSchedule]);

  const choose = (id) => {
    if (id === policy) setOpen((current) => !current);
    else {
      setPolicy(id);
      setOpen(true);
    }
  };
  const setForm = (id) => (form) => setForms((current) => ({ ...current, [id]: form }));
  const equaliseDefault = formOf(precomputed.rates, precomputed.badr, precomputed.elasticity);
  const equaliseEdited = !isPrecomputed(checkForm(forms.equalise), precomputed);

  // From the results: open a policy's box and bring the chooser into view.
  const openPolicy = (id) => {
    setPolicy(id);
    setOpen(true);
    window.requestAnimationFrame(() => chooser.current?.scrollIntoView({ behavior: "smooth" }));
  };
  const showEqualisation = () => {
    setForms((current) => ({ ...current, equalise: equaliseDefault }));
    calculate(checkForm(equaliseDefault));
    openPolicy("equalise");
  };

  return (
    <div className="space-y-6">
      <div className="pt-2">
        <SectionHeading
          size="lg"
          title="Choose a reform"
          description={
            <>
              Score equalisation with income tax rates, whose results are precomputed, or a
              schedule of CGT rates you choose, run live through the same pipeline on{" "}
              {dataset.shortLabel} for {firstYear} to 2030-31 with the same behavioural response.
              Open a policy to see or change its parameters, then calculate.
            </>
          }
        />
      </div>

      <section ref={chooser} className="section-card scroll-mt-24 space-y-3" aria-label="Policy">
        <PolicyOption
          id="equalise"
          title="Equalise with income tax"
          summary="Each CGT rate set to the matching income tax rate, with Business Asset Disposal Relief withdrawn."
          selected={policy === "equalise"}
          open={open}
          onToggle={() => choose("equalise")}
        >
          <p className="mb-5 text-sm leading-6 text-slate-600">
            Current law taxes capital gains at lower rates than income. The reform aligns each
            CGT rate with the corresponding income tax rate from {firstYear} and withdraws
            Business Asset Disposal Relief, so gains that qualify for it take the new rates too,
            as in CenTax&apos;s rates-only estimate. Taxpayers respond by realising fewer gains,
            modelled with{" "}
            <a
              href={CENTAX_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="underline decoration-1 underline-offset-2 hover:opacity-80"
            >
              CenTax&apos;s central elasticity
            </a>{" "}
            with respect to the share of each gain they keep, applied in that form. CenTax
            estimate that elasticity for a wider package of CGT reforms;{" "}
            <TabLink onNavigate={onNavigate} tab="methodology" section="elasticity">
              the Methodology tab sets out what that means for a rates-only reform
            </TabLink>
            , and the sensitivity table in the results shows the yield at other elasticities.
          </p>
          <ScheduleForm
            form={forms.equalise}
            onChange={setForm("equalise")}
            onCalculate={calculate}
            running={status === "running"}
            note={
              equaliseEdited ? (
                <>
                  These values differ from equalisation&apos;s, so Calculate runs them live, as
                  Custom rates does.{" "}
                  <button
                    type="button"
                    onClick={() => setForms((current) => ({ ...current, equalise: equaliseDefault }))}
                    className="font-semibold text-[color:var(--pe-color-primary-600)] underline decoration-1 underline-offset-2 hover:opacity-80"
                  >
                    Restore equalisation&apos;s values
                  </button>
                </>
              ) : (
                "At these values the results are precomputed and show at once. Change any value to run it live instead."
              )
            }
          />
        </PolicyOption>

        <PolicyOption
          id="custom"
          title="Custom rates"
          summary="Any CGT rates, treatment of the relief and behavioural response, run live in about half a minute."
          selected={policy === "custom"}
          open={open}
          onToggle={() => choose("custom")}
        >
          <p className="mb-5 text-sm leading-6 text-slate-600">
            Set a rate for each band, in percent, or load a preset or one of HMRC&apos;s
            ready-reckoner rows. The chosen rates apply to the main schedule and to residential
            property gains. Business Asset Disposal Relief can be kept, at a rate and lifetime
            limit you choose, or withdrawn. Every completed run is cached, so a schedule anyone
            has run before is served at once.
          </p>
          <ScheduleForm
            form={forms.custom}
            onChange={setForm("custom")}
            showPresets
            onCalculate={calculate}
            running={status === "running"}
          />
        </PolicyOption>

        {view === "live" ? (
          <StatusLine
            status={status}
            elapsedSeconds={elapsedSeconds}
            error={error}
            result={result}
            datasetLabel={dataset.shortLabel}
          />
        ) : null}
      </section>

      {view === "precomputed" ? (
        <EqualisationResults data={data} onNavigate={onNavigate} onChooseCustom={() => openPolicy("custom")} />
      ) : null}
      {view === "live" && result ? (
        <LiveResults data={data} result={result} onNavigate={onNavigate} onShowEqualisation={showEqualisation} />
      ) : null}
    </div>
  );
}
