"use client";

import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { colors } from "../../lib/colors";
import { formatBn } from "../../lib/formatters";
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
            { value: "levels", label: "Revenue levels" },
            { value: "change", label: "Change vs baseline" },
          ]}
          value={budgetView}
          onChange={setBudgetView}
        />
      </div>
      <div className="h-[380px] w-full">
        <ResponsiveContainer>
          <BarChart data={budget} margin={{ top: 10, right: 20, bottom: 5, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={colors.border.light} />
            <XAxis dataKey="year" tick={AXIS_STYLE} />
            <YAxis
              tick={AXIS_STYLE}
              tickFormatter={(v) => formatBn(v)}
              tickLine={false}
              axisLine={false}
            />
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
                name="Government balance change"
                fill={colors.primary[600]}
                radius={[6, 6, 0, 0]}
              />
            )}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <ChartLogo />
    </>
  );
}
