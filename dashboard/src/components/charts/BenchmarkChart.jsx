"use client";

import { colors } from "../../lib/colors";
import { formatBn, formatCount, formatPct } from "../../lib/formatters";
import ChartLogo from "../ChartLogo";
import ChartLegend from "./ChartLegend";
import { HoverTip, useHoverState } from "./ChartTooltip";

// The two estimates compared on each row, drawn as a dumbbell on one line,
// styled as RegionalComparisonChart's: the model a teal dot, HMRC's latest
// (provisional) year a grey dot drawn under it, so teal shows when they
// meet, joined by a grey connector.
const DOT_R = 5;
const SERIES = [
  { key: "model", color: colors.primary[600], text: colors.primary[700] },
  { key: "hmrc2024", label: "HMRC, 2024-25 (provisional)", color: colors.gray[400], text: colors.gray[600] },
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

// One dot on the strip; hovering or focusing it shows the row and its
// series' value (`lines`), one dot per chart at a time (`hover`).
function Dot({ id, hover, series, left, title, lines }) {
  return (
    <HoverTip
      id={id}
      hover={hover}
      title={title}
      rows={lines}
      align={left > 60 ? "end" : left < 40 ? "start" : "center"}
      className={`absolute top-1/2 -translate-x-1/2 -translate-y-1/2 ${series.key === "model" ? "z-[2]" : "z-[1]"}`}
      style={{ left: `${left}%` }}
    >
      <span
        aria-hidden="true"
        className="block rounded-full"
        style={{
          // An r=5 circle with a 1px white stroke, as in the regional chart.
          width: 2 * DOT_R + 1,
          height: 2 * DOT_R + 1,
          background: series.color,
          border: "1px solid #FFFFFF",
        }}
      />
    </HoverTip>
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

function Row({ row, seriesLabels, hover }) {
  const format = FORMATS[row.unit] ?? ((v) => String(v));
  const values = SERIES.map((s) => row[s.key]).filter(Number.isFinite);
  // Shares sit on 0–100%; other rows scale to their largest value.
  const max = row.unit === "pct" ? 100 : Math.max(...values) * 1.1 || 1;
  const left = (v) => Math.min(100, Math.max(0, (100 * v) / max));
  const summary = SERIES.filter((s) => Number.isFinite(row[s.key]))
    .map((s) => `${seriesLabels[s.key]} ${format(row[s.key])}`)
    .join(", ");
  const gap = gapToLatest(row);
  // Where the dots overlap, HMRC's sits under the teal one and cannot be
  // hovered, so the teal dot's tooltip names both values.
  const overlap =
    Number.isFinite(row.model) && Number.isFinite(row.hmrc2024) && Math.abs(left(row.model) - left(row.hmrc2024)) < 3;
  const line = (s) => ({ label: seriesLabels[s.key], value: format(row[s.key]), color: s.color });
  const dotLines = (s) => (overlap && s.key === "model" ? [line(SERIES[0]), line(SERIES[1])] : [line(s)]);
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
        {Number.isFinite(row.model) && Number.isFinite(row.hmrc2024) ? (
          <span
            aria-hidden="true"
            className="absolute top-1/2 -translate-y-1/2"
            style={{
              left: `${Math.min(left(row.model), left(row.hmrc2024))}%`,
              width: `${Math.abs(left(row.model) - left(row.hmrc2024))}%`,
              height: 2,
              background: colors.gray[300],
            }}
          />
        ) : null}
        {/* HMRC under PolicyEngine, so the teal dot shows when they meet. */}
        {[SERIES[1], SERIES[0]].map((s) =>
          Number.isFinite(row[s.key]) ? (
            <Dot
              key={s.key}
              id={`${row.key}-${s.key}`}
              hover={hover}
              series={s}
              left={left(row[s.key])}
              title={row.label}
              lines={dotLines(s)}
            />
          ) : null,
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
  const hover = useHoverState();
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
              <Row key={row.key} row={row} seriesLabels={seriesLabels} hover={hover} />
            ))}
          </ul>
        </section>
      ))}
      <ChartLegend items={SERIES.map((s) => ({ label: seriesLabels[s.key], fill: s.color, marker: "dot" }))} />
      <ChartLogo />
    </>
  );
}
