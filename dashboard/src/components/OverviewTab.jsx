"use client";

import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  describeBadr,
  getFirstYear,
  getFiveYearTotal,
  getReform,
} from "../lib/dataHelpers";
import { formatSignedBn, formatSignedPct } from "../lib/formatters";
import {
  scenarioLabel,
  scenarioConvention,
  approachLabel,
} from "../lib/presentation";
import { ReadingLayout } from "./ReadingGuide";
import { AssumptionSummary } from "./Assumptions";
import { SourceLink, Toggle } from "./controls";
import BudgetChart from "./charts/BudgetChart";

const SECTIONS = [
  { id: "at-a-glance", label: "At a glance" },
  { id: "behaviour", label: "Why behaviour matters" },
  { id: "each-year", label: "Revenue each year" },
  { id: "who-is-affected", label: "Who is affected" },
];

export function PolicySummary({ data }) {
  const reform = getReform(data);
  return (
    <div
      className="policy-strip"
      aria-label="The reform compared with current policy"
    >
      {Object.entries(reform).map(([band, rates]) => (
        <div key={band}>
          <span>{band.replace("_rate", "")} rate</span>
          <p>
            {Math.round(rates.baseline * 100)}%{" "}
            <span aria-label="changes to">→</span>{" "}
            <strong>{Math.round(rates.reform * 100)}%</strong>
          </p>
        </div>
      ))}
      <div>
        <span>Business Asset Disposal Relief</span>
        <p>
          <strong>{describeBadr(data.metadata.reform_schedules.badr)}</strong>
        </p>
      </div>
    </div>
  );
}

export function SensitivityChart({ data }) {
  const rows = data.sensitivity.map((row) => ({
    ...row,
    label: scenarioLabel(row),
  }));
  return (
    <>
      <div
        className="sensitivity-chart"
        role="img"
        aria-label={`Revenue under ${rows.length} behavioural cases; figures available in the table below`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={rows}
            layout="vertical"
            margin={{ top: 4, right: 28, bottom: 6, left: 0 }}
          >
            <CartesianGrid
              horizontal={false}
              stroke="var(--border)"
              strokeDasharray="3 3"
            />
            <XAxis
              type="number"
              domain={["auto", "auto"]}
              niceTicks="snap125"
              tickFormatter={(v) => formatSignedBn(v, 0)}
              tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              type="category"
              dataKey="label"
              width={150}
              tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
              axisLine={false}
              tickLine={false}
            />
            <ReferenceLine x={0} stroke="var(--muted-foreground)" />
            <Tooltip
              separator=": "
              formatter={(value) => [
                formatSignedBn(value, 1),
                "Revenue change",
              ]}
            />
            <Bar dataKey="revenue_2026_bn" maxBarSize={24} radius={3}>
              {rows.map((row) => (
                <Cell
                  key={row.id}
                  fill={
                    row.id === data.approach.central_id
                      ? "var(--primary)"
                      : row.revenue_2026_bn < 0
                        ? "var(--chart-5)"
                        : "var(--color-teal-200)"
                  }
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <details className="disclosure">
        <summary>View figures, elasticity definitions and sources</summary>
        <div className="table-scroll">
          <table className="data-table">
            <caption>
              Change in revenue in {getFirstYear(data)} ·{" "}
              {approachLabel(data.approach).toLowerCase()}
            </caption>
            <thead>
              <tr>
                <th scope="col">Case</th>
                <th scope="col">Assumption</th>
                <th scope="col">Revenue change</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <th scope="row">
                    {row.label}
                    {row.id === data.approach.central_id ? " · central" : ""}
                  </th>
                  <td>
                    {scenarioConvention(row)}
                    {row.includes_income_shifting_offset
                      ? "; income tax and NI added"
                      : ""}
                  </td>
                  <td>{formatSignedBn(row.revenue_2026_bn, 1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="source-note">
            <SourceLink href={data.benchmarks.elasticities.central.url}>
              PolicyEngine
            </SourceLink>{" "}
            ·{" "}
            <SourceLink href="https://centax.org.uk/wp-content/uploads/2024/10/AdvaniLonsdaleSummers2024_CGTReform.pdf#page=37">
              CenTax
            </SourceLink>{" "}
            ·{" "}
            <SourceLink href={data.benchmarks.elasticities.official.url}>
              HMRC / OBR
            </SourceLink>
          </p>
        </div>
      </details>
    </>
  );
}

export default function OverviewTab({ data, onNavigate }) {
  const firstYear = getFirstYear(data);
  const first = data.budget[0];
  const central = data.sensitivity.find(
    (row) => row.id === data.approach.central_id,
  );
  const staticRow = data.benchmarks.static_equalisation.by_year[0];
  const [splitCase, setSplitCase] = useState("central");
  const groups = data.income_change_groups[firstYear];
  const topGroup = groups.decile?.at(-1) ?? groups.quintile.at(-1);
  const topShare = groups.decile ? "10%" : "20%";
  const offset = central.includes_income_shifting_offset
    ? first.income_shifting_offset_bn
    : 0;
  return (
    <ReadingLayout sections={SECTIONS}>
      <section id="at-a-glance" className="story-section">
        <div className="section-heading-row">
          <div>
            <p className="eyebrow">Revenue at a glance</p>
            <h2>Equalising CGT with income tax</h2>
          </div>
          <span className="context-tag">From {firstYear}</span>
        </div>
        <div className="headline-grid mt-6">
          <div className="headline-card primary">
            <p>Revenue change in {firstYear}</p>
            <strong>{formatSignedBn(first.gov_balance_change_bn, 1)}</strong>
            <span>Compared with current policy</span>
          </div>
          <div className="headline-card">
            <p>Total over five years</p>
            <strong>{formatSignedBn(getFiveYearTotal(data), 1)}</strong>
            <span>
              {firstYear} to {data.budget.at(-1).year} · cash terms
            </span>
          </div>
        </div>
        <AssumptionSummary
          data={data}
          onExplain={() => onNavigate("methodology", "elasticity")}
        />
        <p className="section-intro mb-3">
          Rates rise to 20%, 40% and 45%, and Business Asset Disposal Relief is
          withdrawn.
        </p>
        <PolicySummary data={data} />
        <p className="source-note">
          Conditional model estimates. The medium-term behavioural response is
          applied in full from the first year.
        </p>
        <details className="disclosure">
          <summary>What changes, and what stays the same?</summary>
          <div>
            <p>
              The rates apply to main and residential property gains. Qualifying
              business gains move to the main schedule when the relief is
              withdrawn. The £3,000 annual exempt amount stays in place.
            </p>
            <p>
              The rates match 20% / 40% / 45% on earnings; they do not follow
              Scotland's earnings schedule or the higher savings and property
              income rates from April 2027. Carried interest stays in the income
              tax framework.
            </p>
            <p>
              The reform does not remove the uplift at death, introduce an exit
              charge or add an investment allowance.
            </p>
            <button className="text-link" onClick={() => onNavigate("cgt")}>
              Understand the current rules and the tax base →
            </button>
          </div>
        </details>
      </section>
      <section id="behaviour" className="story-section">
        <p className="eyebrow">What drives the answer</p>
        <h2>The response to higher rates matters</h2>
        <p className="section-intro">
          With gains held fixed, the reform raises{" "}
          {formatSignedBn(staticRow.static_gov_balance_change_bn, 1)} in{" "}
          {firstYear}. Behaviour reduces that estimate.
        </p>
        <div className="calculation-strip">
          <div>
            <span>Gains held fixed</span>
            <strong>
              {formatSignedBn(staticRow.static_gov_balance_change_bn, 1)}
            </strong>
          </div>
          <span aria-hidden="true">→</span>
          <div>
            <span>After the response</span>
            <strong>
              {formatSignedBn(first.gov_balance_change_bn - offset, 1)}
            </strong>
          </div>
          {offset !== 0 && (
            <>
              <span aria-hidden="true">+</span>
              <div>
                <span>Income tax and NI added</span>
                <strong>{formatSignedBn(offset, 1)}</strong>
              </div>
            </>
          )}
          <span aria-hidden="true">=</span>
          <div className="calculation-total">
            <span>Central estimate</span>
            <strong>{formatSignedBn(first.gov_balance_change_bn, 1)}</strong>
          </div>
        </div>
        <h3 className="mt-7">
          Other behavioural assumptions give different answers
        </h3>
        <p className="source-note">
          The darker teal bar is the central case. These are separate scenarios,
          not a confidence interval. Elasticities use different definitions;
          CenTax's assumptions relate to a wider reform package.
        </p>
        <SensitivityChart data={data} />
        <button
          className="text-link mt-4"
          onClick={() => onNavigate("methodology", "elasticity")}
        >
          Why these assumptions differ →
        </button>
      </section>
      <section id="each-year" className="story-section">
        <p className="eyebrow">Across the forecast</p>
        <h2>The revenue change each year</h2>
        <p className="section-intro">
          The same reform and central behavioural assumption, applied in each
          year.
        </p>
        <BudgetChart budget={data.budget} />
        <details className="disclosure">
          <summary>Which parts of the reform raise CGT?</summary>
          <div>
            <p>
              Each step adds to the changes above it. Contributions depend on
              this order and count CGT only, before any income tax and National
              Insurance addition.
            </p>
            <Toggle
              options={[
                { value: "central", label: "Central response" },
                { value: "static", label: "Gains held fixed" },
              ]}
              value={splitCase}
              onChange={setSplitCase}
            />
            <div className="table-scroll">
              <table className="data-table">
                <caption>Additional CGT in {data.schedule_split.year}</caption>
                <thead>
                  <tr>
                    <th scope="col">Step</th>
                    <th scope="col">Added by this step</th>
                    <th scope="col">Running total</th>
                  </tr>
                </thead>
                <tbody>
                  {data.schedule_split.steps.map((step) => (
                    <tr key={step.step}>
                      <th scope="row">{step.label}</th>
                      <td>
                        {formatSignedBn(step[`${splitCase}_increment_bn`], 1)}
                      </td>
                      <td>
                        {formatSignedBn(step[`${splitCase}_cgt_change_bn`], 1)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </details>
      </section>
      <section id="who-is-affected" className="story-section">
        <p className="eyebrow">Household outcomes</p>
        <h2>The largest income change is at the top</h2>
        <div className="distribution-preview">
          <strong>{formatSignedPct(topGroup.relative_change_pct, 1)}</strong>
          <div>
            <h3>Average net income change for the highest-income {topShare}</h3>
            <p>
              Across all households in this group, including those with no
              taxable gains.
            </p>
          </div>
        </div>
        <p className="insight-note">
          This includes gains people stop realising as well as extra tax. It is
          not a measure of extra tax paid or a loss of wealth; income tax and NI
          added for shifting are not included.
        </p>
        <button
          className="text-link mt-5"
          onClick={() => onNavigate("distribution")}
        >
          Explore income, age and region →
        </button>
      </section>
    </ReadingLayout>
  );
}
