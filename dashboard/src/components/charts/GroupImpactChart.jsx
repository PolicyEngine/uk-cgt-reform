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
  // Regions are ordered by impact (largest loss first); the quantile and
  // household-type groupings keep their natural order.
  const chartData =
    grouping === "region"
      ? [...groups.region].sort((a, b) => a[metricKey] - b[metricKey])
      : groups[grouping];
  const metricName = isRelative ? "Relative net income change" : "Average change per household";
  const formatMetric = (v) => (isRelative ? formatSignedPct(v, 1) : formatSignedCurrency(v));

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-4">
        <YearSelect years={years} value={groupYear} onChange={setGroupYear} />
        <LabelledSelect
          label="Group by"
          options={[
            { value: "quintile", label: "Income quintiles" },
            { value: "quartile", label: "Income quartiles" },
            { value: "household_type", label: "Household type" },
            { value: "region", label: "Region" },
          ]}
          value={grouping}
          onChange={setGrouping}
        />
        <LabelledSelect
          label="Metric"
          options={[
            { value: "absolute", label: "Average £ per household" },
            { value: "relative", label: "Relative (%)" },
          ]}
          value={groupMetric}
          onChange={setGroupMetric}
        />
      </div>
      <div className="h-[420px] w-full">
        <ResponsiveContainer>
          <BarChart
            data={chartData}
            layout={grouping === "region" ? "vertical" : "horizontal"}
            margin={{ top: 10, right: 20, bottom: 15, left: grouping === "region" ? 30 : 10 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke={colors.border.light} />
            {grouping === "region" ? (
              <>
                <XAxis
                  type="number"
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
                  tick={AXIS_STYLE}
                  tickFormatter={formatMetric}
                  tickLine={false}
                  axisLine={false}
                />
              </>
            )}
            <Tooltip
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

      <details className="group mt-4 border-t border-slate-100 pt-4">
        <summary className="cursor-pointer select-none text-sm font-semibold text-slate-700 marker:text-[color:var(--pe-color-primary-600)]">
          How the groups are defined
        </summary>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Income groups are weighted quantiles of baseline household net
          income. Household types: &ldquo;Pensioner&rdquo; households have no
          working-age adults; &ldquo;With children&rdquo; households contain
          at least one child. Regional averages reflect where households
          holding taxable gains live in the survey data and carry more
          sampling noise than the income groups; households without an
          assigned area are excluded.
        </p>
      </details>
    </>
  );
}
