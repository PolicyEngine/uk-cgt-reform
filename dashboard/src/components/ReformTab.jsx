"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { describeBadr, getDatasetInfo, getFirstYear } from "../lib/dataHelpers";
import { formatPct } from "../lib/formatters";
import { useExploration } from "../lib/exploreApi";
import { initialState, isStale, reformReducer } from "../lib/reformState";
import {
  BANDS,
  checkForm,
  formOf,
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
const POLICY_TITLES = { equalise: "Equalise with income tax", custom: "Custom rates" };

const PILL = "rounded-full px-2.5 py-0.5 text-xs font-semibold";

// One policy in the chooser: a tile that selects it (or, selected, closes
// its panel), with a radio-style mark and a call to action so it reads as a
// choice. The selected policy's parameters open in a box below.
function PolicyTile({ id, sentence, pills, speed, selected, onSelect }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      aria-controls={selected ? "policy-panel" : undefined}
      id={`policy-tile-${id}`}
      className={`group relative flex h-full w-full cursor-pointer flex-col rounded-2xl border-2 p-5 text-left shadow-sm transition duration-150 hover:-translate-y-0.5 hover:border-[color:var(--pe-color-primary-500)] hover:shadow-md focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[color:var(--pe-color-primary-600)] sm:p-6 ${
        selected
          ? "border-[color:var(--pe-color-primary-600)] bg-[color:var(--pe-color-primary-50)]"
          : "border-slate-300 bg-white"
      }`}
    >
      <span
        aria-hidden="true"
        className={`absolute right-5 top-5 flex h-6 w-6 items-center justify-center rounded-full border-2 sm:right-6 sm:top-6 ${
          selected
            ? "border-[color:var(--pe-color-primary-600)] bg-[color:var(--pe-color-primary-600)]"
            : "border-slate-400 bg-white group-hover:border-[color:var(--pe-color-primary-500)]"
        }`}
      >
        {selected ? <span className="h-2.5 w-2.5 rounded-full bg-white" /> : null}
      </span>
      <span className="pr-10 text-lg font-bold text-slate-900">{POLICY_TITLES[id]}</span>
      <span className="mt-1.5 block text-sm leading-6 text-slate-600">{sentence}</span>
      <span className="mt-3 flex flex-wrap gap-2">
        {pills.map((pill) => (
          <span key={pill} className={`${PILL} bg-slate-100 text-slate-700`}>
            {pill}
          </span>
        ))}
        <span
          className={`${PILL} ${
            speed.instant
              ? "bg-[color:var(--pe-color-primary-100)] text-[color:var(--pe-color-primary-800)]"
              : "bg-amber-100 text-amber-900"
          }`}
        >
          {speed.label}
        </span>
      </span>
      <span className="mt-auto pt-5">
        <span
          className={`inline-flex items-center rounded-md border px-3 py-1.5 text-sm font-semibold transition-colors ${
            selected
              ? "border-[color:var(--pe-color-primary-600)] bg-[color:var(--pe-color-primary-600)] text-white"
              : "border-[color:var(--pe-color-primary-600)] bg-white text-[color:var(--pe-color-primary-700)] group-hover:bg-[color:var(--pe-color-primary-600)] group-hover:text-white"
          }`}
        >
          {selected ? "✓ Selected" : "Choose this reform →"}
        </span>
      </span>
    </button>
  );
}

// The Reform tab: choose equalisation with income tax or custom rates, set
// the parameters, and calculate. Nothing shows until Calculate, except for a
// link that carries a schedule or asks for equalisation's results.
// Equalisation at its own values shows the precomputed results at once; any
// other schedule runs live through /api/explore.
export default function ReformTab({ data, datasetKey, onNavigate, anchor }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const dataset = getDatasetInfo(data);
  const firstYear = getFirstYear(data);
  const precomputed = useMemo(() => precomputedSchedule(data), [data]);
  // Read once: a shared link arrives with a full schedule in the URL.
  const [state, dispatch] = useReducer(reformReducer, null, () => initialState(searchParams, precomputed));
  const { policy, forms, shown } = state;
  const { run, reset, status, result, error, elapsedSeconds } = useExploration();
  const inFlight = status === "running" || status === "checking";
  const mounted = useRef(false);
  const results = useRef(null);
  // The schedule a live run will write to the URL once it succeeds, and
  // whether to scroll to its results then (not for a link opened on load).
  const pending = useRef(null);

  const replaceSchedule = useCallback(
    (schedule) => {
      const query = scheduleParams(searchParams.toString(), schedule).toString();
      router.replace(query ? `/?${query}` : "/", { scroll: false });
    },
    [router, searchParams],
  );

  // A scroll asked for with the results: to their top, or to a section of
  // them (a <details> section opens). It waits until they have rendered.
  const [scrollRequest, setScrollRequest] = useState(null);
  const scrollTo = (target = null) => setScrollRequest({ target });

  const startLive = useCallback(
    (check, { cacheOnly = false } = {}) => {
      const badr = check.badr.withdrawn
        ? { withdrawn: true }
        : { rate: check.badr.rate, lifetime_limit: check.badr.lifetime_limit };
      pending.current = { check, scroll: !cacheOnly };
      run({ dataset: datasetKey, rates: check.rates, badr, elasticity: check.elasticity }, { cacheOnly });
    },
    [datasetKey, run],
  );

  const calculate = (check) => {
    if (!check.rates || inFlight) return;
    if (isPrecomputed(check, precomputed)) {
      reset();
      dispatch({ type: "calculate", shown: "precomputed" });
      replaceSchedule(null);
      scrollTo();
      return;
    }
    dispatch({ type: "calculate", shown: "live" });
    startLive(check);
  };

  const hasResults = shown === "precomputed" || (shown === "live" && Boolean(result));
  useEffect(() => {
    if (!scrollRequest || !hasResults) return;
    const element = scrollRequest.target ? document.getElementById(scrollRequest.target) : results.current;
    if (element?.tagName === "DETAILS") element.open = true;
    element?.scrollIntoView({ behavior: "smooth", block: "start" });
    setScrollRequest(null);
  }, [scrollRequest, hasResults]);

  // A live run's schedule reaches the URL only once it succeeds.
  useEffect(() => {
    if (status !== "done" || !pending.current) return;
    const { check, scroll } = pending.current;
    pending.current = null;
    replaceSchedule(check);
    if (scroll) scrollTo();
  }, [status, replaceSchedule]);

  // A link to equalisation's results (or a section of them) shows them as
  // Calculate on its own values would.
  const showEqualisation = useCallback(
    (target) => {
      reset();
      dispatch({ type: "showEqualisation", precomputed });
      replaceSchedule(null);
      scrollTo(target);
    },
    [precomputed, reset, replaceSchedule],
  );

  // On mount: a shared link shows its schedule's result if one is stored (or
  // already computing), but never starts a computation: a crawler or a
  // scripted link could otherwise spend the daily budget without a click.
  // A link to the old Rate explorer tab has its `tab` retired either way.
  useEffect(() => {
    if (mounted.current) return;
    mounted.current = true;
    if (anchor) showEqualisation(anchor === "equalisation" ? null : anchor);
    else if (shown === "live") startLive(checkForm(forms[policy]), { cacheOnly: true });
    else if (searchParams.get("tab") === "explorer") replaceSchedule(null);
  }, [anchor, showEqualisation, shown, startLive, forms, policy, searchParams, replaceSchedule]);

  const select = (id, toggle = false) => {
    reset();
    pending.current = null;
    dispatch({ type: "select", policy: id, toggle });
    if (shown) replaceSchedule(null);
  };
  const setForm = (id) => (form) => dispatch({ type: "edit", policy: id, form });
  const equaliseDefault = formOf(precomputed.rates, precomputed.badr, precomputed.elasticity);
  // "20% · 40% · 45%" and "Relief withdrawn": the precomputed schedule in brief.
  const equaliseRates = BANDS.map((band) => formatPct(precomputed.rates[band.key] * 100, 0)).join(" · ");
  const equaliseRelief = precomputed.badr.withdrawn ? "Relief withdrawn" : `Relief ${describeBadr(precomputed.badr)}`;
  const equaliseEdited = !isPrecomputed(checkForm(forms.equalise), precomputed);
  const stale = isStale(state);
  // The live states speak for themselves; otherwise an open panel with no
  // results says what to do.
  const prompt = policy && !hasResults && !["checking", "running", "not_cached", "error"].includes(status);

  return (
    <div className="space-y-6">
      <section className="section-card" aria-label="Choose a reform">
        <div>
          <SectionHeading
            title="Choose a reform"
            description={
              <>
                <strong className="font-semibold text-slate-800">Pick one to start.</strong> Both
                cover {firstYear} to 2030-31 on {dataset.shortLabel}, with the same behavioural
                response.
              </>
            }
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2" role="group" aria-label="Reform">
          <PolicyTile
            id="equalise"
            sentence="Set each CGT rate to the matching income tax rate."
            pills={[equaliseRates, equaliseRelief]}
            speed={{ instant: true, label: "Instant" }}
            selected={policy === "equalise"}
            onSelect={() => select("equalise", true)}
          />
          <PolicyTile
            id="custom"
            sentence="Choose your own CGT rates, relief and behavioural response."
            pills={[]}
            speed={{ instant: false, label: "Live run, ~30s" }}
            selected={policy === "custom"}
            onSelect={() => select("custom", true)}
          />
        </div>
      </section>

      {policy ? (
        <section id="policy-panel" className="section-card" aria-labelledby={`policy-tile-${policy}`}>
          <h2 className="mb-3 text-xl font-semibold tracking-tight text-slate-900">
            {POLICY_TITLES[policy]}
          </h2>
          {policy === "equalise" ? (
            <>
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
                running={inFlight}
                note={
                  equaliseEdited ? (
                    <>
                      These values differ from equalisation&apos;s, so Calculate runs them live, as
                      Custom rates does.{" "}
                      <button
                        type="button"
                        onClick={() => setForm("equalise")(equaliseDefault)}
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
            </>
          ) : (
            <>
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
                running={inFlight}
              />
            </>
          )}
          {shown === "live" ? (
            <StatusLine
              status={status}
              elapsedSeconds={elapsedSeconds}
              error={error}
              result={result}
              datasetLabel={dataset.shortLabel}
            />
          ) : null}
          {prompt ? (
            <p className="mt-4 text-sm leading-6 text-slate-600">Press Calculate to see the results.</p>
          ) : null}
        </section>
      ) : null}

      {hasResults ? (
        <div ref={results} className="scroll-mt-24 space-y-6">
          {stale ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm leading-6 text-amber-900" role="status">
              These results are for the previous values; press Calculate to update.
            </p>
          ) : null}
          <div className={`space-y-6 transition-opacity ${stale ? "opacity-60" : ""}`}>
            {shown === "precomputed" ? (
              <EqualisationResults
                data={data}
                onNavigate={onNavigate}
                onChooseCustom={() => {
                  select("custom");
                  window.requestAnimationFrame(() =>
                    document.getElementById("policy-panel")?.scrollIntoView({ behavior: "smooth" }),
                  );
                }}
              />
            ) : (
              <LiveResults
                data={data}
                result={result}
                onNavigate={onNavigate}
                onShowEqualisation={() => showEqualisation()}
              />
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
