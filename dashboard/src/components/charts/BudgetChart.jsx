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
import { getTickDecimals, getZeroBasedTicks } from "../../lib/chartUtils";
import { colors } from "../../lib/colors";
import { formatSignedBn } from "../../lib/formatters";
import ChartLogo from "../ChartLogo";
import ChartLegend from "./ChartLegend";
import ChartTooltip, { TOOLTIP_PROPS } from "./ChartTooltip";
import { PillSelect } from "../controls";
import SectionHeading from "../SectionHeading";

const AXIS_STYLE = { fontSize: 12, fill: colors.gray[500] };

// Baseline and reform CGT revenue, or the change in the government balance,
// by fiscal year, under its heading with the "Show" pill. `budget` is the
// pipeline's budget rows. It renders two blocks, the heading and the chart,
// so a two-column card can line them up with its neighbour's.
export default function BudgetChart({ budget, title, description }) {
  const [budgetView, setBudgetView] = useState("change");
  // £0 is always on the axis, so bars grow from it whatever their sign, on
  // round ticks printed to the decimals that keep each label distinct.
  const keys = budgetView === "levels" ? ["baseline_cgt_bn", "reform_cgt_bn"] : ["gov_balance_change_bn"];
  const { ticks, domain } = getZeroBasedTicks(budget.flatMap((row) => keys.map((key) => row[key])), 5);
  const decimals = getTickDecimals(ticks);
  return (
    <>
      <SectionHeading
        title={title}
        description={description}
        paired
        action={
          <PillSelect
            label="Show"
            options={[
              { value: "change", label: "Change in government balance" },
              { value: "levels", label: "CGT revenue, baseline and reform" },
            ]}
            value={budgetView}
            onChange={setBudgetView}
          />
        }
      />
      <div>
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
              domain={domain}
              ticks={ticks}
              tickFormatter={(v) => (v === 0 ? "£0" : formatSignedBn(v, decimals))}
              tickLine={false}
              axisLine={false}
              width={72}
            />
            <Tooltip
              {...TOOLTIP_PROPS}
              content={<ChartTooltip title={(year) => `Fiscal year ${year}`} format={(v) => formatSignedBn(v, 1)} />}
            />
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
      </div>
    </>
  );
}
