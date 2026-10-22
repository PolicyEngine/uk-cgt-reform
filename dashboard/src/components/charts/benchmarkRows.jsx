"use client";

import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { colors } from "../../lib/colors";

// Shared parts of the Benchmarks tab's row charts: each item is one row with
// its label above and a small horizontal bar chart below, and every row uses
// the same scale and the same horizontal margins, so bars line up down the
// column under one axis drawn at the top.

export const AXIS_STYLE = { fontSize: 12, fill: colors.gray[500] };

// The legend sits above the chart, as in the other charts. `marker` is
// "bar" (a square), "dot" or "diamond".
export function SeriesLegend({ items }) {
  return (
    <ul className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-1.5">
          <LegendMarker {...item} />
          {item.label}
        </li>
      ))}
    </ul>
  );
}

function LegendMarker({ marker = "bar", fill, opacity, stroke, dashed }) {
  if (marker === "dot") {
    return <span className="inline-block h-3 w-3 rounded-full" style={{ background: fill }} />;
  }
  if (marker === "diamond") {
    return (
      <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
        <path d="M6 0.5 L11.5 6 L6 11.5 L0.5 6 Z" fill={fill} />
      </svg>
    );
  }
  return (
    <span
      className="inline-block h-3 w-3 rounded-sm"
      style={{
        background: fill,
        opacity,
        border: stroke ? `1.5px ${dashed ? "dashed" : "solid"} ${stroke}` : undefined,
      }}
    />
  );
}

// The shared axis, drawn once above the rows with the rows' margins. Its one
// dummy value sits at the domain's start, so a domain that does not include
// zero is not stretched to reach it.
export function RowAxis({ domain, ticks, format, margin }) {
  return (
    <div className="h-[26px] w-full" aria-hidden="true">
      <ResponsiveContainer>
        <BarChart data={[{ v: domain[0] }]} layout="vertical" margin={{ ...margin, top: 0, bottom: 0 }}>
          <XAxis
            type="number"
            domain={domain}
            ticks={ticks}
            tick={AXIS_STYLE}
            tickFormatter={format}
            tickLine={false}
            axisLine={false}
            orientation="top"
            height={22}
            interval={0}
          />
          <YAxis type="category" hide />
          <Bar dataKey="v" shape={() => null} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// A bar's two ends in pixels, whichever way Recharts reports a negative bar.
export function barEnds(x, width) {
  return [Math.min(x, x + width), Math.max(x, x + width)];
}

// A plain bar that may point either way from the origin, with rounded outer
// corners only. Draws nothing for a missing value.
export function SignedBar({ x, y, width, height, fill, fillOpacity, stroke, strokeDasharray, payload }) {
  if (!payload?.hasValue) return null;
  const [left, right] = barEnds(x, width);
  const w = Math.max(right - left, 1);
  return (
    <rect
      x={left}
      y={y}
      width={w}
      height={height}
      rx={Math.min(3, w / 2)}
      fill={fill}
      fillOpacity={fillOpacity}
      stroke={stroke}
      strokeWidth={stroke ? 1.5 : 0}
      strokeDasharray={strokeDasharray}
    />
  );
}

// The value past the end of a bar, on the side the bar points to.
export function EndLabel({ x, y, width, height, value, text, color, weight = 600 }) {
  if (text === null || text === undefined) return null;
  const [left, right] = barEnds(x, width);
  const negative = Number(value) < 0;
  return (
    <text
      x={negative ? left - 6 : right + 6}
      y={y + height / 2}
      textAnchor={negative ? "end" : "start"}
      dominantBaseline="central"
      pointerEvents="none"
      fontSize={12}
      fontWeight={weight}
      fill={color}
      style={{ fontVariantNumeric: "tabular-nums" }}
    >
      {text}
    </text>
  );
}

// The height of a row chart holding `n` bars.
export function rowHeight(n, barSize, gap) {
  return n * barSize + Math.max(n - 1, 0) * gap + 4;
}
