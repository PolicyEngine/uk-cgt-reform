"use client";

import { Bar, BarChart, CartesianGrid, LabelList, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { getNiceTicks, getTickDomain } from "../../lib/chartUtils";
import { colors } from "../../lib/colors";
import { formatBn } from "../../lib/formatters";
import ChartLogo from "../ChartLogo";
import ChartLegend from "./ChartLegend";
import { EndLabel, RowAxis, SignedBar } from "./benchmarkRows";
import { TOOLTIP_PROPS, TooltipCard } from "./ChartTooltip";

const MARGIN = { top: 2, right: 112, bottom: 2, left: 14 };
const BAR_SIZE = 16;

const CENTAX = { fill: colors.gray[500], text: colors.gray[700] };
const DERIVED = { fill: "#FFFFFF", stroke: colors.gray[500], text: colors.gray[700] };

// Short row labels, keyed by the results file's ids; an id not listed here
// falls back to its source and locator.
const SHORT_LABELS = {
  centax_2024_rates_only_post_behavioural_derived: "Rates only (PolicyEngine's derivation from CenTax's tables, not a CenTax figure)",
  centax_2024_table5_package: "CenTax 2024 report",
  centax_2024_table6_package_range: "CenTax 2024 report",
  centax_2025_technical_note_package: "CenTax 2025 update",
  centax_2026_taxes_at_the_top_package: "CenTax 2026 report",
};

const DERIVED_IDS = new Set(["centax_2024_rates_only_post_behavioural_derived"]);

const isNum = (v) => v !== null && v !== undefined && Number.isFinite(Number(v));

// The props from the results file's `benchmarks.centax_package_context`.
// CenTax's 2024 package appears twice in the file: Table 5 (at the central
// elasticity) and Table 6 (across elasticities). They become one row with a
// bar per elasticity, so the central figure is not shown twice.
export function buildPackageRows(rows) {
  const table5 = rows.find((row) => row.id === "centax_2024_table5_package");
  const built = [];
  for (const row of rows) {
    const base = {
      id: row.id,
      label: SHORT_LABELS[row.id] ?? `${row.source}, ${row.locator}`,
      year: row.year,
      derived: DERIVED_IDS.has(row.id),
      note: null,
    };
    const points = row.details?.by_retention_elasticity;
    if (points?.length) {
      const central = table5 && points.find((p) => Math.abs(p.value - table5.value) < 0.05);
      built.push({
        ...base,
        label: SHORT_LABELS.centax_2024_table5_package,
        bars: [...points]
          .sort((a, b) => a.retention_elasticity - b.retention_elasticity)
          .map((p) => {
            const main = `${formatBn(p.value, 1)} at elasticity ${p.retention_elasticity.toFixed(1)}`;
            const extra =
              p === central && table5.details?.uplift_pct ? ` (+${table5.details.uplift_pct}%, CenTax's central case)` : "";
            return {
              value: p.value,
              elasticity: p.retention_elasticity,
              central: p === central,
              text: `${main}${extra}`,
              main,
              extra,
            };
          }),
        note: "One bar per elasticity CenTax tested, from 0.5 to 2.0: the stronger the response, the less the package raises.",
      });
      continue;
    }
    if (row === table5 && rows.some((r) => r.details?.by_retention_elasticity?.length)) continue;
    const uplift = row.details?.uplift_pct;
    const withCarried = row.details?.with_carried_interest_bn;
    built.push({
      ...base,
      value: row.value,
      text: `${formatBn(row.value, 1)}${uplift ? ` (+${uplift}%)` : ""}`,
      note: withCarried ? `${formatBn(withCarried, 1)} with carried interest.` : null,
    });
  }
  return built;
}

// `label`: the text beside the bar, if not `text` (the tooltip's).
function RowChart({ value, text, label, title, derived = false, emphasis = false, domain, ticks }) {
  const style = derived ? DERIVED : CENTAX;
  const data = [{ key: "v", hasValue: isNum(value), value: Number(value) }];
  return (
    <div style={{ height: BAR_SIZE + MARGIN.top + MARGIN.bottom + 4 }} className="w-full">
      <ResponsiveContainer>
        <BarChart data={data} layout="vertical" margin={MARGIN}>
          <XAxis type="number" domain={domain} ticks={ticks} hide />
          <YAxis type="category" dataKey="key" hide />
          <CartesianGrid strokeDasharray="3 3" stroke={colors.border.light} horizontal={false} />
          <ReferenceLine x={0} stroke={colors.gray[400]} />
          <Tooltip
            {...TOOLTIP_PROPS}
            content={({ active }) =>
              active ? (
                <TooltipCard
                  title={title}
                  rows={[
                    {
                      label: derived ? "PolicyEngine's derivation" : "CenTax estimate",
                      value: text,
                      color: derived ? DERIVED.stroke : CENTAX.fill,
                    },
                  ]}
                />
              ) : null
            }
          />
          <Bar
            dataKey="value"
            barSize={BAR_SIZE}
            fill={style.fill}
            shape={<SignedBar stroke={derived ? DERIVED.stroke : undefined} strokeDasharray={derived ? "4 3" : undefined} />}
            isAnimationActive={false}
          >
            <LabelList
              dataKey="key"
              content={(props) => (
                <EndLabel {...props} value={1} text={label ?? text} color={style.text} weight={emphasis ? 700 : 600} />
              )}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// CenTax's estimates after behavioural responses, one row each, on one £bn
// scale; the 2024 package has one bar per elasticity.
// `rows`: buildPackageRows(benchmarks.centax_package_context). Legend below.
export default function PackageEstimatesChart({ rows }) {
  const values = rows.flatMap((r) => (r.bars ? r.bars.map((b) => b.value) : [r.value])).filter(isNum);
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
            aria-label={`${row.label}, ${row.year}: ${row.bars ? row.bars.map((b) => b.text).join("; ") : row.text}${row.note ? `. ${row.note}` : ""}`}
            className="border-b border-slate-100 py-2 last:border-b-0"
          >
            <div className="flex items-start justify-between gap-3" style={{ paddingLeft: MARGIN.left }}>
              <p className="text-sm font-semibold leading-5 text-slate-800">{row.label}</p>
              <span className="shrink-0 whitespace-nowrap rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold tabular-nums text-slate-700">
                {row.year}
              </span>
            </div>
            <div aria-hidden="true">
              {row.bars ? (
                row.bars.map((bar) => (
                  <div key={bar.text}>
                    {/* A long label's parenthesis moves under its bar on phones,
                        where it would run past the chart's edge. */}
                    <RowChart
                      title={`${row.label}, ${row.year}`}
                      value={bar.value}
                      text={bar.text}
                      label={
                        bar.extra ? (
                          <>
                            {bar.main}
                            <tspan className="hidden sm:inline">{bar.extra}</tspan>
                          </>
                        ) : undefined
                      }
                      emphasis={bar.central}
                      domain={domain}
                      ticks={ticks}
                    />
                    {bar.extra ? (
                      <p className="text-xs font-bold leading-4 text-slate-700 sm:hidden" style={{ paddingLeft: MARGIN.left }}>
                        {bar.extra.trim()}
                      </p>
                    ) : null}
                  </div>
                ))
              ) : (
                <RowChart title={`${row.label}, ${row.year}`} value={row.value} text={row.text} derived={row.derived} domain={domain} ticks={ticks} />
              )}
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
          { label: "CenTax's published estimate", fill: CENTAX.fill },
          ...(anyDerived
            ? [{ label: "PolicyEngine's derivation from CenTax's tables", fill: DERIVED.fill, stroke: DERIVED.stroke, dashed: true }]
            : []),
        ]}
      />
      <ChartLogo />
    </>
  );
}
