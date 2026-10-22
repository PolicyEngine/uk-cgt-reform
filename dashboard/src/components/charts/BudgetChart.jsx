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
import { colors } from "../../lib/colors";
import { formatSignedBn } from "../../lib/formatters";
import ChartLogo from "../ChartLogo";
import ChartLegend from "./ChartLegend";
import { LabelledSelect } from "../controls";

const AXIS_STYLE = { fontSize: 12, fill: colors.gray[500] };

// Baseline and reform CGT revenue, or the change in the government balance,
// by fiscal year. `budget` is the pipeline's budget rows.
export default function BudgetChart({ budget }) {
  const [budgetView, setBudgetView] = useState("change");
  return (
    <>
      <div className="mb-4 flex flex-wrap gap-3">
        <div>
          <LabelledSelect
            label="Show"
            options={[
              { value: "change", label: "Change in government balance" },
              { value: "levels", label: "CGT revenue, baseline and reform" },
            ]}
            value={budgetView}
            onChange={setBudgetView}
          />
        </div>
      </div>
      <div className="h-[340px] w-full">
        <ResponsiveContainer>
          <BarChart data={budget} margin={{ top: 10, right: 20, bottom: 15, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={colors.border.light} />
            <XAxis
              dataKey="year"
              tick={AXIS_STYLE}
              label={{ value: "Fiscal year", position: "insideBottom", offset: -8, fontSize: 12 }}
            />
            <YAxis
              tick={AXIS_STYLE}
              tickFormatter={(v) => formatSignedBn(v, 0)}
              tickLine={false}
              axisLine={false}
              width={72}
            />
            <Tooltip formatter={(v) => formatSignedBn(v, 1)} cursor={{ fill: colors.gray[100] }} />
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
      {budgetView === "levels" ? (
        <ChartLegend
          items={[
            { label: "Baseline CGT revenue", fill: colors.gray[400] },
            { label: "Reform CGT revenue", fill: colors.primary[600] },
          ]}
        />
      ) : null}
      <ChartLogo />
    </>
  );
}
