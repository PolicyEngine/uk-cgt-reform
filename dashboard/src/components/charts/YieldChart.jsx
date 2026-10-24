"use client";

import { useState } from "react";
import {
  Area,
  Bar,
  BarChart,
  ComposedChart,
  Line,
  ReferenceDot,
  CartesianGrid,
  LabelList,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { getNiceTicks, getTickDecimals, getTickDomain } from "../../lib/chartUtils";
import { colors } from "../../lib/colors";
import { formatSignedBn } from "../../lib/formatters";
import ChartLogo from "../ChartLogo";
import ChartLegend from "./ChartLegend";
import { TOOLTIP_PROPS, TooltipCard } from "./ChartTooltip";
import { elasticityLayout, markLines, xAxisProps, yAxisProps } from "./elasticityAxis";

const AXIS_STYLE = { fontSize: 12, fill: colors.gray[500] };
const fmt = (v) => formatSignedBn(v, 1);

// One colour, short name and label colour per reform step, in stacking order.
// Steps the pipeline adds later fall back to the extra colours below.
const STEP_STYLE = {
  main_rates: { short: "Income tax rates on other gains", fill: colors.primary[700], text: "#FFFFFF" },
  residential: { short: "Income tax rates on residential property", fill: colors.primary[300], text: colors.gray[900] },
  badr_withdrawn: { short: "Relief withdrawn", fill: colors.gray[400], text: colors.gray[900] },
};
const FALLBACK_FILLS = [colors.primary[500], colors.gray[600], colors.primary[100]];

const CASES = [
  { key: "static", label: ["No behavioural", "response"] },
  { key: "central", label: ["CenTax central", "elasticity"] },
];

// A segment's value is printed inside it only when it is wide enough to hold
// the text; narrow segments are read from the tooltip.
const MIN_LABEL_PX = 46;

function styleFor(step, index) {
  return (
    STEP_STYLE[step.step] ?? {
      short: step.label,
      fill: FALLBACK_FILLS[index % FALLBACK_FILLS.length],
      text: colors.gray[900],
    }
  );
}

function CaseTick({ x, y, payload }) {
  const lines = CASES.find((c) => c.key === payload.value)?.label ?? [payload.value];
  return (
    <text x={x - 6} y={y} textAnchor="end" fontSize={12} fill={colors.gray[700]}>
      {lines.map((line, i) => (
        <tspan key={line} x={x - 6} dy={i === 0 ? (1 - lines.length) * 7 + 4 : 14}>
          {line}
        </tspan>
      ))}
    </text>
  );
}

function SegmentLabel({ x, y, width, height, value, textColor }) {
  if (!Number.isFinite(value) || Math.abs(width) < MIN_LABEL_PX) return null;
  return (
    <text
      x={x + width / 2}
      y={y + height / 2}
      textAnchor="middle"
      dominantBaseline="central"
      pointerEvents="none"
      fontSize={12}
      fontWeight={600}
      fill={textColor}
    >
      {fmt(value)}
    </text>
  );
}

// The total sits past the end of the bar on the side it points to.
function TotalLabel({ x, y, width, height, index, data }) {
  const row = data[index];
  if (!row) return null;
  const negative = row.total < 0;
  const end = negative ? row.minEnd : row.maxEnd;
  // Recharts gives this segment's own geometry; place the total relative to
  // the bar's outer edge on the side the total points to.
  const pxPerUnit = width && row.lastValue ? width / row.lastValue : 0;
  const edge = pxPerUnit ? x + width + (end - row.lastEnd) * pxPerUnit : x + width;
  return (
    <text
      x={edge + (negative ? -8 : 8)}
      y={y + height / 2}
      textAnchor={negative ? "end" : "start"}
      dominantBaseline="central"
      pointerEvents="none"
      fontSize={13}
      fontWeight={700}
      fill={colors.gray[900]}
    >
      {fmt(row.total)}
    </text>
  );
}

function YieldTooltip({ active, payload, label, steps }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  const caseLabel = CASES.find((c) => c.key === label)?.label.join(" ") ?? label;
  return (
    <TooltipCard
      title={caseLabel}
      rows={steps.map((step, i) => ({
        label: styleFor(step, i).short,
        value: fmt(row[step.step]),
        color: styleFor(step, i).fill,
      }))}
      footer={{ label: "Total", value: fmt(row.total) }}
    />
  );
}

// Where one year's yield comes from (schedule_split[year]): with the
// pipeline's grid (`grid`), each step's increment stacked across the
// retention elasticity, 0 to 4, its top edge the sensitivity curve; without
// it, two bars, no behavioural response and the CenTax central elasticity.
// `steps` is the pipeline's schedule_split.steps.
// `official` (optional) is the year's official HMRC/OBR sensitivity row,
// drawn as a labelled ring at its total; `breakEven` (optional) is the
// year's interpolated £0 crossing, labelled with no marker.
export default function YieldChart({ steps, grid, centralRetention = 1, official, breakEven }) {
  if (grid?.length)
    return (
      <YieldArea
        steps={steps}
        grid={grid}
        centralRetention={centralRetention}
        official={official}
        breakEven={breakEven}
      />
    );
  return <YieldBars steps={steps} />;
}

const TOTAL_LINE = colors.gray[900];
const OFFICIAL = colors.gray[700];

function OfficialRing({ cx, cy }) {
  if (!Number.isFinite(cx) || !Number.isFinite(cy)) return null;
  return <circle cx={cx} cy={cy} r={6.5} fill="#FFFFFF" fillOpacity={0.6} stroke={OFFICIAL} strokeWidth={2} />;
}

// The official case's label on the chart: one line, or three on a phone.
function officialLines(official, narrow) {
  const value = fmt(Number(official.revenue_bn));
  const relief = `(${Number(official.badr_elasticity).toFixed(1)} for relief gains)`;
  return narrow ? ["HMRC/OBR official:", value, relief] : [`HMRC/OBR official: ${value} ${relief}`];
}

// The official case's label, above the £0 line at its elasticity: the total
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

// "£0 at about 1.8", just below the £0 line and left of the crossing, where
// the total (above £0 there) leaves room. No marker.
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

function YieldAreaTooltip({ active, payload, steps, official }) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  const atOfficial = official && point.elasticity === Number(official.e_retention);
  return (
    <TooltipCard
      title={`Retention elasticity ${point.elasticity.toFixed(1)}`}
      rows={[
        ...steps.map((step, i) => ({
          label: styleFor(step, i).short,
          value: fmt(point[step.step]),
          color: styleFor(step, i).fill,
        })),
        ...(atOfficial
          ? [
              {
                label: `HMRC/OBR official case (${Number(official.badr_elasticity).toFixed(1)} for relief gains)`,
                value: fmt(Number(official.revenue_bn)),
                color: OFFICIAL,
              },
            ]
          : []),
      ]}
      footer={{ label: "Total", value: fmt(point.total) }}
    />
  );
}

// The parts stacked by sign at each elasticity (positive parts up from £0,
// negative ones down), with the total, the sensitivity curve, as a line.
function YieldArea({ steps, grid, centralRetention, official, breakEven }) {
  const [chartWidth, setChartWidth] = useState(0);
  const { narrow, marks, margin } = elasticityLayout(chartWidth, centralRetention);
  const data = grid.map((p) => {
    const row = { elasticity: Number(p.elasticity), total: Number(p.total_bn) };
    for (const step of steps) row[step.step] = Number(p[`${step.step}_bn`]) || 0;
    return row;
  });
  const ends = data.flatMap((row) => {
    const parts = steps.map((step) => row[step.step]);
    return [
      parts.filter((v) => v > 0).reduce((a, b) => a + b, 0),
      parts.filter((v) => v < 0).reduce((a, b) => a + b, 0),
      row.total,
    ];
  });
  if (official) ends.push(Number(official.revenue_bn));
  return (
    <>
      <div className="h-[340px] w-full">
        <ResponsiveContainer onResize={(width) => setChartWidth(width)}>
          <ComposedChart data={data} margin={margin} stackOffset="sign">
            <CartesianGrid strokeDasharray="3 3" stroke={colors.border.light} vertical={false} />
            <XAxis {...xAxisProps(narrow)} />
            <YAxis {...yAxisProps(Math.min(...ends), Math.max(...ends))} />
            {steps.map((step, i) => (
              <Area
                key={step.step}
                type="linear"
                dataKey={step.step}
                name={styleFor(step, i).short}
                stackId="yield"
                stroke={styleFor(step, i).fill}
                strokeWidth={1}
                fill={styleFor(step, i).fill}
                fillOpacity={0.75}
                isAnimationActive={false}
                activeDot={false}
              />
            ))}
            {markLines(marks, chartWidth)}
            <ReferenceLine y={0} stroke={colors.gray[600]} strokeWidth={1.5} />
            <Line
              type="linear"
              dataKey="total"
              name="Total"
              stroke={TOTAL_LINE}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: TOTAL_LINE, stroke: "#FFFFFF", strokeWidth: 2 }}
              isAnimationActive={false}
            />
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
            {breakEven ? (
              <ReferenceDot
                x={breakEven.elasticity}
                y={0}
                r={0}
                ifOverflow="visible"
                shape={(props) => (
                  <BreakEvenLabel {...props} text={`£0 at about ${breakEven.elasticity.toFixed(1)}`} />
                )}
              />
            ) : null}
            <Tooltip
              {...TOOLTIP_PROPS}
              cursor={{ stroke: colors.gray[400], strokeWidth: 1 }}
              content={<YieldAreaTooltip steps={steps} official={official} />}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <ChartLegend
        items={[
          ...steps.map((step, i) => ({ label: styleFor(step, i).short, fill: styleFor(step, i).fill })),
          { label: "Total change in CGT revenue", fill: TOTAL_LINE, marker: "dot" },
          ...(official
            ? [
                {
                  label: `HMRC/OBR official case: ${Number(official.e_retention).toFixed(1)}, ${Number(official.badr_elasticity).toFixed(1)} for relief gains`,
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

// The bar form, for a year without the grid.
function YieldBars({ steps }) {
  const data = CASES.map(({ key }) => {
    const row = { case: key };
    let pos = 0;
    let neg = 0;
    steps.forEach((step) => {
      const v = Number(step[`${key}_increment_bn`]) || 0;
      row[step.step] = v;
      if (v >= 0) pos += v;
      else neg += v;
    });
    const last = steps[steps.length - 1];
    const lastValue = last ? row[last.step] : 0;
    row.total = pos + neg;
    row.maxEnd = pos;
    row.minEnd = neg;
    row.lastValue = lastValue;
    // Where the last segment ends under sign stacking.
    row.lastEnd = lastValue >= 0 ? pos : neg;
    return row;
  });
  const maxEnd = Math.max(0, ...data.map((r) => r.maxEnd));
  const minEnd = Math.min(0, ...data.map((r) => r.minEnd));
  // The axis ends on a round tick; the chart margins hold the total labels.
  const ticks = getNiceTicks([minEnd, maxEnd], 4);
  const domain = getTickDomain(ticks);

  return (
    <>
      <div className="h-[220px] w-full">
        <ResponsiveContainer>
          <BarChart
            data={data}
            layout="vertical"
            stackOffset="sign"
            barCategoryGap="28%"
            margin={{ top: 5, right: 64, bottom: 5, left: minEnd < 0 ? 64 : 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke={colors.border.light} horizontal={false} />
            <XAxis
              type="number"
              domain={domain}
              ticks={ticks}
              tick={AXIS_STYLE}
              tickFormatter={(v) => formatSignedBn(v, getTickDecimals(ticks))}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              type="category"
              dataKey="case"
              width={108}
              tick={<CaseTick />}
              tickLine={false}
              axisLine={false}
            />
            <ReferenceLine x={0} stroke={colors.gray[400]} />
            <Tooltip {...TOOLTIP_PROPS} content={<YieldTooltip steps={steps} />} />
            {steps.map((step, i) => {
              const style = styleFor(step, i);
              const isLast = i === steps.length - 1;
              return (
                <Bar
                  key={step.step}
                  dataKey={step.step}
                  name={step.label}
                  stackId="yield"
                  fill={style.fill}
                  radius={isLast ? [0, 6, 6, 0] : 0}
                  isAnimationActive={false}
                >
                  <LabelList
                    dataKey={step.step}
                    content={<SegmentLabel textColor={style.text} />}
                  />
                  {isLast && <LabelList dataKey="total" content={<TotalLabel data={data} />} />}
                </Bar>
              );
            })}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <ChartLegend
        items={steps.map((step, i) => ({ label: styleFor(step, i).short, fill: styleFor(step, i).fill }))}
      />
      <ChartLogo />
    </>
  );
}
