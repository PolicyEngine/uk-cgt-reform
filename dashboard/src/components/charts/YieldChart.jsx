"use client";

import { useEffect, useRef, useState } from "react";
import {
  Bar,
  BarChart,
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

const AXIS_STYLE = { fontSize: 12, fill: colors.gray[500] };
const fmt = (v) => formatSignedBn(v, 1);

// One colour, short name and label colour per reform step, in stacking order.
// Steps the pipeline adds later fall back to the extra colours below.
const STEP_STYLE = {
  main_rates: { short: "Income tax rates on other gains", fill: colors.primary[700], text: "#FFFFFF" },
  residential: { short: "Income tax rates on residential property", fill: colors.primary[300], text: colors.gray[900] },
  badr_withdrawn: { short: "Relief withdrawn", fill: colors.gray[400], text: colors.gray[900] },
  badr_changed: { short: "Relief changed", fill: colors.gray[400], text: colors.gray[900] },
};
const FALLBACK_FILLS = [colors.primary[500], colors.gray[600], colors.primary[100]];

// The precomputed results' two bars; a live run passes its own (lib/yieldSplit).
const DEFAULT_CASES = [
  { key: "static", label: ["No behavioural", "response"] },
  { key: "central", label: ["CenTax central", "elasticity"] },
];

// A segment's value is printed inside it only when it is wide enough to hold
// the text; narrow segments are read from the tooltip.
const MIN_LABEL_PX = 46;

// `names` overrides a step's short name (a live schedule's own rates).
function styleFor(step, index, names = {}) {
  const style = STEP_STYLE[step.step] ?? {
    short: step.label,
    fill: FALLBACK_FILLS[index % FALLBACK_FILLS.length],
    text: colors.gray[900],
  };
  return names[step.step] ? { ...style, short: names[step.step] } : style;
}

// On a narrow screen the axis is dropped and each bar's name sits on one
// line above it, from the chart's left edge (`above`: px from the band's
// centre to the bar's top).
function CaseTick({ x, y, payload, cases, above }) {
  const lines = cases.find((c) => c.key === payload.value)?.label ?? [payload.value];
  if (above) {
    return (
      <text
        x={0}
        y={y - above - 6}
        textAnchor="start"
        fontSize={12}
        fill={colors.gray[700]}
        stroke="#FFFFFF"
        strokeWidth={4}
        paintOrder="stroke"
      >
        {lines.join(" ")}
      </text>
    );
  }
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

function YieldTooltip({ active, payload, label, steps, cases, names }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  const caseLabel = cases.find((c) => c.key === label)?.label.join(" ") ?? label;
  return (
    <TooltipCard
      title={caseLabel}
      rows={steps.map((step, i) => ({
        label: styleFor(step, i, names).short,
        value: fmt(row[step.step]),
        color: styleFor(step, i, names).fill,
      }))}
      footer={{ label: "Total", value: fmt(row.total) }}
    />
  );
}

// Where one year's yield comes from (schedule_split.year): each reform step's increment, stacked,
// with no behavioural response and at the CenTax central elasticity.
// `steps` is the pipeline's schedule_split.steps; `cases` the bars, top first
// (default: those two); `names` short names for the steps.
export default function YieldChart({ steps, cases = DEFAULT_CASES, names = {} }) {
  const wrap = useRef(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = wrap.current;
    if (!el || typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const narrow = width > 0 && width < 560;
  const data = cases.map(({ key }) => {
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
  const margin = { top: narrow ? 22 : 5, right: 64, bottom: 5, left: minEnd < 0 ? 64 : narrow ? 20 : 0 };
  const height = (narrow ? 90 : 80) + (narrow ? 84 : 70) * cases.length;
  // Half a bar's thickness: the plot's band per case less the category gaps.
  const band = (height - margin.top - margin.bottom - 30) / cases.length;
  const above = narrow ? (band * (1 - 2 * 0.28)) / 2 : 0;

  return (
    <>
      <div ref={wrap} className="w-full" style={{ height }}>
        <ResponsiveContainer>
          <BarChart
            data={data}
            layout="vertical"
            stackOffset="sign"
            barCategoryGap="28%"
            margin={margin}
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
              width={narrow ? 1 : 124}
              tick={<CaseTick cases={cases} above={above} />}
              tickLine={false}
              axisLine={false}
            />
            <ReferenceLine x={0} stroke={colors.gray[400]} />
            <Tooltip {...TOOLTIP_PROPS} content={<YieldTooltip steps={steps} cases={cases} names={names} />} />
            {steps.map((step, i) => {
              const style = styleFor(step, i, names);
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
        items={steps.map((step, i) => {
          const style = styleFor(step, i, names);
          return { label: style.short, fill: style.fill };
        })}
      />
      <ChartLogo />
    </>
  );
}
