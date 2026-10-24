"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { getNiceTicks, getTickDomain } from "../../lib/chartUtils";
import { colors } from "../../lib/colors";
import { formatSignedBn } from "../../lib/formatters";
import ChartLogo from "../ChartLogo";
import { TOOLTIP_PROPS, TooltipCard } from "./ChartTooltip";

const AXIS_STYLE = { fontSize: 12, fill: colors.gray[500] };
const fmt = (v) => formatSignedBn(v, 1);

const FILLS = {
  positive: colors.primary[300],
  positiveCentral: colors.primary[700],
  negative: "#F2A7A7", // muted tint of colors.error
  negativeCentral: colors.error,
};

// "CenTax lower (retention elasticity 0.5)" -> "CenTax lower"; the static
// case reads as "No response".
export function shortCaseName(name) {
  const head = String(name).split(" (")[0];
  return head === "Static" ? "No response" : head;
}

function elasticityText(row) {
  const e = Number(row.e_retention);
  const badr = row.badr_elasticity;
  const main = `elasticity ${e.toFixed(1)}`;
  return badr === undefined || Number(badr) === e
    ? main
    : `${main}; BADR ${Number(badr).toFixed(1)}`;
}

function CaseTick({ x, y, payload, rows, centralIndex }) {
  const row = rows[payload.index];
  if (!row) return null;
  const isCentral = payload.index === centralIndex;
  return (
    <text x={x - 6} y={y} textAnchor="end">
      <tspan
        x={x - 6}
        dy={-3}
        fontSize={12}
        fontWeight={isCentral ? 700 : 400}
        fill={isCentral ? colors.gray[900] : colors.gray[700]}
      >
        {row.short}
      </tspan>
      <tspan x={x - 6} dy={14} fontSize={10.5} fill={colors.gray[500]}>
        {elasticityText(row)}
      </tspan>
    </text>
  );
}

// Every value label sits to the right: past the end of a positive bar, and
// just right of the zero line for a negative one, so labels never run into
// the case names on the left however narrow the chart is.
function ValueLabel({ x, y, width, height, value, index, centralIndex }) {
  if (!Number.isFinite(value)) return null;
  // For a negative bar Recharts reports x at the zero line and a negative
  // width; either way the right-hand edge is the larger of x and x + width.
  const right = Math.max(x, x + width);
  return (
    <text
      x={right + 6}
      y={y + height / 2}
      textAnchor="start"
      dominantBaseline="central"
      pointerEvents="none"
      fontSize={12}
      fontWeight={index === centralIndex ? 700 : 600}
      fill={colors.gray[900]}
    >
      {fmt(value)}
    </text>
  );
}

function SensitivityTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <TooltipCard
      title={row.name}
      rows={[{ label: `${row.year} revenue`, value: fmt(row.revenue), color: row.fill }]}
    />
  );
}

// The bar form of the sensitivity chart, kept for a results file or a
// caller without the sensitivity curve: one year's revenue from the reform
// under each behavioural case, diverging around zero. `rows` is the pipeline's sensitivity block, in display order;
// the case whose retention elasticity equals `centralRetention` is highlighted.
export default function SensitivityBars({ rows, centralRetention = 1 }) {
  const data = rows.map((row) => ({
    ...row,
    short: shortCaseName(row.name),
    revenue: Number(row.revenue_bn),
  }));
  const centralIndex = data.findIndex((r) => Number(r.e_retention) === Number(centralRetention));
  data.forEach((row, i) => {
    const central = i === centralIndex;
    row.fill =
      FILLS[row.revenue < 0 ? (central ? "negativeCentral" : "negative") : central ? "positiveCentral" : "positive"];
  });
  const values = data.map((r) => r.revenue).filter(Number.isFinite);
  const lo = Math.min(0, ...values);
  const hi = Math.max(0, ...values);
  // Room past the positive end for its value label; negative labels sit
  // right of zero, inside the positive range.
  const pad = (hi - lo || 1) * 0.2;
  const ticks = getNiceTicks([lo, hi + pad], 6);
  const domain = getTickDomain(ticks);

  return (
    <>
      <div className="h-[280px] w-full">
        <ResponsiveContainer>
          <BarChart
            data={data}
            layout="vertical"
            barCategoryGap="22%"
            margin={{ top: 5, right: 12, bottom: 5, left: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke={colors.border.light} horizontal={false} />
            <XAxis
              type="number"
              domain={domain}
              ticks={ticks}
              tick={AXIS_STYLE}
              tickFormatter={(v) => formatSignedBn(v, 0)}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              type="category"
              dataKey="short"
              width={140}
              interval={0}
              tick={<CaseTick rows={data} centralIndex={centralIndex} />}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip {...TOOLTIP_PROPS} content={<SensitivityTooltip />} />
            <Bar dataKey="revenue" radius={[0, 6, 6, 0]} isAnimationActive={false}>
              {data.map((row) => (
                <Cell key={row.name} fill={row.fill} />
              ))}
              <LabelList dataKey="revenue" content={<ValueLabel centralIndex={centralIndex} />} />
            </Bar>
            <ReferenceLine x={0} stroke={colors.gray[600]} strokeWidth={1.5} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <ChartLogo />
    </>
  );
}
