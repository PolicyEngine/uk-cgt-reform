"use client";

import { useState } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceDot,
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
import ChartLegend from "./ChartLegend";
import SensitivityBars from "./SensitivityBars";
import { TOOLTIP_PROPS, TooltipCard } from "./ChartTooltip";
import { Notes, SourceLabel, TabLink } from "../controls";

const AXIS_STYLE = { fontSize: 12, fill: colors.gray[500] };
const fmt = (v) => formatSignedBn(v, 1);
const X_MAX = 4;

const LINE = colors.primary[700];
const FILL_ABOVE = colors.primary[300];
const FILL_BELOW = "#F2A7A7"; // muted tint of colors.error
const OFFICIAL = colors.gray[700];
const GUIDE = colors.gray[400];

// The marked elasticities, each a vertical line with a short label. Labels
// sit in rows above the plot, alternating left to right, so neighbours
// never share a row: 0.5 and 1.0 are 0.5 apart, which is about 35px on a
// phone. On a narrow chart CenTax's three labels take a row each. The
// central value's line is solid and darker.
const MARKS = [
  { e: 0.5, label: "CenTax lower", row: 0, narrowRow: 0 },
  { e: 1.0, label: "CenTax central", row: 1, narrowRow: 1, central: true },
  { e: 2.0, label: "CenTax upper", row: 0, narrowRow: 2 },
  { e: 3.0, label: "", row: 1, narrowRow: 0 },
  { e: 3.6, label: "HMRC/OBR", row: 0, narrowRow: 1 },
];
const ROW_HEIGHT = 16;
// Below this chart width the labels take three rows.
const NARROW = 640;

// The official case sets its own elasticity for gains qualifying for the
// relief, so it is not a point on a one-elasticity curve.
const isSplitCase = (row) =>
  row.badr_elasticity !== undefined && Number(row.badr_elasticity) !== Number(row.e_retention);

// "about 1.9": the break-even elasticity to one decimal place.
export function breakEvenText(crossing) {
  return crossing ? `£0 at about ${crossing.elasticity.toFixed(1)}` : null;
}

function MarkLabel({ viewBox, mark, chartWidth }) {
  if (!viewBox) return null;
  const { x } = viewBox;
  // Keep a label inside the chart near either edge.
  const anchor = chartWidth && x > chartWidth - 44 ? "end" : x < 40 ? "start" : "middle";
  const y = 12 + mark.row * ROW_HEIGHT;
  return (
    <text
      x={anchor === "end" ? x + 4 : anchor === "start" ? x - 4 : x}
      y={y}
      textAnchor={anchor}
      fontSize={11}
      fontWeight={mark.central ? 700 : 500}
      fill={mark.central ? colors.gray[900] : colors.gray[600]}
    >
      {mark.label ? `${mark.label} ${mark.e.toFixed(1)}` : mark.e.toFixed(1)}
    </text>
  );
}

// The x-axis title and, under it, what the elasticity measures.
const AXIS_SUBTITLE = ["how much taxpayers cut realised gains", "as their after-tax share falls"];

function AxisTitle({ viewBox, narrow }) {
  if (!viewBox) return null;
  const x = viewBox.x + viewBox.width / 2;
  const y = viewBox.y + viewBox.height + 8;
  return (
    <text x={x} y={y} textAnchor="middle">
      <tspan x={x} fontSize={12} fill={colors.gray[600]}>
        Retention elasticity
      </tspan>
      {(narrow ? AXIS_SUBTITLE : [AXIS_SUBTITLE.join(" ")]).map((line) => (
        <tspan key={line} x={x} dy={14} fontSize={11} fill={colors.gray[500]}>
          {line}
        </tspan>
      ))}
    </text>
  );
}

function BreakEvenLabel({ cx, cy, text }) {
  if (!Number.isFinite(cx) || !Number.isFinite(cy)) return null;
  return (
    <g>
      <circle cx={cx} cy={cy} r={4} fill="#FFFFFF" stroke={colors.gray[900]} strokeWidth={1.5} />
      <text
        x={cx + 7}
        y={cy - 8}
        textAnchor="start"
        fontSize={11}
        fontWeight={600}
        fill={colors.gray[900]}
        stroke="#FFFFFF"
        strokeWidth={3}
        paintOrder="stroke"
      >
        {text}
      </text>
    </g>
  );
}

function OfficialRing({ cx, cy }) {
  if (!Number.isFinite(cx) || !Number.isFinite(cy)) return null;
  return <circle cx={cx} cy={cy} r={6.5} fill="none" stroke={OFFICIAL} strokeWidth={2} />;
}

function CurveTooltip({ active, payload, year, official }) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  const rows = [{ label: `${year} change in CGT revenue`, value: fmt(point.revenue), color: LINE }];
  if (official && point.elasticity === Number(official.e_retention)) {
    rows.push({
      label: `Official case (relief gains ${Number(official.badr_elasticity).toFixed(1)})`,
      value: fmt(Number(official.revenue_bn)),
      color: OFFICIAL,
    });
  }
  return <TooltipCard title={`Retention elasticity ${point.elasticity.toFixed(1)}`} rows={rows} />;
}

// One year's change in CGT revenue from the reform against the retention
// elasticity. `rows` is the pipeline's sensitivity block for the year (the
// official case among them, drawn as a ring); `curve` is the year's
// `sensitivity_curve` block, the line's computed points and the £0 crossing.
// Without `curve` (a year the pipeline has no grid for) the chart keeps its
// bar form, SensitivityBars.
// `centralRetention` is the dashboard's central elasticity.
export default function SensitivityChart({ rows, centralRetention = 1, curve }) {
  // Without the year's curve the chart keeps its bar form rather than draw
  // a line through a few cases.
  if (!curve?.grid?.length) return <SensitivityBars rows={rows} centralRetention={centralRetention} />;
  return <SensitivityCurve rows={rows} centralRetention={centralRetention} curve={curve} />;
}

function SensitivityCurve({ rows, centralRetention, curve }) {
  const [chartWidth, setChartWidth] = useState(0);
  const points = curve.grid;
  const data = points
    .map((p) => ({ elasticity: Number(p.elasticity), revenue: Number(p.revenue_bn) }))
    .filter((p) => Number.isFinite(p.revenue));
  const crossing = curve.break_even;
  const official = rows.find(isSplitCase);
  const year = rows[0]?.year ?? curve?.year;
  const narrow = chartWidth > 0 && chartWidth < NARROW;
  const marks = MARKS.map((m) => ({
    ...m,
    row: narrow ? m.narrowRow : m.row,
    central: Number(m.e) === Number(centralRetention),
  }));
  const rowCount = Math.max(...marks.map((m) => m.row)) + 1;

  const values = [...data.map((p) => p.revenue), ...(official ? [Number(official.revenue_bn)] : [])];
  const lo = Math.min(0, ...values);
  const hi = Math.max(0, ...values);
  // Round ticks, with one more step past an end that a value comes close
  // to, so the ring and the line's ends never sit on the plot's edge.
  const nice = getNiceTicks([lo, hi], 6);
  const step = nice[1] - nice[0];
  const ticks = [
    ...(lo < 0 && lo - nice[0] < 0.25 * step ? [nice[0] - step] : []),
    ...nice,
    ...(hi > 0 && nice.at(-1) - hi < 0.25 * step ? [nice.at(-1) + step] : []),
  ];
  const domain = getTickDomain(ticks);
  // The fill changes colour at £0: the gradient spans the area's own box,
  // from its highest value (or £0) down to its lowest (or £0).
  const top = Math.max(0, ...data.map((p) => p.revenue));
  const bottom = Math.min(0, ...data.map((p) => p.revenue));
  const split = top - bottom > 0 ? top / (top - bottom) : 1;
  const gradientId = `sensitivity-fill-${String(year).replace(/\W/g, "")}`;

  return (
    <>
      <div className="h-[340px] w-full">
        <ResponsiveContainer onResize={(width) => setChartWidth(width)}>
          <ComposedChart data={data} margin={{ top: rowCount * ROW_HEIGHT + 10, right: 14, bottom: narrow ? 46 : 32, left: 0 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset={0} stopColor={FILL_ABOVE} stopOpacity={0.45} />
                <stop offset={split} stopColor={FILL_ABOVE} stopOpacity={0.45} />
                <stop offset={split} stopColor={FILL_BELOW} stopOpacity={0.45} />
                <stop offset={1} stopColor={FILL_BELOW} stopOpacity={0.45} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={colors.border.light} vertical={false} />
            <XAxis
              type="number"
              dataKey="elasticity"
              domain={[0, X_MAX]}
              ticks={[0, 1, 2, 3, 4]}
              tick={AXIS_STYLE}
              tickFormatter={(v) => v.toFixed(1)}
              tickLine={false}
              axisLine={{ stroke: colors.border.medium }}
              label={<AxisTitle narrow={narrow} />}
            />
            <YAxis
              domain={domain}
              ticks={ticks}
              width={56}
              tick={AXIS_STYLE}
              tickFormatter={(v) => formatSignedBn(v, 0)}
              tickLine={false}
              axisLine={false}
            />
            {marks.map((mark) => (
              <ReferenceLine
                key={mark.e}
                x={mark.e}
                stroke={mark.central ? colors.gray[800] : GUIDE}
                strokeWidth={mark.central ? 1.5 : 1}
                strokeDasharray={mark.central ? undefined : "4 3"}
                label={<MarkLabel mark={mark} chartWidth={chartWidth} />}
              />
            ))}
            <ReferenceLine y={0} stroke={colors.gray[600]} strokeWidth={1.5} />
            <Area
              type="monotone"
              dataKey="revenue"
              baseValue={0}
              stroke="none"
              fill={`url(#${gradientId})`}
              isAnimationActive={false}
              activeDot={false}
              tooltipType="none"
            />
            <Line
              type="monotone"
              dataKey="revenue"
              stroke={LINE}
              strokeWidth={2.5}
              dot={{ r: 2, fill: LINE, stroke: "none" }}
              activeDot={{ r: 5, fill: LINE, stroke: "#FFFFFF", strokeWidth: 2 }}
              isAnimationActive={false}
            />
            {crossing ? (
              <ReferenceDot
                x={crossing.elasticity}
                y={0}
                r={0}
                ifOverflow="visible"
                shape={(props) => <BreakEvenLabel {...props} text={breakEvenText(crossing)} />}
              />
            ) : null}
            {official ? (
              <ReferenceDot
                x={Number(official.e_retention)}
                y={Number(official.revenue_bn)}
                r={0}
                ifOverflow="visible"
                shape={(props) => <OfficialRing {...props} />}
              />
            ) : null}
            <Tooltip
              {...TOOLTIP_PROPS}
              cursor={{ stroke: colors.gray[400], strokeWidth: 1 }}
              content={<CurveTooltip year={year} official={official} />}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <ChartLegend
        items={[
          { label: "One elasticity for every gain", fill: LINE, marker: "dot" },
          ...(official
            ? [
                {
                  label: `Official case: ${Number(official.e_retention).toFixed(1)}, ${Number(official.badr_elasticity).toFixed(1)} for relief gains`,
                  fill: OFFICIAL,
                  marker: "ring",
                },
              ]
            : []),
        ]}
      />
      <ChartLogo />
    </>
  );
}

// The section's one-line description, under its title.
export const SENSITIVITY_DESCRIPTION =
  "The line shows the change in CGT revenue as the assumed retention elasticity rises from 0 to 4; the vertical lines mark CenTax's range, a value the ready reckoner uses and the official HMRC/OBR value.";

// The section's notes. `curve` is the year's `sensitivity_curve` block (or
// absent); `central`, `centaxRange` and `official` are the benchmarks
// block's elasticities; `centaxHref` and `officialHref` are the sources.
export function SensitivityNotes({ onNavigate, curve, central, centaxRange, official, centaxHref, officialHref }) {
  const grid = curve?.grid ?? [];
  return (
    <Notes>
      <p>
        The line joins {curve?.runs ?? grid.length} runs of the reform, each with a different
        elasticity of realised gains with respect to the retention{" "}
        <TabLink onNavigate={onNavigate} tab="methodology" section="elasticity">
          rate
        </TabLink>{" "}
        (1 − t), applied to every gain: 0.0 to 4.0 in steps of 0.2, plus 0.5. The dots are the
        runs; between them the line is interpolated, and so is the £0 point, linearly between the
        two runs either side of it.
      </p>
      <p>
        CenTax central {central.e_retention.toFixed(1)} is the dashboard&apos;s central
        assumption; CenTax lower {centaxRange.lower.toFixed(1)} and upper{" "}
        {centaxRange.upper.toFixed(1)} are the ends of the range from{" "}
        <SourceLabel href={centaxHref} label="CenTax" />, anchored on{" "}
        <a
          href="https://www.aeaweb.org/articles?id=10.1257/aeri.20200535"
          target="_blank"
          rel="noopener noreferrer"
          className="underline decoration-1 underline-offset-2 hover:opacity-80"
        >
          Agersnap
        </a>{" "}
        &amp; Zidar (2021) and{" "}
        <a
          href="https://www.nber.org/papers/w28514"
          target="_blank"
          rel="noopener noreferrer"
          className="underline decoration-1 underline-offset-2 hover:opacity-80"
        >
          Lavecchia
        </a>{" "}
        &amp; Tazhitdinova (2024).
      </p>
      <p>
        3.0 is one of the elasticities the{" "}
        <TabLink onNavigate={onNavigate} tab="baseline" section="ready-reckoner">
          ready reckoner
        </TabLink>{" "}
        is scored at.
      </p>
      <p>
        HMRC/OBR {official.e_retention.toFixed(1)} is the official assumption (
        <SourceLabel href={officialHref} label="OBR" />, January 2025, para 1.9). The official case
        gives gains qualifying for BADR their own {Number(official.badr_e_retention).toFixed(1)}, so
        its ring sits off the line;{" "}
        <TabLink onNavigate={onNavigate} tab="methodology" section="elasticity-gap">
          Methodology
        </TabLink>{" "}
        describes both elasticities and the{" "}
        <TabLink onNavigate={onNavigate} tab="methodology" section="elasticity">
          scope
        </TabLink>{" "}
        of CenTax&apos;s central value.
      </p>
    </Notes>
  );
}
