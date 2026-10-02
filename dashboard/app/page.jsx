"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@policyengine/ui-kit/primitives";
import PolicyEngineHeader from "../src/components/PolicyEngineHeader";
import OverviewTab from "../src/components/OverviewTab";
import CgtGuideTab from "../src/components/CgtGuideTab";
import DistributionTab from "../src/components/DistributionTab";
import RateExplorerTab from "../src/components/RateExplorerTab";
import EvidenceTab from "../src/components/EvidenceTab";
import MethodologyTab from "../src/components/MethodologyTab";
import Assumptions from "../src/components/Assumptions";
import {
  applyApproach,
  getDefaultApproach,
  getDatasetInfo,
} from "../src/lib/dataHelpers";
import results from "../public/data/cgt_equalisation_results.json";

const TAB_OPTIONS = [
  { id: "reform", label: "Overview" },
  { id: "cgt", label: "How CGT works" },
  { id: "distribution", label: "Distribution" },
  { id: "explorer", label: "Rate explorer" },
  { id: "evidence", label: "Evidence" },
  { id: "methodology", label: "Methodology" },
];
const DEFAULT_APPROACH = getDefaultApproach(results);
const OLD_EVIDENCE_TABS = ["baseline", "benchmarks"];

function tabFrom(value) {
  if (OLD_EVIDENCE_TABS.includes(value)) return "evidence";
  return TAB_OPTIONS.some((tab) => tab.id === value) ? value : "reform";
}

function Dashboard() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState(() =>
    tabFrom(searchParams.get("tab")),
  );
  const [approachId, setApproachId] = useState(
    searchParams.get("approach") ?? DEFAULT_APPROACH,
  );
  const [anchor, setAnchor] = useState(null);
  const [evidenceView, setEvidenceView] = useState(
    searchParams.get("tab") === "benchmarks"
      ? "benchmarks"
      : searchParams.get("evidence") === "benchmarks"
        ? "benchmarks"
        : "baseline",
  );
  const data = applyApproach(results, approachId);
  const dataset = getDatasetInfo(results);
  useEffect(() => {
    setActiveTab(tabFrom(searchParams.get("tab")));
    setApproachId(searchParams.get("approach") ?? DEFAULT_APPROACH);
    setEvidenceView(
      searchParams.get("tab") === "benchmarks"
        ? "benchmarks"
        : searchParams.get("evidence") === "benchmarks"
          ? "benchmarks"
          : "baseline",
    );
  }, [searchParams]);

  function updateUrl(
    tab,
    approach = approachId,
    section,
    evidence = evidenceView,
  ) {
    const params = new URLSearchParams(searchParams.toString());
    if (tab === "reform") params.delete("tab");
    else params.set("tab", tab);
    if (approach === DEFAULT_APPROACH) params.delete("approach");
    else params.set("approach", approach);
    if (tab === "evidence") params.set("evidence", evidence);
    else params.delete("evidence");
    params.delete("dataset");
    const query = params.toString();
    router.replace(
      `/${query ? `?${query}` : ""}${section ? `#${section}` : ""}`,
      { scroll: false },
    );
  }

  function navigate(tab, section) {
    const nextTab = tabFrom(tab);
    if (OLD_EVIDENCE_TABS.includes(tab)) setEvidenceView(tab);
    setActiveTab(nextTab);
    setAnchor(section ?? null);
    updateUrl(
      nextTab,
      approachId,
      section,
      OLD_EVIDENCE_TABS.includes(tab) ? tab : evidenceView,
    );
    if (!section)
      document
        .getElementById("dashboard-sections")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="app-shell min-h-screen">
      <a href="#dashboard-sections" className="skip-link">
        Skip to analysis
      </a>
      <PolicyEngineHeader />
      <main className="dashboard-container">
        <header className="dashboard-intro">
          <p className="eyebrow">PolicyEngine analysis · United Kingdom</p>
          <h1>Capital gains tax reform</h1>
          <p>
            What would equalising CGT and income tax rates mean for revenue and
            households?
          </p>
        </header>
        <Tabs
          value={activeTab}
          onValueChange={(tab) => navigate(tab)}
          activationMode="manual"
        >
          <div id="dashboard-sections" className="dashboard-tabs">
            <TabsList variant="line" aria-label="Dashboard sections">
              {TAB_OPTIONS.map((tab) => (
                <TabsTrigger key={tab.id} value={tab.id}>
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
          {activeTab !== "cgt" && (
            <Assumptions
              data={data}
              onChange={(id) => {
                setApproachId(id);
                updateUrl(activeTab, id);
              }}
              onExplain={() => navigate("methodology", "income-shifting")}
            />
          )}
          <TabsContent value="reform">
            <OverviewTab data={data} onNavigate={navigate} />
          </TabsContent>
          <TabsContent value="cgt">
            <CgtGuideTab onNavigate={navigate} />
          </TabsContent>
          <TabsContent value="distribution">
            <DistributionTab data={data} onNavigate={navigate} />
          </TabsContent>
          <TabsContent value="explorer">
            <RateExplorerTab data={data} datasetKey={dataset.key} />
          </TabsContent>
          <TabsContent value="evidence">
            <EvidenceTab
              data={data}
              view={evidenceView}
              onChange={(view) => {
                setEvidenceView(view);
                updateUrl("evidence", approachId, null, view);
              }}
              onNavigate={navigate}
            />
          </TabsContent>
          <TabsContent value="methodology">
            <MethodologyTab data={data} anchor={anchor} />
          </TabsContent>
        </Tabs>
        <footer className="analysis-footer">
          <span>
            PolicyEngine UK {results.metadata.policyengine_uk_version} ·{" "}
            {dataset.shortLabel} · Staged data
          </span>
          <a href="https://github.com/PolicyEngine/uk-cgt-reform">
            Code and replication ↗
          </a>
          <button onClick={() => navigate("methodology", "pathway")}>
            Data and assumptions
          </button>
        </footer>
      </main>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<p className="p-12 text-center">Loading analysis…</p>}>
      <Dashboard />
    </Suspense>
  );
}
