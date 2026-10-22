"use client";

import { useEffect, useState } from "react";
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
import { LabelledSelect, YearSelect } from "../controls";

const AXIS_STYLE = { fontSize: 12, fill: colors.gray[500] };


// Change in household net income by income quantile, household type or
// region, for a chosen year. `groupsByYear` is the pipeline's
// income_change_groups block (fiscal label -> groupings).
export default function GroupImpactChart({ groupsByYear, initialYear }) {
  const years = Object.keys(groupsByYear);
  const [groupYear, setGroupYear] = useState(initialYear ?? years[0]);
  const [groupMetric, setGroupMetric] = useState("absolute");
  const [grouping, setGrouping] = useState("quintile");
  useEffect(() => {
    if (!years.includes(groupYear)) setGroupYear(years[0]);
  }, [years, groupYear]);
  const groups = groupsByYear[groupYear] ?? groupsByYear[years[0]];
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

  return (
    <>
      <div className="mb-4 flex flex-wrap gap-2 sm:gap-3">
        <YearSelect years={years} value={groupYear} onChange={setGroupYear} />
        <LabelledSelect
          label="Group by"
          options={[
            { value: "quintile", label: "Quintiles" },
            { value: "quartile", label: "Quartiles" },
            { value: "household_type", label: "Household type" },
            { value: "region", label: "Region" },
          ]}
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
                  label={
                    grouping === "household_type"
                      ? undefined
                      : {
                          value: "Baseline household income group",
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
              cursor={{ fill: colors.gray[100] }}
              formatter={(v, name, item) => [
                `${formatSignedPct(item.payload.relative_change_pct)} (${formatSignedCurrency(item.payload.avg_change_gbp)}/household)`,
                "Net income change",
              ]}
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

// How the groups are defined, as bullets for the Notes under the chart; a
// caller adds its own bullets as children.
export function GroupDefinitions({ children }) {
  return (
    <ul className="list-disc space-y-1.5 pl-5">
      <li>Income groups are weighted quantiles of household net income before the reform.</li>
      <li>
        &ldquo;Pensioner&rdquo; households have no working-age adults; &ldquo;With children&rdquo;
        households contain at least one child.
      </li>
      <li>
        Regional averages reflect where households with taxable gains live in the survey, so they
        are noisier than the income groups; households without an assigned area are excluded.
      </li>
      {children}
    </ul>
  );
}
