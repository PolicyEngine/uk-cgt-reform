"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import BaselineTab from "../src/components/BaselineTab";
import BenchmarksTab from "../src/components/BenchmarksTab";
import MethodologyTab from "../src/components/MethodologyTab";
import PolicyEngineHeader from "../src/components/PolicyEngineHeader";
import ReformTab from "../src/components/ReformTab";
import { getDatasetInfo } from "../src/lib/dataHelpers";
import results from "../public/data/cgt_equalisation_results.json";

// Bundled at build time: a runtime fetch() 404s when the app is served
// behind proxies/rewrites that don't forward public assets. The pipeline
// writes one results file, for the one registered dataset.

const LINK = "underline decoration-1 underline-offset-2 hover:opacity-80";

const TAB_OPTIONS = [
  { id: "reform", label: "Reform" },
  { id: "baseline", label: "Baseline" },
  { id: "benchmarks", label: "Benchmarks" },
  { id: "methodology", label: "Methodology" },
];

// Links from before the Reform tab merged the Reform impacts and Rate
// explorer tabs open the Reform tab, which reads their schedule.
const LEGACY_TABS = { explorer: "reform" };

function getInitialTab(tabParam) {
  if (LEGACY_TABS[tabParam]) return LEGACY_TABS[tabParam];
  if (TAB_OPTIONS.some((tab) => tab.id === tabParam)) {
    return tabParam;
  }
  return "reform";
}

function Dashboard() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState(() => getInitialTab(searchParams.get("tab")));
  const [anchor, setAnchor] = useState(null);
  const data = results;
  const dataset = getDatasetInfo(data);

  useEffect(() => {
    setActiveTab(getInitialTab(searchParams.get("tab")));
  }, [searchParams]);

  function replaceUrl(tab) {
    // Keep any other parameters (the Reform tab's schedule) in place; a
    // `dataset` parameter from before the dashboard had one dataset is dropped.
    const params = new URLSearchParams(searchParams.toString());
    if (tab !== "reform") params.set("tab", tab);
    else params.delete("tab");
    params.delete("dataset");
    const query = params.toString();
    router.replace(query ? `/?${query}` : "/", { scroll: false });
  }

  function handleTabChange(tab) {
    setActiveTab(tab);
    setAnchor(null);
    replaceUrl(tab);
  }

  // Open a tab at one of its sections (e.g. Methodology's #elasticity-gap);
  // a link with no section opens the tab at its top, not mid-scroll.
  function handleNavigate(tab, sectionId) {
    handleTabChange(tab);
    if (sectionId) setAnchor(sectionId);
    else {
      window.requestAnimationFrame(() => {
        document.querySelector(".tab-strip")?.scrollIntoView();
      });
    }
  }

  return (
    <div className="app-shell min-h-screen">
      <PolicyEngineHeader />
      <header className="title-row">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4 md:px-8">
          <h1>Capital gains tax reform dashboard</h1>
        </div>
      </header>

      <main className="relative z-[1] mx-auto max-w-6xl px-6 py-10 md:px-8 md:py-12">
        <div className="animate-[fadeIn_0.4s_ease-out]">
          <p className="text-lg leading-8 text-slate-800">
            This dashboard estimates how changing UK capital gains tax rates would affect
            government revenue and household incomes. Its headline reform, taxing gains at income
            tax rates and withdrawing Business Asset Disposal Relief, has been{" "}
            <a href="https://ifs.org.uk/sites/default/files/2024-10/Captial-gains-tax-reform.pdf" target="_blank" rel="noopener noreferrer" className={LINK}>debated</a>{" "}
            in the UK; a custom option scores any other set of rates.
          </p>
        </div>

        <nav
          aria-label="Dashboard sections"
          className="tab-strip mb-8 mt-8 inline-flex max-w-full flex-wrap gap-1 rounded-xl border border-slate-300 bg-white p-1 shadow-sm"
        >
          {TAB_OPTIONS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              aria-current={activeTab === tab.id ? "page" : undefined}
              className={`rounded-lg px-3 py-2 text-sm font-semibold transition-colors sm:px-5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--pe-color-primary-500)] sm:text-base ${
                activeTab === tab.id
                  ? "bg-[color:var(--pe-color-primary-600)] text-white"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
              onClick={() => handleTabChange(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        {activeTab === "reform" && <ReformTab data={data} datasetKey={dataset.key} anchor={anchor} onNavigate={handleNavigate} />}
        {activeTab === "baseline" && <BaselineTab data={data} anchor={anchor} onNavigate={handleNavigate} />}
        {activeTab === "benchmarks" && <BenchmarksTab data={data} onNavigate={handleNavigate} />}
        {activeTab === "methodology" && <MethodologyTab data={data} anchor={anchor} onNavigate={handleNavigate} />}

        <footer className="mt-12 border-t border-slate-200 pt-6 text-center text-xs leading-5 text-slate-500">
          Replication code:{" "}
          <a
            href="https://github.com/PolicyEngine/uk-cgt-reform"
            target="_blank"
            rel="noreferrer"
            className="font-semibold text-[color:var(--pe-color-primary-700)] underline decoration-1 underline-offset-2 hover:opacity-80"
          >
            PolicyEngine/uk-cgt-reform
          </a>
          {data?.metadata?.policyengine_version
            ? ` · policyengine.py ${data.metadata.policyengine_version} with policyengine-uk ${data.metadata.policyengine_uk_version}`
            : ""}
          {` · ${dataset.label}`}
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
