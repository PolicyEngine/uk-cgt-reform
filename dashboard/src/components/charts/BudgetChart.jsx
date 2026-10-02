"use client";

import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { colors } from "../../lib/colors";
import { formatBn, formatSignedBn } from "../../lib/formatters";
import ChartLogo from "../ChartLogo";
import { Toggle } from "../controls";

const AXIS_STYLE = { fontSize: 12, fill: colors.gray[500] };

// Baseline and reform CGT revenue, or the change in the government balance,
// by fiscal year. `budget` is the pipeline's budget rows.
export default function BudgetChart({ budget }) {
  const [budgetView, setBudgetView] = useState("change");
  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-4">
        <Toggle
          options={[
            { value: "change", label: "Revenue change" },
            { value: "levels", label: "CGT revenue levels" },
          ]}
          value={budgetView}
          onChange={setBudgetView}
        />
      </div>
      <p className="source-note">
        {budgetView === "levels"
          ? "CGT liability only. Income tax and National Insurance from shifting are excluded from these levels."
          : "Change in government revenue under the selected income-shifting approach."}
      </p>
      <div className="h-[340px] w-full">
        <ResponsiveContainer>
          <BarChart
            data={budget}
            margin={{ top: 10, right: 20, bottom: 5, left: 10 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke={colors.border.light} />
            <XAxis dataKey="year" tick={AXIS_STYLE} />
            <YAxis
              tick={AXIS_STYLE}
              tickFormatter={(v) => formatBn(v)}
              tickLine={false}
              axisLine={false}
            />
            <ReferenceLine y={0} stroke={colors.gray[400]} />
            <Tooltip formatter={(v) => formatBn(v)} />
            <Legend />
            {budgetView === "levels" ? (
              <>
                <Bar
                  dataKey="baseline_cgt_bn"
                  name="Baseline CGT revenue"
                  fill={colors.gray[400]}
                  radius={[6, 6, 0, 0]}
                />
                <Bar
                  dataKey="reform_cgt_bn"
                  name="Reform CGT revenue"
                  fill={colors.primary[600]}
                  radius={[6, 6, 0, 0]}
                />
              </>
            ) : (
              <Bar
                dataKey="gov_balance_change_bn"
                name="Revenue change"
                fill={colors.primary[600]}
                radius={[6, 6, 0, 0]}
              />
            )}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <ChartLogo />
      <details className="disclosure">
        <summary>View annual figures</summary>
        <div className="table-scroll">
          <table className="data-table">
            <caption>Revenue, £ billion in cash terms</caption>
            <thead>
              <tr>
                <th scope="col">Year</th>
                <th scope="col">Current policy CGT</th>
                <th scope="col">Reform CGT</th>
                <th scope="col">Revenue change, selected approach</th>
              </tr>
            </thead>
            <tbody>
              {budget.map((row) => (
                <tr key={row.year}>
                  <th scope="row">{row.year}</th>
                  <td>{formatBn(row.baseline_cgt_bn, 1)}</td>
                  <td>{formatBn(row.reform_cgt_bn, 1)}</td>
                  <td>{formatSignedBn(row.gov_balance_change_bn, 1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </>
  );
}
