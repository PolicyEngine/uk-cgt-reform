"use client";

import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@policyengine/ui-kit/primitives";
import BaselineTab from "./BaselineTab";
import BenchmarksTab from "./BenchmarksTab";

export default function EvidenceTab({ data, view, onChange, onNavigate }) {
  return (
    <div className="evidence-tab">
      <p className="eyebrow">Checking the estimates</p>
      <h2>How the model compares with the evidence</h2>
      <p className="section-intro">
        Two checks: whether the starting data match HMRC, and how the reform
        estimates compare with other research.
      </p>
      <Tabs value={view} onValueChange={onChange}>
        <TabsList variant="line" aria-label="Evidence views">
          <TabsTrigger value="baseline">Baseline vs HMRC</TabsTrigger>
          <TabsTrigger value="benchmarks">Other estimates</TabsTrigger>
        </TabsList>
        <TabsContent value="baseline">
          <div className="insight-note my-5">
            Compare years as well as totals: the model projects 2026–27, while
            the HMRC observations are for earlier years. This is a validation
            check, not a reform estimate.
          </div>
          <BaselineTab data={data} />
        </TabsContent>
        <TabsContent value="benchmarks">
          <div className="insight-note my-5">
            Rates-only and wider-package estimates answer different questions.
            Each comparison below identifies the policy, year and revenue basis
            before showing the figures.
          </div>
          <BenchmarksTab data={data} onNavigate={onNavigate} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
