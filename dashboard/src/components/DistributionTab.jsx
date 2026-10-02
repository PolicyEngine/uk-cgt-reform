"use client";

import GroupImpactChart from "./charts/GroupImpactChart";
import { getFirstYear } from "../lib/dataHelpers";
import { AssumptionSummary } from "./Assumptions";

export default function DistributionTab({ data, onNavigate }) {
  return (
    <div className="max-w-5xl">
      <section className="story-section">
        <p className="eyebrow">Household outcomes</p>
        <h2>How the income change is distributed</h2>
        <p className="section-intro">
          Explore the average change in household net income by income, age and
          region.
        </p>
        <AssumptionSummary
          data={data}
          onExplain={() => onNavigate("methodology", "elasticity")}
        />
        <div className="insight-note mb-7">
          <strong>Read this as an income measure.</strong> It includes gains
          that people stop realising and extra CGT, rather than extra tax alone.
          The income tax and NI addition for shifted income is not included.
          Averages cover every household in each group.
        </div>
        <GroupImpactChart
          groupsByYear={data.income_change_groups}
          initialYear={getFirstYear(data)}
        />
      </section>
    </div>
  );
}
