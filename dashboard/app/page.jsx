"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import BaselineTab from "../src/components/BaselineTab";
import BenchmarksTab from "../src/components/BenchmarksTab";
import MethodologyTab from "../src/components/MethodologyTab";
import PolicyEngineHeader from "../src/components/PolicyEngineHeader";
import RateExplorerTab from "../src/components/RateExplorerTab";
import ReformTab from "../src/components/ReformTab";
import {
  applyApproach,
  getApproachOptions,
  getDatasetInfo,
  getDefaultApproach,
} from "../src/lib/dataHelpers";
import results from "../public/data/cgt_equalisation_results.json";

// Bundled at build time: a runtime fetch() 404s when the app is served
// behind proxies/rewrites that don't forward public assets. The pipeline
// writes one results file, for the one registered dataset.
// The two approaches to income shifting, and the one shown first.
const APPROACH_OPTIONS = getApproachOptions(results);
const DEFAULT_APPROACH = getDefaultApproach(results);
// Tabs whose figures depend on the approach (the Baseline tab's do not).
const APPROACH_TABS = new Set(["reform", "explorer", "benchmarks", "methodology"]);

const TAB_OPTIONS = [
  { id: "reform", label: "Reform impacts" },
  { id: "explorer", label: "Rate explorer" },
  { id: "baseline", label: "Baseline" },
  { id: "benchmarks", label: "Benchmarks" },
  { id: "methodology", label: "Methodology" },
];

function getInitialTab(tabParam) {
  if (TAB_OPTIONS.some((tab) => tab.id === tabParam)) {
    return tabParam;
  }
  return "reform";
}

function getInitialApproach(approachParam) {
  if (APPROACH_OPTIONS.some((approach) => approach.id === approachParam)) {
    return approachParam;
  }
  return DEFAULT_APPROACH;
}

function TabLink({ onSelect, children }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="font-semibold text-[color:var(--pe-color-primary-600)] underline decoration-1 underline-offset-2 transition-opacity hover:opacity-80"
    >
      {children}
    </button>
  );
}

function ApproachSwitch({ options, value, onChange, onExplain }) {
  const current = options.find((option) => option.id === value);
  return (
    <div className="mb-6 flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm">
      <span className="font-semibold text-slate-700">Income shifting</span>
      <div className="inline-flex overflow-hidden rounded-md border border-slate-300">
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => onChange(option.id)}
            className={
              option.id === value
                ? "bg-[color:var(--pe-color-primary-600)] px-3 py-1.5 font-semibold text-white"
                : "bg-white px-3 py-1.5 text-slate-600 hover:bg-slate-50"
            }
          >
            {option.label}
          </button>
        ))}
      </div>
      <span className="text-slate-500">
        {current.description}{" "}
        <button
          type="button"
          onClick={onExplain}
          className="font-semibold text-[color:var(--pe-color-primary-600)] underline decoration-1 underline-offset-2 hover:opacity-80"
        >
          How the two approaches differ
        </button>
      </span>
    </div>
  );
}

function Dashboard() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState(() => getInitialTab(searchParams.get("tab")));
  const [approachId, setApproachId] = useState(() =>
    getInitialApproach(searchParams.get("approach")),
  );
  const [anchor, setAnchor] = useState(null);
  const data = results;
  const dataset = getDatasetInfo(data);
  // The figures as the chosen approach to income shifting shows them.
  const view = applyApproach(data, approachId);

  useEffect(() => {
    setActiveTab(getInitialTab(searchParams.get("tab")));
    setApproachId(getInitialApproach(searchParams.get("approach")));
  }, [searchParams]);

  function replaceUrl(tab, approach = approachId) {
    // Keep any other parameters (the Rate explorer's schedule) in place; a
    // `dataset` parameter from before the dashboard had one dataset is dropped.
    const params = new URLSearchParams(searchParams.toString());
    if (tab !== "reform") params.set("tab", tab);
    else params.delete("tab");
    params.delete("dataset");
    if (approach !== DEFAULT_APPROACH) params.set("approach", approach);
    else params.delete("approach");
    const query = params.toString();
    router.replace(query ? `/?${query}` : "/", { scroll: false });
  }

  function handleTabChange(tab) {
    setActiveTab(tab);
    setAnchor(null);
    replaceUrl(tab);
  }

  function handleApproachChange(approach) {
    setApproachId(approach);
    replaceUrl(activeTab, approach);
  }

  // Open a tab at one of its sections (e.g. Methodology's #elasticity-gap).
  function handleNavigate(tab, sectionId) {
    handleTabChange(tab);
    setAnchor(sectionId);
  }

  return (
    <div className="app-shell min-h-screen">
      <PolicyEngineHeader />
      <header className="title-row">
        <div className="mx-auto flex max-w-[96rem] items-center justify-between px-6 py-4 md:px-8">
          <h1>Capital gains tax reform dashboard</h1>
        </div>
      </header>

      <main className="relative z-[1] mx-auto max-w-[96rem] px-6 py-10 md:px-8 md:py-12">
        <div className="animate-[fadeIn_0.4s_ease-out]">
          <p className="mb-3 text-[1.05rem] leading-relaxed text-slate-600">
            This dashboard uses{" "}
            <a href="https://policyengine.org" target="_blank" rel="noreferrer" className="underline">
              PolicyEngine
            </a>{" "}
            UK&apos;s microsimulation model to estimate reforms to capital gains
            tax rates from 2026-27, with{" "}
            <a
              href={data.benchmarks.elasticities.central.url}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold underline decoration-1 underline-offset-2 hover:opacity-80"
            >
              PolicyEngine&apos;s behavioural elasticity for capital gains
            </a>{" "}
            and, for comparison, those of{" "}
            <a
              href="https://centax.org.uk/wp-content/uploads/2024/10/AdvaniLonsdaleSummers2024_CGTReform.pdf"
              target="_blank"
              rel="noopener noreferrer"
              className="underline decoration-1 underline-offset-2 hover:opacity-80"
            >
              Advani, Lonsdale &amp; Summers (CenTax, 2024)
            </a>{" "}
            and HMRC and the OBR. Its headline reform equalises CGT rates with income tax rates
            (18%→20%, 24%→40%, 24%→45%) and withdraws Business Asset Disposal
            Relief. Wes Streeting proposed equalising the rates in May 2026, as{" "}
            <a
              href="https://www.bloomberg.com/news/articles/2026-05-21/streeting-backs-hiking-uk-capital-gains-levy-to-match-income-tax"
              target="_blank"
              rel="noopener noreferrer"
              className="underline decoration-1 underline-offset-2 hover:opacity-80"
            >
              Bloomberg
            </a>{" "}
            reported; CenTax costs the change within a wider package that also
            reforms the CGT base, which this dashboard does not model. It runs on
            PolicyEngine&apos;s Microcosm UK 2024-25 data, which records what kind of
            asset each gain came from and which gains qualify for Business Asset
            Disposal Relief.{" "}
            <TabLink onSelect={() => handleTabChange("reform")}>Reform impacts</TabLink>{" "}
            shows the equalisation reform&apos;s revenue and distributional effects,{" "}
            <TabLink onSelect={() => handleTabChange("explorer")}>Rate explorer</TabLink>{" "}
            scores a schedule of CGT rates you choose,{" "}
            <TabLink onSelect={() => handleTabChange("baseline")}>
              Baseline
            </TabLink>{" "}
            validates the baseline against HMRC,{" "}
            <TabLink onSelect={() => handleTabChange("benchmarks")}>Benchmarks</TabLink>{" "}
            compares the results with other published estimates, and{" "}
            <TabLink onSelect={() => handleTabChange("methodology")}>Methodology</TabLink>{" "}
            explains the method.
          </p>
        </div>

        <div className="mb-8 mt-8 flex w-fit flex-wrap border-b-2 border-slate-200">
          {TAB_OPTIONS.map((tab) => (
            <button
              key={tab.id}
              className={`tab-button ${activeTab === tab.id ? "active" : ""}`}
              onClick={() => handleTabChange(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {APPROACH_TABS.has(activeTab) && (
          <ApproachSwitch
            options={APPROACH_OPTIONS}
            value={approachId}
            onChange={handleApproachChange}
            onExplain={() => handleNavigate("methodology", "income-shifting")}
          />
        )}

        {activeTab === "reform" && <ReformTab data={view} onNavigate={handleNavigate} />}
        {activeTab === "explorer" && <RateExplorerTab data={view} datasetKey={dataset.key} />}
        {activeTab === "baseline" && <BaselineTab data={data} />}
        {activeTab === "benchmarks" && <BenchmarksTab data={view} onNavigate={handleNavigate} />}
        {activeTab === "methodology" && <MethodologyTab data={view} anchor={anchor} />}

        <footer className="mt-12 border-t border-slate-200 pt-8 text-center text-sm text-slate-500">
          <p>
            Replication code:{" "}
            <a
              href="https://github.com/PolicyEngine/uk-cgt-reform"
              target="_blank"
              rel="noreferrer"
            >
              PolicyEngine/uk-cgt-reform
            </a>
            {data?.metadata?.policyengine_version
              ? `, run on policyengine.py ${data.metadata.policyengine_version} with policyengine-uk ${data.metadata.policyengine_uk_version}`
              : ""}
            , on {dataset.label}.
          </p>
        </footer>
      </main>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense
      fallback={<p className="p-12 text-center text-slate-500">Loading...</p>}
    >
      <Dashboard />
    </Suspense>
  );
}
