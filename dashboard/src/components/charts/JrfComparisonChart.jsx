"use client";

import { Bar, BarChart, CartesianGrid, Cell, LabelList, ReferenceLine, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { getNiceTicks, getTickDomain } from "../../lib/chartUtils";
import { colors } from "../../lib/colors";
import { formatBn, formatSignedBn } from "../../lib/formatters";
import ChartLogo from "../ChartLogo";
import { EndLabel, RowAxis, SeriesLegend, SignedBar, rowHeight } from "./benchmarkRows";

const MARGIN = { top: 2, right: 64, bottom: 2, left: 16 };
const YEAR_COL = "w-16 shrink-0";
const BAR_SIZE = 14;
const GAP = 3;

const SERIES = {
  static: { fill: colors.primary[600], text: colors.primary[700], weight: 700 },
  obr: { fill: colors.primary[300], text: colors.primary[700], weight: 600 },
  jrf: { fill: colors.gray[800], text: colors.gray[800], weight: 700 },
};

const isNum = (v) => v !== null && v !== undefined && Number.isFinite(Number(v));

// "About £13bn." → "about £13bn": JRF's own wording, from the results file.
function jrfText(note, value) {
  const text = (note ?? "").trim().replace(/\.$/, "");
  return text ? `${text[0].toLowerCase()}${text.slice(1)}` : `about ${formatBn(value, 0)}`;
}

// The props from the results file's `benchmarks.static_equalisation` block.
export function buildJrfRows(block) {
  const jrf = Object.fromEntries(block.external.map((row) => [row.year, row]));
  return block.by_year.map((row) => ({
    year: row.year,
    static: row.static_cgt_change_real_bn,
    obr: row.uplift_on_obr_receipts_real_bn,
    jrf: jrf[row.year]?.value ?? null,
    jrfLabel: jrf[row.year] ? jrfText(jrf[row.year].note, jrf[row.year].value) : null,
  }));
}

// JRF's figure is a point estimate: a thin stem from £0 and a diamond.
function JrfShape({ x, y, width, height, payload }) {
  if (!payload?.hasValue) return null;
  const end = x + width;
  const cy = y + height / 2;
  const r = height / 2 + 1;
  return (
    <g>
      <line x1={x} x2={end} y1={cy} y2={cy} stroke={colors.gray[500]} strokeWidth={1.5} />
      <path d={`M${end} ${cy - r} L${end + r} ${cy} L${end} ${cy + r} L${end - r} ${cy} Z`} fill={SERIES.jrf.fill} />
    </g>
  );
}

function BarShape(props) {
  return props.payload?.series === "jrf" ? <JrfShape {...props} /> : <SignedBar {...props} />;
}

function RowLabel({ data, ...props }) {
  const d = data[props.index];
  if (!d) return null;
  const style = SERIES[d.series];
  // The diamond overhangs the end of its stem.
  const shift = d.series === "jrf" ? BAR_SIZE / 2 + 3 : 0;
  return (
    <EndLabel
      {...props}
      width={props.width + shift}
      value={d.value}
      text={d.text}
      color={style.text}
      weight={style.weight}
    />
  );
}

function YearChart({ row, domain, ticks }) {
  const data = ["static", "obr", "jrf"]
    .filter((series) => isNum(row[series]))
    .map((series) => ({
      series,
      value: Number(row[series]),
      hasValue: true,
      text: series === "jrf" ? row.jrfLabel : formatSignedBn(row[series], 1),
    }));
  return (
    <div style={{ height: rowHeight(data.length, BAR_SIZE, GAP) }} className="w-full">
      <ResponsiveContainer>
        <BarChart data={data} layout="vertical" margin={MARGIN} barCategoryGap={GAP}>
          <XAxis type="number" domain={domain} ticks={ticks} hide />
          <YAxis type="category" dataKey="series" hide />
          <CartesianGrid strokeDasharray="3 3" stroke={colors.border.light} horizontal={false} />
          <ReferenceLine x={0} stroke={colors.gray[400]} />
          <Bar dataKey="value" barSize={BAR_SIZE} shape={<BarShape />} isAnimationActive={false}>
            {data.map((d) => (
              <Cell key={d.series} fill={SERIES[d.series].fill} />
            ))}
            <LabelList dataKey="value" content={<RowLabel data={data} />} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// The static change from equalising by year, in 2026/27 prices: the model's
// own change, the model's uplift applied to the OBR's receipts, and JRF's
// figure where it publishes one (a diamond; no mark in other years).
// `rows`: buildJrfRows(block); `labels`: { static, obr, jrf } legend text.
export default function JrfComparisonChart({ rows, labels }) {
  const max = Math.max(0, ...rows.flatMap((r) => [r.static, r.obr, r.jrf].filter(isNum).map(Number)));
  const ticks = getNiceTicks([0, max], 4);
  const domain = getTickDomain(ticks);
  return (
    <>
      <SeriesLegend
        items={[
          { label: labels.static, fill: SERIES.static.fill },
          { label: labels.obr, fill: SERIES.obr.fill },
          { label: labels.jrf, fill: SERIES.jrf.fill, marker: "diamond" },
        ]}
      />
      <div className="flex">
        <span className={YEAR_COL} />
        <div className="min-w-0 flex-1">
          <RowAxis domain={domain} ticks={ticks} format={(v) => formatBn(v, 0)} margin={MARGIN} />
        </div>
      </div>
      <div role="list" aria-label="Static change from equalising by year">
        {rows.map((row) => (
          <div
            key={row.year}
            role="listitem"
            aria-label={`${row.year}: ${labels.static} ${formatSignedBn(row.static, 1)}, ${labels.obr} ${
              isNum(row.obr) ? formatSignedBn(row.obr, 1) : "none"
            }${row.jrfLabel ? `, ${labels.jrf} ${row.jrfLabel}` : ""}`}
            className="flex items-center border-b border-slate-100 py-2 last:border-b-0"
          >
            <p className={`${YEAR_COL} text-sm font-semibold leading-5 text-slate-800`}>{row.year}</p>
            <div aria-hidden="true" className="min-w-0 flex-1">
              <YearChart row={row} domain={domain} ticks={ticks} />
            </div>
          </div>
        ))}
      </div>
      <ChartLogo />
    </>
  );
}
