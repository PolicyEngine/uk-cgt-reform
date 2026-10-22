"use client";

import { colors } from "../../lib/colors";
import { formatBn, formatCount, formatPct } from "../../lib/formatters";
import ChartLogo from "../ChartLogo";

// The two estimates compared on each row, drawn as dots on one line: the
// model filled teal and HMRC's latest (provisional) year a smaller grey dot,
// so overlapping dots stay distinguishable.
const SERIES = [
  { key: "model", color: colors.primary[600], text: colors.primary[700], ring: false, size: 14 },
  { key: "hmrc2024", label: "HMRC, 2024-25 (provisional)", color: colors.gray[600], text: colors.gray[700], ring: false, size: 10 },
];

// How each unit's values read. Values arrive in their natural unit:
// "bn" in £bn, "count" in people, "pct" in percent (0–100).
const FORMATS = {
  bn: (v) => formatBn(v, 1),
  count: (v) => formatCount(v),
  pct: (v) => formatPct(v, 0),
};

// A published figure as the table prints it ("£66.6bn", "382k", "61%") read
// back into the row's natural unit: £bn, people or percent.
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

function Dot({ series, left }) {
  return (
    <span
      aria-hidden="true"
      className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
      style={{
        left: `${left}%`,
        width: series.size,
        height: series.size,
        background: series.ring ? "#FFFFFF" : series.color,
        border: `2px solid ${series.color}`,
        zIndex: series.key === "model" ? 2 : 1,
      }}
    />
  );
}

// Columns: quantity, the three values, the gap to HMRC's latest year, and
// the dot strip (0 at the left). Below `md` a row stacks.
const GRID = "md:grid-cols-[minmax(0,13rem)_repeat(2,6rem)_5rem_minmax(0,1fr)]";

function gapToLatest(row) {
  if (!Number.isFinite(row.model) || !Number.isFinite(row.hmrc2024) || row.hmrc2024 === 0) return null;
  // Shares compare in points; everything else as a percentage difference.
  if (row.unit === "pct") {
    const pp = Math.round(row.model - row.hmrc2024);
    return `${pp > 0 ? "+" : pp < 0 ? "−" : ""}${Math.abs(pp)} pp`;
  }
  const rel = Math.round(100 * (row.model / row.hmrc2024 - 1));
  return `${rel > 0 ? "+" : rel < 0 ? "−" : ""}${Math.abs(rel)}%`;
}

function Row({ row, seriesLabels }) {
  const format = FORMATS[row.unit] ?? ((v) => String(v));
  const values = SERIES.map((s) => row[s.key]).filter(Number.isFinite);
  // Shares sit on 0–100%; other rows scale to their largest value.
  const max = row.unit === "pct" ? 100 : Math.max(...values) * 1.1 || 1;
  const left = (v) => Math.min(100, Math.max(0, (100 * v) / max));
  const summary = SERIES.filter((s) => Number.isFinite(row[s.key]))
    .map((s) => `${seriesLabels[s.key]} ${format(row[s.key])}`)
    .join(", ");
  const gap = gapToLatest(row);
  return (
    <li className={`grid grid-cols-2 items-center gap-x-3 gap-y-1.5 border-t border-slate-100 py-3 ${GRID}`}>
      <span className="col-span-2 text-sm font-medium text-slate-800 md:col-span-1">{row.label}</span>
      {SERIES.map((s) => (
        <span key={s.key} className="text-sm tabular-nums md:text-right" style={{ color: s.text, fontWeight: s.key === "model" ? 700 : 500 }}>
          <span className="block text-[10px] font-medium uppercase tracking-wide text-slate-400 md:hidden">
            {s.key === "model" ? "PolicyEngine" : "HMRC 2024-25"}
          </span>
          {Number.isFinite(row[s.key]) ? format(row[s.key]) : "—"}
        </span>
      ))}
      <span className="hidden text-right md:block">
        {gap ? (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold tabular-nums text-slate-700">{gap}</span>
        ) : null}
      </span>
      <div className="relative col-span-2 h-5 md:col-span-1" role="img" aria-label={`${row.label}: ${summary}`}>
        <span aria-hidden="true" className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-slate-200" />
        <span aria-hidden="true" className="absolute left-0 top-1/2 h-2 w-px -translate-y-1/2 bg-slate-300" />
        {SERIES.map((s) =>
          Number.isFinite(row[s.key]) ? <Dot key={s.key} series={s} left={left(row[s.key])} /> : null,
        )}
      </div>
    </li>
  );
}

// The model's baseline against HMRC's published years, one row per quantity,
// each on its own scale, under group headings. `rows`: [{ key, label, group?,
// unit: "bn" | "count" | "pct", model, hmrc2024 }]; `modelLabel`
// names the model series. The gap column compares the model with HMRC's
// latest year (in points for shares).
export default function BenchmarkChart({ rows, modelLabel }) {
  const seriesLabels = { model: modelLabel, hmrc2024: SERIES[1].label };
  // Rows sharing a `group` sit under one heading, in the order given.
  const groups = [];
  for (const row of rows) {
    const name = row.group ?? "";
    const last = groups.at(-1);
    if (last && last[0] === name) last[1].push(row);
    else groups.push([name, [row]]);
  }
  return (
    <>
      <div
        aria-hidden="true"
        className={`hidden gap-x-3 border-b border-slate-200 pb-2 text-xs font-semibold text-slate-500 md:grid ${GRID}`}
      >
        <span>Quantity</span>
        <span className="text-right">PolicyEngine</span>
        <span className="text-right">HMRC 2024-25</span>
        <span className="text-right">Difference</span>
        <span>On one scale, from 0</span>
      </div>
      {groups.map(([group, groupRows]) => (
        <section key={group} className="mt-4 first:mt-2">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-[color:var(--pe-color-primary-700)]">{group}</h4>
          <ul>
            {groupRows.map((row) => (
              <Row key={row.key} row={row} seriesLabels={seriesLabels} />
            ))}
          </ul>
        </section>
      ))}
      <ul className="mt-3 flex flex-wrap justify-center gap-x-5 gap-y-1 text-xs text-slate-600">
        {SERIES.map((s) => (
          <li key={s.key} className="flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="inline-block rounded-full"
              style={{
                width: 10,
                height: 10,
                background: s.ring ? "#FFFFFF" : s.color,
                border: `2px solid ${s.color}`,
              }}
            />
            {seriesLabels[s.key]}
          </li>
        ))}
      </ul>
      <ChartLogo />
    </>
  );
}
