"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { describeBadr, getFirstYear } from "../lib/dataHelpers";
import { formatPct } from "../lib/formatters";
import { useExploration } from "../lib/exploreApi";
import { initialState, isStale, reformReducer } from "../lib/reformState";
import {
  BANDS,
  checkForm,
  elasticityOption,
  isPrecomputed,
  precomputedSchedule,
  scheduleParams,
} from "../lib/schedule";
import EqualisationResults, { EqualisationSpec } from "./EqualisationResults";
import LiveResults, { ScheduleSpec, StatusLine } from "./LiveResults";
import ScheduleForm from "./ScheduleForm";
import SectionHeading from "./SectionHeading";
import { Card, Pill, TEXT_BUTTON, TabLink, cardClass } from "./controls";

const CENTAX_URL =
  "https://centax.org.uk/wp-content/uploads/2024/10/AdvaniLonsdaleSummers2024_CGTReform.pdf#page=38";
const BADR_GUIDANCE = "https://www.gov.uk/business-asset-disposal-relief";
const POLICY_TITLES = { equalise: "Equalise with income tax", custom: "Custom rates" };

// One policy in the chooser: an inset card that selects it (or, selected,
// closes its panel), with a radio-style mark and a call to action so it
// reads as a choice. The selected policy's parameters open in a box below.
function PolicyTile({ id, sentence, pills, selected, onSelect }) {
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
      {pills.length ? (
        <span className="mt-3 flex flex-wrap gap-2">
          {pills.map((pill) => (
            <Pill key={pill}>{pill}</Pill>
          ))}
        </span>
      ) : null}
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
function PolicyTab({ id, sentence, selected, onSelect }) {
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
      </span>
      <span className="mt-0.5 hidden text-sm leading-6 text-slate-500 sm:block">{sentence}</span>
    </button>
  );
}

// A form in one line: "20% · 40% · 45% · Relief withdrawn · CenTax central".
function summarise(form) {
  const check = checkForm(form);
  if (!check.rates) return "";
  const rates = BANDS.map((band) => formatPct(check.rates[band.key] * 100, 0)).join(" · ");
  const relief = check.badr.withdrawn ? "Relief withdrawn" : `Relief ${describeBadr(check.badr)}`;
  const response = elasticityOption(check.elasticity)?.label.replace(/\s*\(.*\)$/, "") ?? "";
  return [rates, relief, response].filter(Boolean).join(" · ");
}

// The Reform tab: choose equalisation with income tax or custom rates, set
// the parameters, and calculate. Nothing shows until Calculate, except for a
// link that carries a schedule or asks for equalisation's results.
// Equalisation at its own values shows the precomputed results at once; any
// other schedule runs live through /api/explore.
export default function ReformTab({ data, datasetKey, onNavigate, anchor }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const firstYear = getFirstYear(data);
  const precomputed = useMemo(() => precomputedSchedule(data), [data]);
  // Read once: a shared link arrives with a full schedule in the URL.
  const [state, dispatch] = useReducer(reformReducer, null, () => initialState(searchParams, precomputed));
  const { policy, forms, shown } = state;
  const { run, reset, status, result, error } = useExploration();
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

  // After Calculate the panel folds to a one-line summary; Edit, or choosing
  // a reform, opens it again.
  // A page that opens on results (a shared link) starts folded too, and the
  // panel folds again whenever a live run finishes.
  const [collapsed, setCollapsed] = useState(() => Boolean(state.shown));
  useEffect(() => {
    if (status === "done") setCollapsed(true);
  }, [status]);

  const calculate = (check) => {
    if (!check.rates || inFlight) return;
    setCollapsed(true);
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

  // The tab stays mounted while others are shown, so a link from another tab
  // to a Reform section (a new `anchor`) shows the results and scrolls there
  // after mount too.
  const lastAnchor = useRef(anchor);
  useEffect(() => {
    if (anchor && anchor !== lastAnchor.current) showEqualisation(anchor === "equalisation" ? null : anchor);
    lastAnchor.current = anchor;
  }, [anchor, showEqualisation]);

  const select = (id, toggle = false) => {
    setCollapsed(false);
    reset();
    pending.current = null;
    dispatch({ type: "select", policy: id, toggle });
    if (shown) replaceSchedule(null);
  };
  const setForm = (id) => (form) => dispatch({ type: "edit", policy: id, form });
  // "20% · 40% · 45%" and "Relief withdrawn": the precomputed schedule in brief.
  const equaliseRates = BANDS.map((band) => formatPct(precomputed.rates[band.key] * 100, 0)).join(" · ");
  const equaliseRelief = precomputed.badr.withdrawn ? "Relief withdrawn" : `Relief ${describeBadr(precomputed.badr)}`;
  const stale = isStale(state);
  const POLICIES = [
    {
      id: "equalise",
      sentence: "Set each CGT rate to the matching income tax rate.",
      pills: [equaliseRates, equaliseRelief],
    },
    {
      id: "custom",
      sentence: "Choose your own CGT rates, relief and behavioural response.",
      pills: [],
    },
  ];

  // The reform's short explanation, opened from the last sub-tab.
  const about =
    policy === "equalise"
      ? {
          label: "About this reform",
          content: (
            <ul className="list-disc space-y-1.5 pl-5 text-sm leading-6 text-slate-600">
              <li>Each CGT rate rises to the matching income tax rate.</li>
              <li>
                Business Asset Disposal{" "}
                <a href={BADR_GUIDANCE} target="_blank" rel="noopener noreferrer" className="underline decoration-1 underline-offset-2 hover:opacity-80">
                  Relief
                </a>{" "}
                stays at current law; Custom rates can withdraw it.
              </li>
              <li>
                Taxpayers realise fewer gains, using CenTax&apos;s central{" "}
                <a href={CENTAX_URL} target="_blank" rel="noopener noreferrer" className="underline decoration-1 underline-offset-2 hover:opacity-80">
                  elasticity
                </a>
                .{" "}
                <TabLink onNavigate={onNavigate} tab="methodology" section="elasticity">
                  Methodology
                </TabLink>{" "}
                explains that elasticity; the{" "}
                <TabLink onNavigate={() => showEqualisation("response")}>revenue</TabLink>{" "}
                chart in the results shows other values.
              </li>
              <li>
                Not modelled: an exit charge or people moving in or out of the UK; see{" "}
                <TabLink onNavigate={onNavigate} tab="methodology" section="not-modelled">
                  Methodology
                </TabLink>
                .
              </li>
            </ul>
          ),
        }
      : {
          label: "About this option",
          content: (
            <ul className="list-disc space-y-1.5 pl-5 text-sm leading-6 text-slate-600">
              <li>The chosen rates apply to the main schedule and to residential property gains.</li>
              <li>
                Business Asset Disposal{" "}
                <a href={BADR_GUIDANCE} target="_blank" rel="noopener noreferrer" className="underline decoration-1 underline-offset-2 hover:opacity-80">
                  Relief
                </a>{" "}
                can be kept, at a chosen rate and lifetime limit, or withdrawn.
              </li>
              <li>
                Not modelled: an exit charge or people moving in or out of the UK; see{" "}
                <TabLink onNavigate={onNavigate} tab="methodology" section="not-modelled">
                  Methodology
                </TabLink>
                .
              </li>
            </ul>
          ),
        };

  return (
    <div className="space-y-6">
      <Card aria-label="Choose a reform">
        <SectionHeading
          title="Choose a reform"
          description={
            policy ? null : (
              <>
                <strong className="font-semibold text-slate-800">Pick one to start.</strong>
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
              {collapsed ? (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm leading-6 text-slate-700">{summarise(forms[policy])}</p>
                  <button
                    type="button"
                    onClick={() => setCollapsed(false)}
                    className="rounded-lg border border-slate-300 bg-white px-5 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-400 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--pe-color-primary-500)]"
                  >
                    Edit
                  </button>
                </div>
              ) : (
                <ScheduleForm
                  key={policy}
                  form={forms[policy]}
                  onChange={setForm(policy)}
                  onCalculate={calculate}
                  running={inFlight}
                  onNavigate={onNavigate}
                  about={about}
                />
              )}
              {/* The specification of the results shown, folded, under the
                  one-line summary. */}
              {collapsed && hasResults ? (
                <div className="mt-5 border-t border-slate-200 pt-4">
                  {shown === "precomputed" ? <EqualisationSpec data={data} /> : <ScheduleSpec result={result} />}
                </div>
              ) : null}
            </div>
            {shown === "live" ? (
              <StatusLine status={status} error={error} />
            ) : null}
          </>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2" role="group" aria-label="Reform">
            {POLICIES.map((option) => (
              <PolicyTile
                key={option.id}
                id={option.id}
                sentence={option.sentence}
                pills={option.pills}
                selected={false}
                onSelect={() => select(option.id)}
              />
            ))}
          </div>
        )}
      </Card>

      {hasResults ? (
        <div ref={results} className="scroll-mt-24 space-y-6">
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
