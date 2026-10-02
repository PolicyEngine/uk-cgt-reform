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
import { colors } from "../../lib/colors";
import { formatSignedCurrency, formatSignedPct } from "../../lib/formatters";
import { availableGroupings, GROUP_LABELS } from "../../lib/presentation";
import ChartLogo from "../ChartLogo";
import { LabelledSelect, YearSelect, Toggle } from "../controls";

const AXIS_STYLE = { fontSize: 11, fill: colors.gray[500] };

export default function GroupImpactChart({ groupsByYear, initialYear }) {
  const years = Object.keys(groupsByYear);
  const [chosenYear, setGroupYear] = useState(initialYear ?? years[0]);
  const [groupMetric, setGroupMetric] = useState("absolute");
  const [chosenGrouping, setGrouping] = useState("decile");
  const groupYear = years.includes(chosenYear) ? chosenYear : years[0];
  const groups = groupsByYear[groupYear];
  const choices = availableGroupings(groups);
  const available = choices.map((choice) => choice.value);
  const grouping = available.includes(chosenGrouping)
    ? chosenGrouping
    : available[0];
  if (!grouping) {
    return <p>No distribution breakdowns are available for this run.</p>;
  }
  const isRelative = groupMetric === "relative";
  const metricKey = isRelative ? "relative_change_pct" : "avg_change_gbp";
  const chartData =
    grouping === "region"
      ? [...groups[grouping]].sort((a, b) => a[metricKey] - b[metricKey])
      : groups[grouping];
  // Keep signed values intact. For reductions, put zero on the left so bars
  // extend rightward as the size of the income reduction grows. Mixed-sign
  // custom results keep a conventional diverging axis.
  const reductionsOnly = chartData.every((row) => row[metricKey] <= 0);
  const formatMetric = (v) =>
    isRelative ? formatSignedPct(v, 1) : formatSignedCurrency(v);
  const groupNote =
    grouping === "age"
      ? "Age of the oldest household member, measured in the selected year. These are household averages, not effects on individual people of that age."
      : grouping === "region"
        ? "Region where the household lives. Smaller samples make regional estimates less precise. Households without an assigned region are excluded."
        : grouping === "decile"
          ? "Households ranked by net income before the reform, including realised gains. Each group represents 10% of weighted households. Income is not adjusted for household size."
          : "Pensioner households have no working-age adults; households with children contain at least one child.";

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-4">
        <LabelledSelect
          label="Group by"
          options={choices}
          value={grouping}
          onChange={setGrouping}
        />
        <YearSelect years={years} value={groupYear} onChange={setGroupYear} />
        <Toggle
          options={[
            { value: "absolute", label: "£ per household" },
            { value: "relative", label: "% of net income" },
          ]}
          value={groupMetric}
          onChange={setGroupMetric}
        />
      </div>
      <p className="source-note">
        {groupNote} Averages include households with no taxable gains.
        {reductionsOnly && " Larger reductions extend further to the right."}
      </p>
      <div
        style={{ height: chartData.length * 38 + 55, width: "100%" }}
        role="img"
        aria-label={`Average household net income change by ${GROUP_LABELS[grouping].toLowerCase()} in ${groupYear}. All figures are available below.`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 10, right: 25, bottom: 15, left: 0 }}
          >
            <CartesianGrid
              horizontal={false}
              strokeDasharray="3 3"
              stroke={colors.border.light}
            />
            <XAxis
              type="number"
              domain={["auto", "auto"]}
              reversed={reductionsOnly}
              niceTicks="snap125"
              tick={AXIS_STYLE}
              tickFormatter={formatMetric}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              type="category"
              dataKey="group"
              width={grouping === "region" ? 132 : 112}
              tick={AXIS_STYLE}
              tickLine={false}
              axisLine={false}
            />
            <ReferenceLine x={0} stroke={colors.gray[400]} />
            <Tooltip
              formatter={(_v, _name, item) => [
                `${formatSignedCurrency(item.payload.avg_change_gbp)} (${formatSignedPct(item.payload.relative_change_pct)})`,
                "Net income change",
              ]}
            />
            <Bar
              dataKey={metricKey}
              name="Average net income change"
              fill="var(--chart-5)"
              radius={3}
              maxBarSize={23}
            >
              {chartData.map((row) => (
                <Cell
                  key={row.group}
                  fill={
                    row[metricKey] < 0 ? "var(--chart-5)" : "var(--chart-1)"
                  }
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <ChartLogo />
      <details className="disclosure">
        <summary>View the figures</summary>
        <div className="table-scroll">
          <table className="data-table">
            <caption>Average household net income change · {groupYear}</caption>
            <thead>
              <tr>
                <th scope="col">{GROUP_LABELS[grouping]}</th>
                <th scope="col">£ per household</th>
                <th scope="col">% of net income</th>
              </tr>
            </thead>
            <tbody>
              {chartData.map((row) => (
                <tr key={row.group}>
                  <th scope="row">{row.group}</th>
                  <td>{formatSignedCurrency(row.avg_change_gbp)}</td>
                  <td>{formatSignedPct(row.relative_change_pct)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </>
  );
}
