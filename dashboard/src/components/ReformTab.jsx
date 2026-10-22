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
import { Card, Pill, TEXT_BUTTON, TabLink, cardClass } from "./controls";

const CENTAX_URL =
  "https://centax.org.uk/wp-content/uploads/2024/10/AdvaniLonsdaleSummers2024_CGTReform.pdf#page=38";
const POLICY_TITLES = { equalise: "Equalise with income tax", custom: "Custom rates" };

// One policy in the chooser: an inset card that selects it (or, selected,
// closes its panel), with a radio-style mark and a call to action so it
// reads as a choice. The selected policy's parameters open in a box below.
function PolicyTile({ id, sentence, pills, speed, selected, onSelect }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      aria-controls={selected ? "policy-panel" : undefined}
      id={`policy-tile-${id}`}
      className={`${cardClass("inset", selected)} group relative flex h-full w-full cursor-pointer flex-col p-5 text-left shadow-sm duration-150 hover:-translate-y-0.5 hover:border-[color:var(--pe-color-primary-500)] hover:shadow-md focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[color:var(--pe-color-primary-600)] sm:p-6`}
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
      <span className="pr-10 text-lg font-semibold text-slate-900">{POLICY_TITLES[id]}</span>
      <span className="mt-1.5 block text-sm leading-6 text-slate-600">{sentence}</span>
      <span className="mt-3 flex flex-wrap gap-2">
        {pills.map((pill) => (
          <Pill key={pill}>{pill}</Pill>
        ))}
        <Pill tone={speed.instant ? "teal" : "amber"}>{speed.label}</Pill>
      </span>
      <span className="mt-auto pt-5 text-sm">
        {selected ? (
          <span className="font-semibold text-[color:var(--pe-color-primary-700)]">✓ Selected</span>
        ) : (
          <span className={TEXT_BUTTON}>Choose this reform →</span>
        )}
      </span>
    </button>
  );
}

// Once a policy is chosen the two tiles become tabs side by side, joined
// to the open panel: the other tab replaces the panel with its policy.
function PolicyTab({ id, sentence, speed, selected, onSelect }) {
  return (
    <button
      type="button"
      role="tab"
      id={`policy-tile-${id}`}
      aria-selected={selected}
      aria-controls="policy-panel"
      tabIndex={selected ? 0 : -1}
      onClick={onSelect}
      className={`relative flex min-w-0 flex-col rounded-t-xl border px-4 py-3 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[color:var(--pe-color-primary-500)] sm:px-5 ${
        selected
          ? "z-[1] -mb-px border-slate-200 border-b-white bg-white shadow-[inset_0_3px_0_var(--pe-color-primary-600)]"
          : "border-transparent bg-slate-100 text-slate-600 hover:bg-slate-200/70"
      }`}
    >
      <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className={`text-base font-semibold ${selected ? "text-slate-900" : "text-slate-700"}`}>
          {POLICY_TITLES[id]}
        </span>
        <Pill tone={speed.instant ? "teal" : "amber"}>{speed.label}</Pill>
      </span>
      <span className="mt-0.5 hidden text-sm leading-6 text-slate-500 sm:block">{sentence}</span>
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
  const POLICIES = [
    {
      id: "equalise",
      sentence: "Set each CGT rate to the matching income tax rate.",
      pills: [equaliseRates, equaliseRelief],
      speed: { instant: true, label: "Instant" },
    },
    {
      id: "custom",
      sentence: "Choose your own CGT rates, relief and behavioural response.",
      pills: [],
      speed: { instant: false, label: "Live run, ~30s" },
    },
  ];
  // What Calculate will do, for the panel's footer.
  let footerStatus = { tone: "live", text: "About 30 seconds" };
  if (policy === "equalise") {
    footerStatus = equaliseEdited
      ? { tone: "live", text: "Edited: about 30 seconds" }
      : { tone: "instant", text: "Instant" };
  }

  return (
    <div className="space-y-6">
      <Card aria-label="Choose a reform">
        <SectionHeading
          title="Choose a reform"
          description={
            policy ? null : (
              <>
                <strong className="font-semibold text-slate-800">Pick one to start.</strong> Both
                cover {firstYear} to 2030-31 on {dataset.shortLabel}, with the same behavioural
                response.
              </>
            )
          }
        />
        {policy ? (
          <>
            <div className="grid grid-cols-2 gap-2" role="tablist" aria-label="Reform">
              {POLICIES.map((option) => (
                <PolicyTab
                  key={option.id}
                  id={option.id}
                  sentence={option.sentence}
                  speed={option.speed}
                  selected={policy === option.id}
                  onSelect={() => policy !== option.id && select(option.id)}
                />
              ))}
            </div>
            <div
              id="policy-panel"
              role="tabpanel"
              aria-labelledby={`policy-tile-${policy}`}
              className="rounded-b-xl border border-slate-200 p-5 sm:p-6"
            >
              <ScheduleForm
                key={policy}
                form={forms[policy]}
                onChange={setForm(policy)}
                showPresets={policy === "custom"}
                onCalculate={calculate}
                running={inFlight}
                status={footerStatus}
                onRestore={policy === "equalise" && equaliseEdited ? () => setForm("equalise")(equaliseDefault) : null}
                onNavigate={onNavigate}
              />
            </div>
            {shown === "live" ? (
              <StatusLine
                status={status}
                elapsedSeconds={elapsedSeconds}
                error={error}
                result={result}
                datasetLabel={dataset.shortLabel}
              />
            ) : null}
            <details className="group mt-4 rounded-xl border border-slate-200 px-4 py-3">
              <summary className="cursor-pointer select-none text-sm font-semibold text-slate-700 marker:text-[color:var(--pe-color-primary-600)]">
                About this {policy === "equalise" ? "reform" : "option"}
              </summary>
              {policy === "equalise" ? (
                <p className="mt-3 text-sm leading-6 text-slate-600">
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
              ) : (
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  The chosen rates apply to the main schedule and to residential property gains.
                  Business Asset Disposal Relief can be kept, at a rate and lifetime limit you choose,
                  or withdrawn. A schedule runs through the same pipeline as the precomputed
                  equalisation results, and every completed run is cached, so a schedule anyone has
                  run before is served at once.
                </p>
              )}
            </details>
          </>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2" role="group" aria-label="Reform">
            {POLICIES.map((option) => (
              <PolicyTile
                key={option.id}
                id={option.id}
                sentence={option.sentence}
                pills={option.pills}
                speed={option.speed}
                selected={false}
                onSelect={() => select(option.id)}
              />
            ))}
          </div>
        )}
      </Card>

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
