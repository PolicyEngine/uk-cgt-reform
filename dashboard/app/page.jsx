"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import BaselineTab from "../src/components/BaselineTab";
import MethodologyTab from "../src/components/MethodologyTab";
import ReformTab from "../src/components/ReformTab";
import { getDatasetInfo } from "../src/lib/dataHelpers";
import results from "../public/data/cgt_equalisation_results.json";

// Bundled at build time: a runtime fetch() 404s when the app is served
// behind proxies/rewrites that don't forward public assets. The pipeline
// writes one results file, for the one registered dataset.

const LINK = "underline decoration-1 underline-offset-2 hover:opacity-80";
const BOLD = "font-semibold text-slate-900";
const CENTAX_REPORT =
  "https://centax.org.uk/wp-content/uploads/2024/10/AdvaniLonsdaleSummers2024_CGTReform.pdf";

const TAB_OPTIONS = [
  { id: "reform", label: "Reform" },
  { id: "baseline", label: "Baseline" },
  { id: "methodology", label: "Methodology" },
];

// Links from before the Reform tab merged the Reform impacts and Rate
// explorer tabs open the Reform tab, which reads their schedule; links to the
// old Benchmarks tab open the Baseline tab at its comparisons.
const LEGACY_TABS = { explorer: "reform", benchmarks: "baseline" };
const LEGACY_ANCHORS = { benchmarks: "comparisons" };

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
  const [anchor, setAnchor] = useState(() => LEGACY_ANCHORS[searchParams.get("tab")] ?? null);
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
    <div className="app-shell flex flex-1 flex-col">
      <header className="title-row">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4 md:px-8">
          <h1>Capital gains tax reform analysis</h1>
        </div>
      </header>

      <main className="relative z-[1] mx-auto flex w-full max-w-6xl flex-1 flex-col px-6 pb-6 pt-10 md:px-8 md:pt-12">
        <div className="animate-[fadeIn_0.4s_ease-out]">
          <p className="text-lg leading-8 text-slate-800">
            This dashboard estimates how{" "}
            <strong className={BOLD}>
              taxing capital{" "}
              <a href="https://www.gov.uk/capital-gains-tax" target="_blank" rel="noopener noreferrer" className={LINK}>gains</a>{" "}
              at income tax rates
            </strong>{" "}
            and
            withdrawing Business Asset Disposal{" "}
            <a href="https://www.gov.uk/business-asset-disposal-relief" target="_blank" rel="noopener noreferrer" className={LINK}>Relief</a>, a reform{" "}
            <a href="https://ifs.org.uk/sites/default/files/2024-10/Captial-gains-tax-reform.pdf" target="_blank" rel="noopener noreferrer" className={LINK}>debated</a>{" "}
            in the UK, would affect <strong className={BOLD}>government revenue</strong> and{" "}
            <strong className={BOLD}>household incomes</strong>; a{" "}
            <strong className={BOLD}>custom option</strong> scores any other set of rates. It
            models only these changes to <strong className={BOLD}>rates and the relief</strong>, with fewer gains
            realised as rates rise, and not the other measures{" "}
            <a href={CENTAX_REPORT} target="_blank" rel="noopener noreferrer" className={LINK}>CenTax</a>{" "}
            pair with them (an investment allowance, ending the uplift at death and an exit tax) or
            people moving into or out of the UK (see{" "}
            <button type="button" onClick={() => handleNavigate("methodology", "not-modelled")} className={`inline font-normal text-[color:var(--pe-color-primary-700)] ${LINK}`}>
              Methodology
            </button>
            ).
          </p>
        </div>

        <nav
          aria-label="Dashboard sections"
          className="tab-strip mb-8 mt-8 flex max-w-full flex-wrap gap-x-6 border-b border-slate-200 sm:gap-x-8"
        >
          {TAB_OPTIONS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              aria-current={activeTab === tab.id ? "page" : undefined}
              className={`-mb-px shrink-0 border-b-2 pb-3 pt-1 text-base transition-colors focus:outline-none focus-visible:text-[color:var(--pe-color-primary-700)] sm:text-lg ${
                activeTab === tab.id
                  ? "border-[color:var(--pe-color-primary-600)] font-bold text-slate-900"
                  : "border-transparent font-medium text-slate-500 hover:border-slate-300 hover:text-slate-800"
              }`}
              onClick={() => handleTabChange(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        {/* Kept mounted so a chosen reform and its results survive a visit to
            another tab. */}
        <div hidden={activeTab !== "reform"}>
          <ReformTab data={data} datasetKey={dataset.key} anchor={activeTab === "reform" ? anchor : null} onNavigate={handleNavigate} />
        </div>
        {activeTab === "baseline" && <BaselineTab data={data} anchor={anchor} onNavigate={handleNavigate} />}
        {activeTab === "methodology" && <MethodologyTab data={data} anchor={anchor} onNavigate={handleNavigate} />}

        <div aria-hidden="true" className="h-10 shrink-0" />
        <footer className="mt-auto border-t border-slate-200 pt-5 text-center text-xs leading-5 text-slate-500">
          Replication code:{" "}
          <a
            href="https://github.com/PolicyEngine/uk-cgt-reform"
            target="_blank"
            rel="noreferrer"
            className="font-semibold text-[color:var(--pe-color-primary-700)] underline decoration-1 underline-offset-2 hover:opacity-80"
          >
            PolicyEngine/uk-cgt-reform
          </a>
          {" · "}
          <a href="https://github.com/PolicyEngine/policyengine.py" target="_blank" rel="noreferrer" className={LINK}>
            policyengine.py
          </a>
          {data?.metadata?.policyengine_version ? ` ${data.metadata.policyengine_version}` : ""}
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
