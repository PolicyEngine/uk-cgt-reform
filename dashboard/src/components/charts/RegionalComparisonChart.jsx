"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { getNiceTicks, getTickDomain } from "../../lib/chartUtils";
import { colors } from "../../lib/colors";
import { formatPct } from "../../lib/formatters";
import ChartLogo from "../ChartLogo";
import ChartLegend from "./ChartLegend";
import { RowAxis } from "./benchmarkRows";
import { TOOLTIP_PROPS, TooltipCard } from "./ChartTooltip";

const MINUS = "−";
// Room for a value label beside the outer dot on either side.
const MARGIN = { top: 0, right: 46, bottom: 0, left: 46 };
const ROW_CHART_HEIGHT = 18;
const DOT_R = 5;
// Region names sit in a column beside the dots from `sm` up, above them below.
const NAME_COL = "sm:w-32 sm:shrink-0";

const PE = { fill: colors.primary[600], text: colors.primary[700] };
const CENTAX = { fill: colors.gray[400], text: colors.gray[600] };

const isNum = (v) => v !== null && v !== undefined && Number.isFinite(Number(v));

export function formatUplift(value) {
  if (!isNum(value)) return "—";
  return `${value < 0 ? MINUS : "+"}${Math.abs(value).toFixed(0)}%`;
}

const PANELS = [
  {
    key: "share",
    title: "Share of baseline CGT",
    pe: "baseline_share_pct",
    centax: "centax_baseline_share_pct",
    format: (v) => formatPct(v, 1),
    tickFormat: (v) => formatPct(v, 0),
    fromZero: true,
    tickCount: 4,
  },
];

// The props from `benchmarks.centax_2019_20_rules.regions`, largest share of
// baseline CGT first (the dataset's share), so the regions that carry most of
// the comparison lead. The file keeps
// CenTax's Table 8 order (the standard regional list).
export function buildRegionRows(regions) {
  const rows = regions.map((row) => ({
    region: row.region,
    baseline_share_pct: row.baseline_share_pct,
    centax_baseline_share_pct: row.centax_baseline_share_pct,
    uplift_pct: row.uplift_pct,
    centax_uplift_pct: row.centax_uplift_pct,
  }));
  return rows.sort((a, b) => Number(b.baseline_share_pct) - Number(a.baseline_share_pct));
}

// A connector between the two dots, each dot's value on its outer side.
function Dumbbell({ x, y, width, height, payload, format }) {
  if (!payload || !isNum(payload.pe) || !isNum(payload.cx)) return null;
  const cy = y + height / 2;
  const left = Math.min(x, x + width);
  const right = Math.max(x, x + width);
  const peLeft = payload.pe <= payload.cx;
  const dots = [
    { cx: peLeft ? left : right, s: PE, v: payload.pe, side: peLeft ? "left" : "right" },
    { cx: peLeft ? right : left, s: CENTAX, v: payload.cx, side: peLeft ? "right" : "left" },
  ];
  return (
    <g>
      <line x1={left} x2={right} y1={cy} y2={cy} stroke={colors.gray[300]} strokeWidth={2} />
      {/* CenTax under PolicyEngine, so the teal dot shows when they meet. */}
      {[dots[1], dots[0]].map((d) => (
        <circle key={d.s.fill} cx={d.cx} cy={cy} r={DOT_R} fill={d.s.fill} stroke="#FFFFFF" strokeWidth={1} />
      ))}
      {dots.map((d) => (
        <text
          key={`t${d.s.fill}`}
          x={d.side === "left" ? d.cx - DOT_R - 4 : d.cx + DOT_R + 4}
          y={cy}
          textAnchor={d.side === "left" ? "end" : "start"}
          dominantBaseline="central"
          pointerEvents="none"
          fontSize={11.5}
          fontWeight={d.s === PE ? 700 : 500}
          fill={d.s.text}
          style={{ fontVariantNumeric: "tabular-nums" }}
        >
          {format(d.v)}
        </text>
      ))}
    </g>
  );
}

function RowChart({ d, domain, ticks, format, labels }) {
  return (
    <div style={{ height: ROW_CHART_HEIGHT }} className="w-full">
      <ResponsiveContainer>
        <BarChart data={[d]} layout="vertical" margin={MARGIN}>
          <XAxis type="number" domain={domain} ticks={ticks} hide />
          <YAxis type="category" dataKey="region" hide />
          <CartesianGrid strokeDasharray="3 3" stroke={colors.border.light} horizontal={false} />
          <Tooltip
            {...TOOLTIP_PROPS}
            content={({ active }) =>
              active ? (
                <TooltipCard
                  title={d.region}
                  rows={[
                    { label: labels.pe, value: format(d.pe), color: PE.fill },
                    { label: labels.centax, value: format(d.cx), color: CENTAX.fill },
                  ]}
                />
              ) : null
            }
          />
          <Bar dataKey="range" barSize={12} shape={<Dumbbell format={format} />} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function Panel({ panel, rows, labels }) {
  const data = rows.map((row) => {
    const pe = Number(row[panel.pe]);
    const cx = Number(row[panel.centax]);
    return { region: row.region, pe, cx, range: [Math.min(pe, cx), Math.max(pe, cx)] };
  });
  const values = data.flatMap((d) => [d.pe, d.cx]);
  const lo = panel.fromZero ? 0 : Math.min(...values);
  const ticks = getNiceTicks([lo, Math.max(...values)], panel.tickCount);
  const domain = getTickDomain(ticks);
  return (
    <figure className="min-w-0">
      <div className="flex" aria-hidden="true">
        <span className={`hidden sm:block ${NAME_COL}`} />
        <div className="min-w-0 flex-1">
          <RowAxis domain={domain} ticks={ticks} format={panel.tickFormat} margin={MARGIN} />
        </div>
      </div>
      <div role="list" aria-label={panel.title}>
        {data.map((d) => (
          <div
            key={d.region}
            role="listitem"
            aria-label={`${d.region}: ${labels.pe} ${panel.format(d.pe)}, ${labels.centax} ${panel.format(d.cx)}`}
            className="border-b border-slate-100 py-1 last:border-b-0 sm:flex sm:items-center"
          >
            <p aria-hidden="true" className={`${NAME_COL} text-xs leading-4 text-slate-700`}>
              {d.region}
            </p>
            <div aria-hidden="true" className="min-w-0 flex-1">
              <RowChart d={d} domain={domain} ticks={ticks} format={panel.format} labels={labels} />
            </div>
          </div>
        ))}
      </div>
    </figure>
  );
}

// Region by region, the dataset against CenTax (2024) at 2019/20 rules:
// each region's share of baseline CGT, one dot per source. Each row carries its values as an aria-label; the drawing
// itself is hidden from screen readers. `rows`: buildRegionRows(regions).
export default function RegionalComparisonChart({ rows, peLabel = "PolicyEngine", centaxLabel = "CenTax 2024" }) {
  const labels = { pe: peLabel, centax: centaxLabel };
  return (
    <>
      <div>
        {PANELS.map((panel) => (
          <Panel key={panel.key} panel={panel} rows={rows} labels={labels} />
        ))}
      </div>
      <ChartLegend
        items={[
          { label: peLabel, fill: PE.fill, marker: "dot" },
          { label: centaxLabel, fill: CENTAX.fill, marker: "dot" },
        ]}
      />
      <ChartLogo />
    </>
  );
}
