"use client";

import { useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ReferenceLine, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { getNiceTicks, getTickDomain } from "../../lib/chartUtils";
import { colors } from "../../lib/colors";
import { formatSignedMn } from "../../lib/formatters";
import ChartLogo from "../ChartLogo";
import ChartLegend from "./ChartLegend";
import { LabelledSelect } from "../controls";
import { EndLabel, RowAxis, SignedBar, rowHeight } from "./benchmarkRows";

// Both sides hold a value label: rows point either way from £0.
const MARGIN = { top: 2, right: 70, bottom: 2, left: 70 };
const BAR_SIZE = 14;
const GAP = 4;

const SERIES = {
  hmrc: { fill: colors.gray[700], text: colors.gray[800], weight: 700 },
  central: { fill: colors.primary[600], text: colors.primary[700], weight: 600 },
  official: { fill: colors.error, opacity: 0.45, text: "#B42318", weight: 600 },
};
const ORDER = ["hmrc", "central", "official"];

const isNum = (v) => v !== null && v !== undefined && Number.isFinite(Number(v));

// The props from the results file's `benchmarks.ready_reckoner` block: one
// entry per HMRC row, its three values for each receipts/liabilities pair.
export function buildReckonerRows(block, centralId = "centax_central", officialId = "official") {
  const pairs = block.lag.map((lag, i) => ({
    key: String(i),
    label: lag.hmrc_year,
    caption: `HMRC's receipts in ${lag.hmrc_year} against PolicyEngine's liabilities in ${lag.model_year}.`,
    hmrcYear: lag.hmrc_year,
    modelYear: lag.model_year,
  }));
  const rows = block.rows.map((row) => ({
    id: row.id,
    label: row.label,
    values: Object.fromEntries(
      block.lag.map((lag, i) => [
        String(i),
        {
          hmrc: row.hmrc_m[lag.hmrc_year],
          central: row.model_m[centralId]?.[lag.model_year],
          official: row.model_m[officialId]?.[lag.model_year],
        },
      ]),
    ),
  }));
  return { pairs, rows };
}

function RowChart({ values, domain, ticks }) {
  const data = ORDER.map((series) => ({
    series,
    hasValue: isNum(values[series]),
    value: isNum(values[series]) ? Number(values[series]) : 0,
  }));
  return (
    <div style={{ height: rowHeight(data.length, BAR_SIZE, GAP) }} className="w-full">
      <ResponsiveContainer>
        <BarChart data={data} layout="vertical" margin={MARGIN} barCategoryGap={GAP}>
          <XAxis type="number" domain={domain} ticks={ticks} hide />
          <YAxis type="category" dataKey="series" hide />
          <CartesianGrid strokeDasharray="3 3" stroke={colors.border.light} horizontal={false} />
          <Bar dataKey="value" barSize={BAR_SIZE} shape={<SignedBar />} isAnimationActive={false}>
            {data.map((d) => (
              <Cell key={d.series} fill={SERIES[d.series].fill} fillOpacity={SERIES[d.series].opacity ?? 1} />
            ))}
            <LabelList
              dataKey="value"
              content={(props) => {
                const d = data[props.index];
                if (!d?.hasValue) return null;
                const s = SERIES[d.series];
                return (
                  <EndLabel {...props} value={d.value} text={formatSignedMn(d.value)} color={s.text} weight={s.weight} />
                );
              }}
            />
          </Bar>
          <ReferenceLine x={0} stroke={colors.gray[500]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// HMRC's ready reckoner rows against the model at two elasticities, as
// diverging bars around £0 on one £m scale shared by every row and both
// year pairs (so switching pairs does not rescale). `pairs` and `rows` come
// from buildReckonerRows; `labels`: { hmrc, central, official } legend text.
export default function ReadyReckonerChart({ pairs, rows, labels }) {
  const [pair, setPair] = useState(pairs[0]?.key);
  const all = rows.flatMap((r) => Object.values(r.values).flatMap((v) => ORDER.map((s) => v[s]))).filter(isNum);
  const ticks = getNiceTicks([Math.min(0, ...all), Math.max(0, ...all)], 6);
  const domain = getTickDomain(ticks);
  const current = pairs.find((p) => p.key === pair) ?? pairs[0];
  // Gridlines at every tick, labels at every other one (counted from £0), so
  // they fit at phone width.
  const step = ticks.length > 1 ? ticks[1] - ticks[0] : 1;
  const tick = (v) => {
    if (Math.round(v / step) % 2 !== 0) return "";
    return v === 0 ? "£0" : `${v < 0 ? "\u2212" : ""}£${Math.abs(v / 1000)}bn`;
  };
  return (
    <>
      {pairs.length > 1 ? (
        <div className="mb-1 w-full max-w-xs">
          <LabelledSelect
            label="HMRC receipts year"
            options={pairs.map((p) => ({ value: p.key, label: p.label }))}
            value={current.key}
            onChange={setPair}
          />
        </div>
      ) : null}
      <p className="mb-4 text-xs leading-5 text-slate-500">{current.caption}</p>
      <RowAxis domain={domain} ticks={ticks} format={tick} margin={MARGIN} />
      <div role="list" aria-label={`Ready reckoner rows, ${current.label}`}>
        {rows.map((row) => {
          const v = row.values[current.key];
          return (
            <div
              key={row.id}
              role="listitem"
              aria-label={`${row.label}: ${ORDER.map((s) => `${labels[s]} ${formatSignedMn(v[s])}`).join(", ")}`}
              className="border-b border-slate-100 py-2 last:border-b-0"
            >
              <p className="text-sm font-semibold leading-5 text-slate-800">{row.label}</p>
              <div aria-hidden="true">
                <RowChart values={v} domain={domain} ticks={ticks} />
              </div>
            </div>
          );
        })}
      </div>
      <ChartLegend
        items={ORDER.map((s) => ({
          label: labels[s],
          fill: SERIES[s].fill,
          opacity: SERIES[s].opacity,
        }))}
      />
      <ChartLogo />
    </>
  );
}
