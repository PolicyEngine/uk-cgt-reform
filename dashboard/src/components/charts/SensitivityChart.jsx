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
import { colors } from "../../lib/colors";
import { formatSignedBn } from "../../lib/formatters";
import ChartLogo from "../ChartLogo";
import ChartLegend from "./ChartLegend";
import SensitivityBars from "./SensitivityBars";
import { elasticityLayout, markLines, xAxisProps, yAxisProps } from "./elasticityAxis";
import { TOOLTIP_PROPS, TooltipCard } from "./ChartTooltip";
import { Notes, SourceLabel, TabLink } from "../controls";

const fmt = (v) => formatSignedBn(v, 1);

const LINE = colors.primary[700];
const FILL_ABOVE = colors.primary[300];
const FILL_BELOW = "#F2A7A7"; // muted tint of colors.error
const OFFICIAL = colors.gray[700];

// The official case sets its own elasticity for gains qualifying for the
// relief, so it is not a point on a one-elasticity curve.
const isSplitCase = (row) =>
  row.badr_elasticity !== undefined && Number(row.badr_elasticity) !== Number(row.e_retention);

// The official case's label on the chart: one line, or three on a phone.
function officialLines(official, narrow) {
  const value = `${fmt(Number(official.revenue_bn))}`;
  const relief = `(${Number(official.badr_elasticity).toFixed(1)} for relief gains)`;
  return narrow ? ["HMRC/OBR official:", value, relief] : [`HMRC/OBR official: ${value} ${relief}`];
}

// "about 1.9": the break-even elasticity to one decimal place.
export function breakEvenText(crossing) {
  return crossing ? `£0 at about ${crossing.elasticity.toFixed(1)}` : null;
}

// "£0 at about 1.9", just below the £0 line and left of the crossing,
// where the curve (above £0 there) leaves room. No marker.
function BreakEvenLabel({ cx, cy, text }) {
  if (!Number.isFinite(cx) || !Number.isFinite(cy)) return null;
  return (
    <text
      x={cx - 6}
      y={cy + 15}
      textAnchor="end"
      fontSize={11}
      fontWeight={600}
      fill={colors.gray[900]}
      stroke="#FFFFFF"
      strokeWidth={3}
      paintOrder="stroke"
    >
      {text}
    </text>
  );
}

function OfficialRing({ cx, cy }) {
  if (!Number.isFinite(cx) || !Number.isFinite(cy)) return null;
  return <circle cx={cx} cy={cy} r={6.5} fill="none" stroke={OFFICIAL} strokeWidth={2} />;
}

// The official case's label, above the £0 line at its elasticity: the curve
// is below £0 there, so the space is clear in every year. It ends at the
// 3.6 line, or at the plot's right edge in three lines on a narrow chart.
function OfficialLabel({ cx, cy, lines, right }) {
  if (!Number.isFinite(cx) || !Number.isFinite(cy)) return null;
  const x = right ?? cx + 4;
  return (
    <text
      x={x}
      y={cy - 10 - 13 * (lines.length - 1)}
      textAnchor="end"
      fontSize={11}
      fontWeight={600}
      fill={OFFICIAL}
      stroke="#FFFFFF"
      strokeWidth={3}
      paintOrder="stroke"
    >
      {lines.map((line, i) => (
        <tspan key={line} x={x} dy={i === 0 ? 0 : 13}>
          {line}
        </tspan>
      ))}
    </text>
  );
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
  const { narrow, marks, margin } = elasticityLayout(chartWidth, centralRetention);

  const values = [...data.map((p) => p.revenue), ...(official ? [Number(official.revenue_bn)] : [])];
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
          <ComposedChart data={data} margin={margin}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset={0} stopColor={FILL_ABOVE} stopOpacity={0.45} />
                <stop offset={split} stopColor={FILL_ABOVE} stopOpacity={0.45} />
                <stop offset={split} stopColor={FILL_BELOW} stopOpacity={0.45} />
                <stop offset={1} stopColor={FILL_BELOW} stopOpacity={0.45} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={colors.border.light} vertical={false} />
            <XAxis {...xAxisProps(narrow)} />
            <YAxis {...yAxisProps(Math.min(...values), Math.max(...values))} />
            {markLines(marks, chartWidth)}
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
              dot={false}
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
            {official ? (
              <ReferenceDot
                x={Number(official.e_retention)}
                y={0}
                r={0}
                ifOverflow="visible"
                shape={(props) => (
                  <OfficialLabel
                    {...props}
                    right={narrow && chartWidth ? chartWidth - margin.right : undefined}
                    lines={officialLines(official, narrow)}
                  />
                )}
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
        (1 − t), applied to every gain: 0.0 to 4.0 in steps of 0.2, plus 0.5. Between runs the line
        is interpolated, and so is the £0 point, linearly between the two runs either side of it.
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
