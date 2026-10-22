"use client";

import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { colors } from "../../lib/colors";
import { formatBn, formatCount, formatPct } from "../../lib/formatters";
import ChartLogo from "../ChartLogo";

// The three columns of the benchmark table, in the table's order.
const SERIES = [
  { key: "model", fill: colors.primary[600], text: colors.primary[700], weight: 700 },
  { key: "hmrc2023", label: "HMRC, 2023-24 (revised)", fill: colors.gray[300], text: colors.gray[600], weight: 500 },
  { key: "hmrc2024", label: "HMRC, 2024-25 (provisional)", fill: colors.gray[500], text: colors.gray[700], weight: 500 },
];

// How each unit's values read on a bar. Values arrive in their natural unit:
// "bn" in £bn, "count" in people, "pct" in percent (0–100).
const FORMATS = {
  bn: (v) => formatBn(v, 1),
  count: (v) => formatCount(v),
  pct: (v) => formatPct(v, 0),
};

const BAR_SIZE = 18;
const PANEL_HEIGHT = 3 * BAR_SIZE + 2 * 8 + 8;

// A published figure as the table prints it ("£66.6bn", "382k", "61%") read
// back into the panel's natural unit: £bn, people or percent.
export function parseBenchmark(text) {
  if (text === null || text === undefined) return null;
  const s = String(text).replace(/[£,\s]/g, "");
  const n = parseFloat(s);
  if (!Number.isFinite(n)) return null;
  if (/bn$/i.test(s) || /%$/.test(s)) return n;
  if (/m$/i.test(s)) return n * 1e6;
  if (/k$/i.test(s)) return n * 1e3;
  return n;
}

function ValueLabel({ x, y, width, height, index, data, format }) {
  const d = data[index];
  if (!d || !Number.isFinite(d.value)) return null;
  const s = SERIES[index];
  return (
    <text
      x={x + Math.max(width, 0) + 6}
      y={y + height / 2}
      textAnchor="start"
      dominantBaseline="central"
      pointerEvents="none"
      fontSize={12}
      fontWeight={s.weight}
      fill={s.text}
    >
      {format(d.value)}
    </text>
  );
}

function PanelTooltip({ active, payload, format }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs shadow-sm">
      <p className="font-semibold text-slate-900">{d.label}</p>
      <p className="mt-0.5 tabular-nums text-slate-700">{Number.isFinite(d.value) ? format(d.value) : "—"}</p>
    </div>
  );
}

function Panel({ row, labels }) {
  const format = FORMATS[row.unit] ?? ((v) => String(v));
  const data = SERIES.map((s) => {
    const raw = row[s.key];
    const value = raw === null || raw === undefined ? NaN : Number(raw);
    return { key: s.key, label: labels[s.key], value: Number.isFinite(value) ? value : NaN };
  });
  const values = data.map((d) => d.value).filter(Number.isFinite);
  // Shares sit on a full 0–100% scale; levels on their own, with room past
  // the longest bar for its label.
  const max = row.unit === "pct" ? 100 : Math.max(...values, 0) * 1.32 || 1;
  const summary = `${row.label}: ${data
    .map((d) => `${d.label} ${Number.isFinite(d.value) ? format(d.value) : "not available"}`)
    .join("; ")}`;
  return (
    <div role="listitem" aria-label={summary} className="rounded-lg border border-slate-100 bg-white px-3 pb-2 pt-3">
      <p className="text-sm font-semibold sm:min-h-[2.5rem] leading-5 text-slate-800">{row.label}</p>
      <div aria-hidden="true" style={{ height: PANEL_HEIGHT }} className="w-full">
        <ResponsiveContainer>
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 4, bottom: 4, left: 0 }} barCategoryGap={4}>
            <XAxis type="number" domain={[0, max]} hide />
            <YAxis type="category" dataKey="key" hide />
            <Tooltip cursor={{ fill: colors.gray[100] }} content={<PanelTooltip format={format} />} />
            <Bar dataKey="value" barSize={BAR_SIZE} radius={[0, 4, 4, 0]} isAnimationActive={false}>
              {data.map((d, i) => (
                <Cell key={d.key} fill={SERIES[i].fill} />
              ))}
              <LabelList dataKey="value" content={<ValueLabel data={data} format={format} />} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// The model's baseline beside HMRC's published figures, as small multiples:
// one panel per quantity, each on its own scale, the three sources as bars.
//
// Props:
//   rows: [{ key, label, unit: "bn" | "count" | "pct", model, hmrc2023, hmrc2024 }]
//     values in the unit's natural scale (£bn, people, percent 0–100);
//     a null value draws no bar.
//   modelLabel: legend text for the PolicyEngine series.
export default function BenchmarkChart({ rows, modelLabel = "PolicyEngine" }) {
  const labels = { model: modelLabel, hmrc2023: SERIES[1].label, hmrc2024: SERIES[2].label };
  return (
    <>
      <ul className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
        {SERIES.map((s) => (
          <li key={s.key} className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded-sm" style={{ background: s.fill }} />
            {labels[s.key]}
          </li>
        ))}
      </ul>
      <div
        role="list"
        aria-label="PolicyEngine baseline against HMRC statistics"
        className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
      >
        {rows.map((row) => (
          <Panel key={row.key} row={row} labels={labels} />
        ))}
      </div>
      <ChartLogo />
    </>
  );
}
