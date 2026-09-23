"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import BaselineTab from "../src/components/BaselineTab";
import ComparisonTab from "../src/components/ComparisonTab";
import MethodologyTab from "../src/components/MethodologyTab";
import PolicyEngineHeader from "../src/components/PolicyEngineHeader";
import ReformTab from "../src/components/ReformTab";
import { getDatasetInfo, getDatasetOptions } from "../src/lib/dataHelpers";
import comparison from "../public/data/dataset_comparison.json";
import resultsIncumbent from "../public/data/cgt_equalisation_results_enhanced_frs_2024_25.json";
import resultsCandidate from "../public/data/cgt_equalisation_results_microcosm_uk_2024_25_979.json";

// Bundled at build time: a runtime fetch() 404s when the app is served
// behind proxies/rewrites that don't forward public assets. One results
// file per registered dataset, plus the side-by-side comparison. The file
// names follow the pipeline's dataset keys (simulations.DATASETS), so a
// re-registered candidate needs its import path updated here too.
const RESULTS = Object.fromEntries(
  [resultsIncumbent, resultsCandidate].map((results) => [results.metadata.dataset_key, results]),
);
const DEFAULT_DATASET = resultsCandidate.metadata.default_dataset_key;
const DATASET_OPTIONS = getDatasetOptions(resultsCandidate).filter((o) => o.value in RESULTS);

const TAB_OPTIONS = [
  { id: "reform", label: "Reform impacts" },
  { id: "baseline", label: "Baseline" },
  { id: "datasets", label: "Dataset comparison" },
  { id: "methodology", label: "Methodology" },
];

function getInitialTab(tabParam) {
  if (TAB_OPTIONS.some((tab) => tab.id === tabParam)) {
    return tabParam;
  }
  return "reform";
}

function getInitialDataset(datasetParam) {
  if (datasetParam && datasetParam in RESULTS) {
    return datasetParam;
  }
  return DEFAULT_DATASET;
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

function DatasetSwitch({ options, value, onChange, info }) {
  return (
    <div className="mb-6 flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm">
      <span className="font-semibold text-slate-700">Dataset</span>
      <div className="inline-flex overflow-hidden rounded-md border border-slate-300">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={
              option.value === value
                ? "bg-[color:var(--pe-color-primary-600)] px-3 py-1.5 font-semibold text-white"
                : "bg-white px-3 py-1.5 text-slate-600 hover:bg-slate-50"
            }
          >
            {option.label}
            <span className="ml-1 text-xs font-normal opacity-80">({option.role})</span>
          </button>
        ))}
      </div>
      <span className="text-slate-500">
        {info.label}. The Reform impacts, Baseline and Methodology tabs read from this dataset;
        Dataset comparison shows both side by side.
      </span>
    </div>
  );
}

function Dashboard() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState(() => getInitialTab(searchParams.get("tab")));
  const [datasetKey, setDatasetKey] = useState(() =>
    getInitialDataset(searchParams.get("dataset")),
  );
  const data = RESULTS[datasetKey];
  const dataset = getDatasetInfo(data);

  useEffect(() => {
    setActiveTab(getInitialTab(searchParams.get("tab")));
    setDatasetKey(getInitialDataset(searchParams.get("dataset")));
  }, [searchParams]);

  function replaceUrl(tab, key) {
    const params = new URLSearchParams();
    if (tab !== "reform") params.set("tab", tab);
    if (key !== DEFAULT_DATASET) params.set("dataset", key);
    const query = params.toString();
    router.replace(query ? `/?${query}` : "/", { scroll: false });
  }

  function handleTabChange(tab) {
    setActiveTab(tab);
    replaceUrl(tab, datasetKey);
  }

  function handleDatasetChange(key) {
    setDatasetKey(key);
    replaceUrl(activeTab, key);
  }

  return (
    <div className="app-shell min-h-screen">
      <PolicyEngineHeader />
      <header className="title-row">
        <div className="mx-auto flex max-w-[96rem] items-center justify-between px-6 py-4 md:px-8">
          <h1>Capital gains tax analysis dashboard</h1>
        </div>
      </header>

      <main className="relative z-[1] mx-auto max-w-[96rem] px-6 py-10 md:px-8 md:py-12">
        <div className="animate-[fadeIn_0.4s_ease-out]">
          <p className="mb-3 text-[1.05rem] leading-relaxed text-slate-600">
            This dashboard uses{" "}
            <a href="https://policyengine.org" target="_blank" rel="noreferrer" className="underline">
              PolicyEngine
            </a>{" "}
            UK&apos;s microsimulation model to estimate equalising capital
            gains tax rates with income tax rates from 2026-27 (18%→20%,
            24%→40%, 24%→45%), with behavioural elasticities from{" "}
            <a
              href="https://centax.org.uk/wp-content/uploads/2024/10/AdvaniLonsdaleSummers2024_CGTReform.pdf"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold underline decoration-1 underline-offset-2 hover:opacity-80"
            >
              Advani, Lonsdale &amp; Summers (CenTax, 2024)
            </a>
            . It runs on two datasets: the incumbent Enhanced Family Resources
            Survey and the candidate Microcosm UK build, which records what kind
            of asset each gain came from. As{" "}
            <a
              href="https://www.bloomberg.com/news/articles/2026-05-21/streeting-backs-hiking-uk-capital-gains-levy-to-match-income-tax"
              target="_blank"
              rel="noopener noreferrer"
              className="underline decoration-1 underline-offset-2 hover:opacity-80"
            >
              Bloomberg
            </a>{" "}
            reports, leading Labour leadership contenders have backed this
            reform, so the next government may well consider it.{" "}
            <TabLink onSelect={() => handleTabChange("reform")}>Reform impacts</TabLink>{" "}
            shows revenue and distributional effects,{" "}
            <TabLink onSelect={() => handleTabChange("baseline")}>
              Baseline
            </TabLink>{" "}
            validates the baseline against HMRC,{" "}
            <TabLink onSelect={() => handleTabChange("datasets")}>Dataset comparison</TabLink>{" "}
            puts the two datasets side by side, and{" "}
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

        {activeTab !== "datasets" && (
          <DatasetSwitch
            options={DATASET_OPTIONS}
            value={datasetKey}
            onChange={handleDatasetChange}
            info={dataset}
          />
        )}

        {activeTab === "reform" && <ReformTab data={data} />}
        {activeTab === "baseline" && <BaselineTab data={data} />}
        {activeTab === "datasets" && <ComparisonTab comparison={comparison} />}
        {activeTab === "methodology" && <MethodologyTab data={data} />}

        <footer className="mt-12 border-t border-slate-200 pt-8 text-center text-sm text-slate-500">
          <p>
            Replication code:{" "}
            <a
              href="https://github.com/PolicyEngine/uk-equalising-cgt"
              target="_blank"
              rel="noreferrer"
            >
              PolicyEngine/uk-equalising-cgt
            </a>
            {data?.metadata?.policyengine_version
              ? `, run on policyengine.py ${data.metadata.policyengine_version} with policyengine-uk ${data.metadata.policyengine_uk_version}`
              : ""}
            .
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
