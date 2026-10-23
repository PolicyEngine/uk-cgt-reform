"use client";

import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { getNiceTicks, getTickDomain } from "../../lib/chartUtils";
import { colors } from "../../lib/colors";
import { formatSignedCurrency, formatSignedPct } from "../../lib/formatters";
import ChartLogo from "../ChartLogo";
import { LabelledSelect } from "../controls";
import SectionHeading from "../SectionHeading";
import ChartTooltip, { TOOLTIP_PROPS } from "./ChartTooltip";

const AXIS_STYLE = { fontSize: 12, fill: colors.gray[500] };

const GROUPINGS = [
  { value: "decile", label: "Income deciles", title: "income decile" },
  { value: "quartile", label: "Income quartiles", title: "income quartile" },
  { value: "household_type", label: "Household type", title: "household type" },
  { value: "region", label: "Region", title: "region" },
];


// Change in household net income by income decile or quartile (ranked by
// household net income before the reform), household type or region, in a
// chosen year (`defaultYear` first), under a heading that names the grouping
// and the year. `groupsByYear` is the pipeline's income_change_groups block
// (fiscal label -> groupings); `description` sits under the heading.
export default function GroupImpactChart({ groupsByYear, defaultYear, description }) {
  const years = Object.keys(groupsByYear);
  const [groupYear, setGroupYear] = useState(years.includes(defaultYear) ? defaultYear : years[0]);
  const [groupMetric, setGroupMetric] = useState("absolute");
  const groups = groupsByYear[groupYear] ?? groupsByYear[years[0]];
  // Only the groupings the results carry (a result from before deciles has
  // none), deciles first.
  const groupingOptions = GROUPINGS.filter((option) => Array.isArray(groups[option.value]));
  const [chosenGrouping, setGrouping] = useState(groupingOptions[0]?.value);
  const grouping = groupingOptions.some((o) => o.value === chosenGrouping)
    ? chosenGrouping
    : groupingOptions[0]?.value;
  const isDecile = grouping === "decile";
  // Deciles are labelled 1 (lowest) to 10 (highest) on the axis, which has
  // no room for ten ranges; the tooltip names the range.
  const decileOf = (group) => groups.decile.findIndex((d) => d.group === group) + 1;
  const isRelative = groupMetric === "relative";
  const metricKey = isRelative ? "relative_change_pct" : "avg_change_gbp";
  // Regions and household types are ordered by impact (largest loss first);
  // the quantile groupings keep their income order.
  const chartData =
    grouping === "region" || grouping === "household_type"
      ? [...groups[grouping]].sort((a, b) => a[metricKey] - b[metricKey])
      : groups[grouping];
  // The value axis always includes £0, so bar lengths read as true sizes,
  // on round ticks.
  const values = chartData.map((d) => d[metricKey]);
  const ticks = getNiceTicks([Math.min(0, ...values), Math.max(0, ...values)], 5);
  const domain = getTickDomain(ticks);
  const metricName = isRelative ? "Relative net income change" : "Average change per household";
  const formatMetric = (v) => (isRelative ? formatSignedPct(v, 1) : formatSignedCurrency(v));

  const groupingTitle = GROUPINGS.find((option) => option.value === grouping)?.title;

  return (
    <>
      <SectionHeading
        title={`Change in household net income by ${groupingTitle}, ${groupYear}`}
        description={description}
      />
      <div className="mb-4 flex flex-wrap gap-2 sm:gap-3">
        <LabelledSelect
          label="Year"
          options={years.map((year) => ({ value: year, label: year }))}
          value={groupYear}
          onChange={setGroupYear}
        />
        <LabelledSelect
          label="Group by"
          options={groupingOptions}
          value={grouping}
          onChange={setGrouping}
        />
        <LabelledSelect
          label="Metric"
          options={[
            { value: "absolute", label: "Average £" },
            { value: "relative", label: "Average %" },
          ]}
          value={groupMetric}
          onChange={setGroupMetric}
        />
      </div>
      <div className="h-[340px] w-full">
        <ResponsiveContainer>
          <BarChart
            data={chartData}
            layout={grouping === "region" ? "vertical" : "horizontal"}
            margin={{ top: 10, right: 20, bottom: 15, left: grouping === "region" ? 30 : 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke={colors.border.light} />
            {grouping === "region" ? (
              <>
                <XAxis
                  type="number"
                  domain={domain}
                  ticks={ticks}
                  tick={AXIS_STYLE}
                  tickFormatter={formatMetric}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="group"
                  width={130}
                  tick={{ ...AXIS_STYLE, fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                />
              </>
            ) : (
              <>
                <XAxis
                  dataKey="group"
                  tick={AXIS_STYLE}
                  interval={0}
                  tickFormatter={isDecile ? (group) => String(decileOf(group)) : undefined}
                  label={
                    grouping === "household_type"
                      ? undefined
                      : {
                          value: isDecile
                            ? "Income decile before the reform (1 = lowest)"
                            : "Income quartile before the reform",
                          position: "insideBottom",
                          offset: -8,
                          fontSize: 12,
                        }
                  }
                />
                <YAxis
                  domain={domain}
                  ticks={ticks}
                  tick={AXIS_STYLE}
                  tickFormatter={formatMetric}
                  tickLine={false}
                  axisLine={false}
                  width={72}
                />
              </>
            )}
            <Tooltip
              {...TOOLTIP_PROPS}
              content={
                <ChartTooltip
                  title={(_, payload) => {
                    const { group } = payload[0].payload;
                    const name = isDecile ? `Income decile ${decileOf(group)} (${group.toLowerCase()})` : group;
                    return `${name}, ${groupYear}`;
                  }}
                  rows={(payload) => [
                    {
                      label: "Average change per household",
                      value: formatSignedCurrency(payload[0].payload.avg_change_gbp),
                      color: colors.primary[600],
                    },
                    {
                      label: "Relative net income change",
                      value: formatSignedPct(payload[0].payload.relative_change_pct, 1),
                    },
                  ]}
                />
              }
            />
            <Bar
              dataKey={metricKey}
              name={metricName}
              fill={colors.primary[600]}
              radius={grouping === "region" ? [0, 6, 6, 0] : [6, 6, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <ChartLogo />
    </>
  );
}

export const GROUP_DESCRIPTION =
  "Each bar shows the average change in net income for one group of households, ranked by income before the reform.";

// How the groups are defined, as bullets for the Notes under the chart; a
// caller adds its own bullets as children.
export function GroupDefinitions({ children }) {
  return (
    <ul className="list-disc space-y-1.5 pl-5">
      <li>
        Income deciles and quartiles are weighted tenths and quarters of households ranked by
        household net income before the reform; decile 1 is the bottom income decile and 10 the top.
      </li>
      <li>
        &ldquo;Pensioner&rdquo; households have no working-age adults; &ldquo;With children&rdquo;
        households contain at least one child.
      </li>
      <li>
        Regional averages reflect where households with taxable gains live in the survey and rest
        on fewer households than the income groups; households without an assigned area are excluded.
      </li>
      {children}
    </ul>
  );
}
