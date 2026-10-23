"use client";

import { getNiceTicks, getTickDomain } from "../../lib/chartUtils";
import { colors } from "../../lib/colors";
import { formatBn } from "../../lib/formatters";
import ChartLogo from "../ChartLogo";
import ChartLegend from "./ChartLegend";
import { HoverTip, useHoverState } from "./ChartTooltip";

// The three estimates compared each year, as dots on one £bn line: the
// model's own static change, the model's uplift applied to the OBR's
// receipts (JRF's method), and JRF's published figure as a diamond.
const SERIES = [
  { key: "static", fill: colors.primary[600], text: colors.primary[700], size: 14, marker: "dot" },
  { key: "obr", fill: colors.primary[300], text: colors.primary[700], size: 12, marker: "dot" },
  { key: "jrf", fill: colors.gray[800], text: colors.gray[800], size: 11, marker: "diamond" },
];

// Year, the three values, then the dot strip; a row stacks below `md`.
const GRID = "md:grid-cols-[4.5rem_repeat(3,6.5rem)_minmax(0,1fr)] md:gap-x-5";

// Column headings; the legend below names each series in full.
const SHORT = { static: "Static", obr: "On OBR receipts", jrf: "JRF" };

const isNum = (v) => v !== null && v !== undefined && Number.isFinite(Number(v));

// "Around £13bn." → "around £13bn": JRF's own wording, from the results file.
function jrfText(note, value) {
  const text = (note ?? "").trim().replace(/\.$/, "");
  return text ? `${text[0].toLowerCase()}${text.slice(1)}` : formatBn(value, 0);
}

// The props from the results file's `benchmarks.static_equalisation` block.
// A JRF year outside the modelled window (2026-27) keeps its own row, with
// no PolicyEngine values.
export function buildJrfRows(block) {
  const jrf = Object.fromEntries(block.external.map((row) => [row.year, row]));
  const model = Object.fromEntries(block.by_year.map((row) => [row.year, row]));
  const years = [...new Set([...Object.keys(jrf), ...Object.keys(model)])].sort();
  return years.map((year) => ({
    year,
    static: model[year]?.static_cgt_change_real_bn ?? null,
    obr: model[year]?.uplift_on_obr_receipts_real_bn ?? null,
    jrf: jrf[year]?.value ?? null,
    jrfLabel: jrf[year] ? jrfText(jrf[year].note, jrf[year].value) : null,
  }));
}

const textFor = (row, key) => (key === "jrf" ? row.jrfLabel : formatBn(row[key], 1));

// One marker on the strip; hovering or focusing it shows the year and its
// value, one marker per chart at a time (`hover`).
function Marker({ id, hover, series, left, title, label, value }) {
  return (
    <HoverTip
      id={id}
      hover={hover}
      title={title}
      label={label}
      value={value}
      color={series.fill}
      align={left > 60 ? "end" : left < 40 ? "start" : "center"}
      className={`absolute top-1/2 -translate-x-1/2 -translate-y-1/2 ${series.key === "static" ? "z-[2]" : "z-[1]"}`}
      style={{ left: `${left}%` }}
    >
      <span
        aria-hidden="true"
        className="block"
        style={{
          width: series.size,
          height: series.size,
          background: series.fill,
          borderRadius: series.marker === "dot" ? "9999px" : 2,
          transform: series.marker === "diamond" ? "rotate(45deg)" : undefined,
          border: "1.5px solid #FFFFFF",
        }}
      />
    </HoverTip>
  );
}

// Each year's static change in 2026/27 prices: the model's own figure, the
// model's uplift applied to the OBR's receipts, and JRF's estimate where it
// published one. `rows`: buildJrfRows(block); `labels`: { static, obr, jrf }.
export default function JrfComparisonChart({ rows, labels }) {
  const hover = useHoverState();
  const max = Math.max(0, ...rows.flatMap((r) => SERIES.map((s) => r[s.key]).filter(isNum).map(Number)));
  const ticks = getNiceTicks([0, max], 4);
  const [, top] = getTickDomain(ticks);
  const left = (v) => Math.min(100, Math.max(0, (100 * v) / (top || 1)));
  return (
    <>
      <div
        aria-hidden="true"
        className={`hidden items-end gap-x-3 border-b border-slate-200 pb-2 text-xs font-semibold text-slate-500 md:grid ${GRID}`}
      >
        <span>Year</span>
        {SERIES.map((s) => (
          <span key={s.key} className="text-right leading-snug">
            {SHORT[s.key]}
          </span>
        ))}
        <span className="relative h-4">
          {ticks.map((t, i) => (
            <span
              key={t}
              className={`absolute font-normal ${i === 0 ? "" : i === ticks.length - 1 ? "-translate-x-full" : "-translate-x-1/2"}`}
              style={{ left: `${left(t)}%` }}
            >
              {formatBn(t, 0)}
            </span>
          ))}
        </span>
      </div>
      <ul>
        {rows.map((row) => {
          const summary = SERIES.filter((s) => isNum(row[s.key]))
            .map((s) => `${labels[s.key]} ${textFor(row, s.key)}`)
            .join(", ");
          return (
            <li
              key={row.year}
              className={`grid grid-cols-3 items-center gap-x-3 gap-y-1.5 border-b border-slate-100 py-3 last:border-b-0 ${GRID}`}
            >
              <span className="col-span-3 text-sm font-semibold text-slate-800 md:col-span-1">{row.year}</span>
              {SERIES.map((s) => (
                <span
                  key={s.key}
                  className="text-sm tabular-nums md:text-right"
                  style={{ color: s.text, fontWeight: s.key === "static" ? 700 : 500 }}
                >
                  <span className="block text-[10px] font-medium uppercase tracking-wide text-slate-400 md:hidden">
                    {SHORT[s.key]}
                  </span>
                  {isNum(row[s.key]) ? textFor(row, s.key) : "—"}
                </span>
              ))}
              <div className="relative col-span-3 h-5 md:col-span-1" role="img" aria-label={`${row.year}: ${summary}`}>
                <span aria-hidden="true" className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-slate-200" />
                {ticks.map((t) => (
                  <span
                    key={t}
                    aria-hidden="true"
                    className="absolute top-0 h-full border-l border-dashed border-slate-200"
                    style={{ left: `${left(t)}%` }}
                  />
                ))}
                {SERIES.map((s) =>
                  isNum(row[s.key]) ? (
                    <Marker
                      key={s.key}
                      id={`${row.year}-${s.key}`}
                      hover={hover}
                      series={s}
                      left={left(Number(row[s.key]))}
                      title={row.year}
                      label={labels[s.key]}
                      value={textFor(row, s.key)}
                    />
                  ) : null,
                )}
              </div>
            </li>
          );
        })}
      </ul>
      <ChartLegend
        items={SERIES.map((s) => ({ label: labels[s.key], fill: s.fill, marker: s.marker }))}
      />
      <ChartLogo />
    </>
  );
}
