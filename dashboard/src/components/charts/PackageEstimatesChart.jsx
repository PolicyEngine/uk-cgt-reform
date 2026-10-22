"use client";

import { Bar, BarChart, CartesianGrid, LabelList, ReferenceLine, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { getNiceTicks, getTickDomain } from "../../lib/chartUtils";
import { colors } from "../../lib/colors";
import { formatBn } from "../../lib/formatters";
import ChartLogo from "../ChartLogo";
import ChartLegend from "./ChartLegend";
import { EndLabel, RowAxis, SignedBar } from "./benchmarkRows";

const MARGIN = { top: 2, right: 112, bottom: 2, left: 14 };
const BAR_SIZE = 16;
const RANGE_TOP = 16;

const CENTAX = { fill: colors.gray[500], text: colors.gray[700] };
const DERIVED = { fill: "#FFFFFF", stroke: colors.gray[500], text: colors.gray[700] };

// Short row labels, keyed by the results file's ids; an id not listed here
// falls back to its source and locator.
const SHORT_LABELS = {
  centax_2024_rates_only_post_behavioural_derived: "Rates only (PolicyEngine's estimate from CenTax's tables)",
  centax_2024_table5_package: "Full package (CenTax 2024)",
  centax_2024_table6_package_range: "Full package, range of responses (CenTax 2024)",
  centax_2025_technical_note_package: "Full package, updated (CenTax 2025)",
  centax_2026_taxes_at_the_top_package: "Full package, latest (CenTax 2026)",
};

const DERIVED_IDS = new Set(["centax_2024_rates_only_post_behavioural_derived"]);

const isNum = (v) => v !== null && v !== undefined && Number.isFinite(Number(v));

// The props from the results file's `benchmarks.centax_package_context`.
export function buildPackageRows(rows) {
  return rows.map((row) => {
    const points = row.details?.by_retention_elasticity;
    const base = {
      id: row.id,
      label: SHORT_LABELS[row.id] ?? `${row.source}, ${row.locator}`,
      year: row.year,
      derived: DERIVED_IDS.has(row.id),
      note: null,
    };
    if (points?.length) {
      const sorted = [...points].sort((a, b) => a.value - b.value);
      return {
        ...base,
        points: sorted.map((p) => ({ value: p.value, elasticity: p.retention_elasticity })),
        // "£5.0–19.0bn": short enough to sit past the range at phone width.
        text: `${formatBn(sorted[0].value, 1).replace(/bn$/, "")}\u2013${formatBn(sorted[sorted.length - 1].value, 1).replace("\u00A3", "")}`,
        note: "Each point is one behavioural response assumption: 0.5 is weakest, 2.0 strongest.",
      };
    }
    const uplift = row.details?.uplift_pct;
    const withCarried = row.details?.with_carried_interest_bn;
    return {
      ...base,
      value: row.value,
      text: `${formatBn(row.value, 1)}${uplift ? ` (+${uplift}%)` : ""}`,
      note: withCarried ? `${formatBn(withCarried, 1)} with carried interest.` : null,
    };
  });
}

// CenTax's range: a line across its points, a dot at each, and each point's
// elasticity above it.
function RangeShape({ x, y, width, height, payload }) {
  const pts = payload?.points;
  if (!pts?.length) return null;
  const lo = pts[0].value;
  const hi = pts[pts.length - 1].value;
  const px = (v) => x + ((v - lo) / (hi - lo || 1)) * width;
  const cy = y + height / 2;
  return (
    <g>
      <line x1={x} x2={x + width} y1={cy} y2={cy} stroke={CENTAX.fill} strokeWidth={2} />
      {[x, x + width].map((cx) => (
        <line key={cx} x1={cx} x2={cx} y1={cy - 6} y2={cy + 6} stroke={CENTAX.fill} strokeWidth={2} />
      ))}
      {pts.map((p) => (
        <g key={p.elasticity}>
          <circle cx={px(p.value)} cy={cy} r={4.5} fill={CENTAX.fill} stroke="#FFFFFF" strokeWidth={1} />
          <text
            x={px(p.value)}
            y={cy - 9}
            textAnchor="middle"
            fontSize={11}
            fill={colors.gray[500]}
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            {p.elasticity.toFixed(1)}
          </text>
        </g>
      ))}
    </g>
  );
}

function RowChart({ row, domain, ticks }) {
  const isRange = Boolean(row.points);
  const style = row.derived ? DERIVED : CENTAX;
  const data = [
    {
      key: row.id,
      hasValue: isRange || isNum(row.value),
      points: row.points,
      value: isRange ? [row.points[0].value, row.points[row.points.length - 1].value] : Number(row.value),
    },
  ];
  const margin = isRange ? { ...MARGIN, top: RANGE_TOP } : MARGIN;
  return (
    <div style={{ height: BAR_SIZE + margin.top + margin.bottom + 4 }} className="w-full">
      <ResponsiveContainer>
        <BarChart data={data} layout="vertical" margin={margin}>
          <XAxis type="number" domain={domain} ticks={ticks} hide />
          <YAxis type="category" dataKey="key" hide />
          <CartesianGrid strokeDasharray="3 3" stroke={colors.border.light} horizontal={false} />
          <ReferenceLine x={0} stroke={colors.gray[400]} />
          <Bar
            dataKey="value"
            barSize={BAR_SIZE}
            fill={style.fill}
            shape={
              isRange ? (
                <RangeShape />
              ) : (
                <SignedBar stroke={row.derived ? DERIVED.stroke : undefined} strokeDasharray={row.derived ? "4 3" : undefined} />
              )
            }
            isAnimationActive={false}
          >
            <LabelList
              dataKey="key"
              content={(props) => (
                <EndLabel
                  {...props}
                  width={props.width + (isRange ? 6 : 0)}
                  value={1}
                  text={row.text}
                  color={style.text}
                  weight={600}
                />
              )}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// CenTax's estimates after behavioural responses, one row each, on one £bn
// scale; Table 6's range across its elasticities is drawn as a range.
// `rows`: buildPackageRows(benchmarks.centax_package_context). Legend below.
export default function PackageEstimatesChart({ rows }) {
  const values = rows.flatMap((r) => (r.points ? r.points.map((p) => p.value) : [r.value])).filter(isNum);
  const ticks = getNiceTicks([0, Math.max(0, ...values)], 4);
  const domain = getTickDomain(ticks);
  const anyDerived = rows.some((r) => r.derived);
  return (
    <>
      <RowAxis domain={domain} ticks={ticks} format={(v) => formatBn(v, 0)} margin={MARGIN} />
      <div role="list" aria-label="CenTax package estimates after behavioural responses">
        {rows.map((row) => (
          <div
            key={row.id}
            role="listitem"
            aria-label={`${row.label}, ${row.year}: ${row.text}${row.note ? `. ${row.note}` : ""}`}
            className="border-b border-slate-100 py-2 last:border-b-0"
          >
            <div className="flex items-start justify-between gap-3" style={{ paddingLeft: MARGIN.left }}>
              <p className="text-sm font-semibold leading-5 text-slate-800">{row.label}</p>
              <span className="shrink-0 whitespace-nowrap rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold tabular-nums text-slate-700">
                {row.year}
              </span>
            </div>
            <div aria-hidden="true">
              <RowChart row={row} domain={domain} ticks={ticks} />
            </div>
            {row.note ? (
              <p className="text-xs leading-5 text-slate-500" style={{ paddingLeft: MARGIN.left }}>
                {row.note}
              </p>
            ) : null}
          </div>
        ))}
      </div>
      <ChartLegend
        items={[
          { label: "CenTax estimate", fill: CENTAX.fill },
          ...(anyDerived
            ? [{ label: "PolicyEngine's estimate from CenTax's tables", fill: DERIVED.fill, stroke: DERIVED.stroke, dashed: true }]
            : []),
        ]}
      />
      <ChartLogo />
    </>
  );
}
