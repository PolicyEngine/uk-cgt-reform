"use client";

import { ReferenceLine } from "recharts";
import { getNiceTicks, getTickDecimals } from "../../lib/chartUtils";
import { colors } from "../../lib/colors";
import { formatSignedBn } from "../../lib/formatters";

// The pieces the two charts drawn against the retention elasticity share
// (the sensitivity curve and the yield by schedule): the x-axis, its title,
// the marked elasticities and the y-axis ticks.

export const X_MAX = 4;
export const AXIS_STYLE = { fontSize: 12, fill: colors.gray[500] };
const GUIDE = colors.gray[400];

// The marked elasticities, each a vertical line with a short label. Labels
// sit in rows above the plot, alternating left to right, so neighbours
// never share a row: 0.5 and 1.0 are 0.5 apart, which is about 35px on a
// phone. On a narrow chart CenTax's three labels take a row each. The
// central value's line is solid and darker.
const MARKS = [
  { e: 0.5, label: "CenTax lower", row: 0, narrowRow: 0 },
  { e: 1.0, label: "CenTax central", row: 1, narrowRow: 1 },
  { e: 2.0, label: "CenTax upper", row: 0, narrowRow: 2 },
  { e: 3.0, label: "", row: 1, narrowRow: 0 },
  { e: 3.6, label: "HMRC/OBR", row: 0, narrowRow: 1 },
];
const ROW_HEIGHT = 16;
// Below this chart width the labels take three rows.
const NARROW = 640;

// The layout at one chart width: the marks with their label rows, whether
// the chart is narrow, and the margins that hold the labels and the title.
export function elasticityLayout(chartWidth, centralRetention) {
  const narrow = chartWidth > 0 && chartWidth < NARROW;
  const marks = MARKS.map((m) => ({
    ...m,
    row: narrow ? m.narrowRow : m.row,
    central: Number(m.e) === Number(centralRetention),
  }));
  const rowCount = Math.max(...marks.map((m) => m.row)) + 1;
  return {
    narrow,
    marks,
    margin: { top: rowCount * ROW_HEIGHT + 10, right: 14, bottom: narrow ? 46 : 32, left: 0 },
  };
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

// The vertical lines, as an array of Recharts children.
export function markLines(marks, chartWidth) {
  return marks.map((mark) => (
    <ReferenceLine
      key={`mark-${mark.e}`}
      x={mark.e}
      stroke={mark.central ? colors.gray[800] : GUIDE}
      strokeWidth={mark.central ? 1.5 : 1}
      strokeDasharray={mark.central ? undefined : "4 3"}
      label={<MarkLabel mark={mark} chartWidth={chartWidth} />}
    />
  ));
}

// The x-axis title and, under it, what the elasticity measures.
const AXIS_SUBTITLE = ["how much taxpayers cut realised gains", "as their after-tax share falls"];

export function AxisTitle({ viewBox, narrow }) {
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

// The x-axis props: 0.0 to 4.0, ticks at whole numbers.
export function xAxisProps(narrow) {
  return {
    type: "number",
    dataKey: "elasticity",
    domain: [0, X_MAX],
    ticks: [0, 1, 2, 3, 4],
    tick: AXIS_STYLE,
    tickFormatter: (v) => v.toFixed(1),
    tickLine: false,
    axisLine: { stroke: colors.border.medium },
    label: <AxisTitle narrow={narrow} />,
  };
}

// The y-axis props in £bn: round ticks, with one more step past an end that
// a value comes close to, so nothing sits on the plot's edge.
export function yAxisProps(lo, hi) {
  const nice = getNiceTicks([Math.min(0, lo), Math.max(0, hi)], 6);
  const step = nice[1] - nice[0];
  const ticks = [
    ...(lo < 0 && lo - nice[0] < 0.25 * step ? [nice[0] - step] : []),
    ...nice,
    ...(hi > 0 && nice.at(-1) - hi < 0.25 * step ? [nice.at(-1) + step] : []),
  ];
  return {
    domain: [ticks[0], ticks.at(-1)],
    ticks,
    width: 56,
    tick: AXIS_STYLE,
    tickFormatter: (v) => formatSignedBn(v, getTickDecimals(ticks)),
    tickLine: false,
    axisLine: false,
  };
}
