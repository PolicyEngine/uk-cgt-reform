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
import { colors } from "../../lib/colors";
import { formatPct } from "../../lib/formatters";
import ChartLogo from "../ChartLogo";
import ChartLegend from "./ChartLegend";
import { TOOLTIP_PROPS, TooltipCard } from "./ChartTooltip";

const AXIS_STYLE = { fontSize: 12, fill: colors.gray[500] };
const MINUS = "−";

// Every row shares one scale from 0, so bars compare across rows: at least
// 0–50%, extended in 10-point steps to hold the largest rate (custom
// schedules can reach 75%), with a tick every 10 points.
export function rateScale(rows) {
  const rates = rows.flatMap((r) => [r.baseline, r.reform]).filter(isRate).map(Number);
  const top = Math.max(0.5, Math.ceil(Math.max(0, ...rates) * 10 - 1e-9) / 10);
  const ticks = Array.from({ length: Math.round(top * 10) + 1 }, (_, i) => i / 10);
  return { domain: [0, top], ticks };
}
// Identical horizontal margins on every row chart and on the axis chart keep
// the gridlines and bar origins aligned down the column. The right margin
// holds the value label past a bar that ends near 50%.
const MARGIN = { top: 2, right: 40, bottom: 2, left: 14 };
const BAR_SIZE = 16;
const ROW_CHART_HEIGHT = 44;

const SERIES = {
  baseline: { label: "Current law", fill: colors.gray[400], text: colors.gray[600] },
  reform: { label: "Reform", fill: colors.primary[600], text: colors.primary[700] },
};

const pct = (v) => formatPct(v * 100, 0);

function isRate(v) {
  return v !== null && v !== undefined && Number.isFinite(Number(v));
}

// "+2 pp", "−4 pp", "No change"; null when either side is not a rate.
export function formatPpChange(baseline, reform) {
  if (!isRate(baseline) || !isRate(reform)) return null;
  const pp = Math.round((Number(reform) - Number(baseline)) * 1000) / 10;
  if (pp === 0) return "No change";
  const digits = Number.isInteger(pp) ? 0 : 1;
  return `${pp > 0 ? "+" : MINUS}${Math.abs(pp).toFixed(digits)} pp`;
}

function ChangeChip({ baseline, reform }) {
  const text = formatPpChange(baseline, reform);
  if (!text) return null;
  const up = Number(reform) > Number(baseline);
  return (
    <span
      className="shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums"
      style={{
        background: up ? colors.primary[50] : colors.gray[100],
        color: up ? colors.primary[700] : colors.gray[700],
      }}
    >
      {text}
    </span>
  );
}

// A withdrawn item gets a dashed "Withdrawn" marker at the origin in place
// of its bar (drawn as the bar's shape, since a zero-width bar has no label).
function BarShape({ x, y, width, height, fill, payload }) {
  if (payload?.withdrawn) {
    const w = 78;
    return (
      <g>
        <rect
          x={x}
          y={y}
          width={w}
          height={height}
          rx={4}
          fill="#FFFFFF"
          stroke={colors.gray[500]}
          strokeDasharray="3 2"
        />
        <text
          x={x + w / 2}
          y={y + height / 2}
          textAnchor="middle"
          dominantBaseline="central"
          pointerEvents="none"
          fontSize={11.5}
          fontWeight={600}
          fill={colors.gray[700]}
        >
          Withdrawn
        </text>
        {payload.note ? (
          <text
            x={x + w + 8}
            y={y + height / 2}
            dominantBaseline="central"
            pointerEvents="none"
            fontSize={12}
            fill={colors.gray[600]}
          >
            {payload.note}
          </text>
        ) : null}
      </g>
    );
  }
  if (!payload?.hasValue || !(width > 0)) return null;
  const r = Math.min(4, width / 2, height / 2);
  return (
    <path
      fill={fill}
      d={`M${x},${y} h${width - r} a${r},${r} 0 0 1 ${r},${r} v${height - 2 * r} a${r},${r} 0 0 1 ${-r},${r} h${-(width - r)} Z`}
    />
  );
}

// The value past the end of each bar.
function BarLabel({ x, y, width, height, index, data }) {
  const d = data[index];
  if (!d) return null;
  const cy = y + height / 2;
  if (!d.hasValue) return null;
  return (
    <text
      x={x + width + 6}
      y={cy}
      textAnchor="start"
      dominantBaseline="central"
      pointerEvents="none"
      fontSize={12}
      fontWeight={d.series === "reform" ? 700 : 500}
      fill={SERIES[d.series].text}
    >
      {pct(d.value)}
      {d.note ? (
        <tspan fontWeight={400} fill={colors.gray[500]}>
          {` · ${d.note}`}
        </tspan>
      ) : null}
    </text>
  );
}

// The hovered bar: its series and rate (with any note), under the row label.
function RowTooltip({ active, payload, title }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  const value = d.withdrawn ? "Withdrawn" : d.hasValue ? pct(d.value) : "None";
  return (
    <TooltipCard
      title={title}
      rows={[{ label: SERIES[d.series].label, value: d.note ? `${value} · ${d.note}` : value, color: SERIES[d.series].fill }]}
    />
  );
}

function RowChart({ row, domain, ticks }) {
  const data = ["baseline", "reform"].map((series) => {
    const raw = row[series];
    const hasValue = isRate(raw);
    return {
      series,
      value: hasValue ? Number(raw) : 0,
      hasValue,
      // Only a missing reform value reads as a withdrawal; a missing baseline
      // (an item the reform introduces) simply shows no bar.
      withdrawn: series === "reform" && !hasValue,
      note: series === "baseline" ? row.baselineNote : row.reformNote,
    };
  });
  return (
    <div style={{ height: ROW_CHART_HEIGHT }} className="w-full">
      <ResponsiveContainer>
        <BarChart data={data} layout="vertical" margin={MARGIN} barCategoryGap={3}>
          <XAxis type="number" domain={domain} ticks={ticks} hide />
          <YAxis type="category" dataKey="series" hide />
          <CartesianGrid strokeDasharray="3 3" stroke={colors.border.light} horizontal={false} />
          <ReferenceLine x={0} stroke={colors.gray[400]} />
          <Tooltip {...TOOLTIP_PROPS} content={<RowTooltip title={row.label} />} />
          <Bar dataKey="value" barSize={BAR_SIZE} shape={<BarShape />} isAnimationActive={false}>
            {data.map((d) => (
              <Cell key={d.series} fill={SERIES[d.series].fill} />
            ))}
            <LabelList dataKey="value" content={<BarLabel data={data} />} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function AxisChart({ domain, ticks }) {
  return (
    <div className="h-[26px] w-full">
      <ResponsiveContainer>
        <BarChart data={[{ v: 0 }]} layout="vertical" margin={{ ...MARGIN, top: 0, bottom: 0 }}>
          <XAxis
            type="number"
            domain={domain}
            ticks={ticks}
            tick={AXIS_STYLE}
            tickFormatter={pct}
            tickLine={false}
            axisLine={false}
            orientation="top"
            height={22}
            interval={0}
          />
          <YAxis type="category" hide />
          <Bar dataKey="v" isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// Current law against the reform, one item per row: a grey and a teal bar on
// a shared scale from 0 (at least 0–50%), the value past each bar (with any short note), and
// the change in points.
// `rows`: [{ key, label, baseline, reform, baselineNote?, reformNote? }] with
// rates as fractions; a null reform value marks a withdrawn item.
export default function RateChangeChart({ rows }) {
  const { domain, ticks } = rateScale(rows);
  return (
    <>
      <div aria-hidden="true">
        <AxisChart domain={domain} ticks={ticks} />
      </div>
      <div role="list" aria-label="Rates under current law and the reform">
        {rows.map((row) => {
          const summary = `${row.label}: current law ${
            isRate(row.baseline) ? pct(row.baseline) : "none"
          }, reform ${isRate(row.reform) ? pct(row.reform) : "withdrawn"}`;
          return (
            <div
              key={row.key}
              role="listitem"
              aria-label={summary}
              className="border-b border-slate-100 py-2 last:border-b-0"
            >
              <div className="flex items-start justify-between gap-3" style={{ paddingLeft: MARGIN.left }}>
                <p className="text-sm font-semibold leading-5 text-slate-800">{row.label}</p>
                <ChangeChip baseline={row.baseline} reform={row.reform} />
              </div>
              <div aria-hidden="true">
                <RowChart row={row} domain={domain} ticks={ticks} />
              </div>
            </div>
          );
        })}
      </div>
      <ChartLegend items={Object.values(SERIES).map(({ label, fill }) => ({ label, fill }))} />
      <ChartLogo />
    </>
  );
}

// Plain one-line facts printed under the chart for items that need no bar
// (the same in both cases, or not a rate): pass `items` as strings or nodes.
export function RateChangeCaption({ items }) {
  if (!items?.length) return null;
  return (
    <ul className="mt-2 space-y-1 text-xs leading-5 text-slate-500">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}
