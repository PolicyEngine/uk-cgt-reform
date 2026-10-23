"use client";

import { useState } from "react";
import { getBenchmarks, getDatasetInfo, getHeadlineYear } from "../lib/dataHelpers";
import { formatBn, formatPublished, formatSignedBn, formatSignedMn } from "../lib/formatters";
import JrfComparisonChart, { buildJrfRows } from "./charts/JrfComparisonChart";
import PackageEstimatesChart, { buildPackageRows } from "./charts/PackageEstimatesChart";
import ReadyReckonerChart, { buildReckonerRows } from "./charts/ReadyReckonerChart";
import RegionalComparisonChart, {
  buildRegionRows,
  formatUplift,
} from "./charts/RegionalComparisonChart";
import { colors } from "../lib/colors";
import { DatasetName, Notes, SourceLabel, SourceLink, TabLink } from "./controls";
import SectionHeading from "./SectionHeading";

// Published estimates next to this dataset's own figures on the same basis
// (issue #7). Every external number comes from the results file's
// `benchmarks` block, which the pipeline builds from comparison.py. Each
// section: a plain title, what the chart shows, the chart, one bold-lead
// takeaway, then Notes. The at-a-glance card is the home of the headline
// comparisons; the sections do not restate them.

const CGT_STATISTICS = "https://www.gov.uk/government/statistics/capital-gains-tax-statistics";
const OBR_EFO = "https://obr.uk/efo/economic-and-fiscal-outlook-march-2026/";
const BADR_GUIDANCE = "https://www.gov.uk/business-asset-disposal-relief";
const EXEMPT_AMOUNT = "https://www.gov.uk/capital-gains-tax/allowances";
const CENTAX_REPORT =
  "https://centax.org.uk/wp-content/uploads/2024/10/AdvaniLonsdaleSummers2024_CGTReform.pdf";

// Legend names, short and parallel across the tab's charts.
const PE = "PolicyEngine";

const percent = (rate) => `${Math.round(rate * 100)}%`;
// "Exchequer receipts in £m ..." reads as the rest of a sentence.
const lowerFirst = (text) => `${text[0].toLowerCase()}${text.slice(1)}`;
// "Higher rate +10pp (18% / 34% / 34%)" → "higher rate +10pp".
const shortRow = (label) => lowerFirst(label.replace(/\s*\(.*\)\s*$/, ""));
const isNum = (v) => v !== null && v !== undefined && Number.isFinite(Number(v));

function Takeaway({ lead, children }) {
  return (
    <p className="mt-4 text-sm leading-6 text-slate-700">
      <strong className="font-semibold text-slate-900">{lead}</strong> {children}
    </p>
  );
}

// ---- At a glance: one line per section, every number from the data. ----

function packageRange(rows) {
  const values = rows
    .filter((row) => !row.derived)
    .flatMap((row) => (row.bars ? row.bars.map((b) => b.value) : [row.value]))
    .filter(isNum);
  return values.length ? [Math.min(...values), Math.max(...values)] : null;
}

// `baseline`: the Baseline tab's model and HMRC figures, { modelYear,
// hmrcYear, url, gains: { model, hmrc }, liability: { model, hmrc } }, the
// HMRC values as the benchmark chart shows them ("£119.3bn").
function AtAGlance({ benchmarks, baseline }) {
  const centax = benchmarks.centax_2019_20_rules;
  const range = packageRange(buildPackageRows(benchmarks.centax_package_context));
  // Each card: a title, one column per source (value, then its source and
  // year in the source's chart colour: PolicyEngine teal, the other grey),
  // and at most one short note.
  const pe = (year) => ({ label: `PolicyEngine ${year}`, tone: "pe" });
  const hmrc = baseline && {
    label: (
      <>
        <SourceLink href={baseline.url}>HMRC</SourceLink> {baseline.hmrcYear} (provisional)
      </>
    ),
    tone: "other",
  };
  const items = [
    baseline && {
      id: "baseline-gains",
      title: "Taxable gains",
      columns: [
        { ...pe(baseline.modelYear), value: formatBn(baseline.gains.model, 1) },
        { ...hmrc, value: baseline.gains.hmrc },
      ],
    },
    baseline && {
      id: "baseline-liability",
      title: "CGT liability",
      columns: [
        { ...pe(baseline.modelYear), value: formatBn(baseline.liability.model, 1) },
        { ...hmrc, value: baseline.liability.hmrc },
      ],
    },
    {
      id: "centax-2019-20",
      title: "Equalising, 2019/20 rules",
      columns: [
        { ...pe(centax.year), value: formatUplift(centax.national.uplift_pct) },
        {
          label: (
            <>
              <SourceLink href={centax.external.url}>CenTax</SourceLink> 2019-20
            </>
          ),
          tone: "other",
          value: formatUplift(centax.external.value),
        },
      ],
      note: "Before behaviour.",
    },
    range && {
      id: "centax-package",
      title: "CenTax's wider package",
      columns: [
        {
          label: (
            <>
              <SourceLink href={CENTAX_REPORT}>CenTax</SourceLink>,{" "}
              {packageYears(benchmarks.centax_package_context)}
            </>
          ),
          tone: "other",
          value: `${formatBn(range[0], 1)}–${formatBn(range[1], 1)}`,
        },
      ],
      note: "Not like-for-like.",
    },
  ].filter(Boolean);
  return (
    <section className="section-card" aria-labelledby="benchmarks-glance">
      <h2 id="benchmarks-glance" className="text-xl font-semibold tracking-tight text-slate-900">
        At a glance
      </h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((item) => (
          <div key={item.id} className="flex flex-col rounded-xl border border-slate-200 bg-slate-50/60 p-4">
            <p className="text-xs font-semibold leading-snug text-slate-600">{item.title}</p>
            <div className={`mt-2 grid gap-3 ${item.columns.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
              {item.columns.map((column, i) => (
                <div key={i} className="min-w-0">
                  <p className="text-xl font-bold tabular-nums text-slate-900">{column.value}</p>
                  <p
                    className={`mt-0.5 text-xs leading-4 ${column.tone === "pe" ? "font-bold" : "text-slate-500"}`}
                    style={column.tone === "pe" ? { color: colors.primary[700] } : undefined}
                  >
                    {column.label}
                  </p>
                </div>
              ))}
            </div>
            {item.note ? <p className="mt-2 text-xs leading-5 text-slate-500">{item.note}</p> : null}
          </div>
        ))}
      </div>
    </section>
  );
}

// CenTax's package estimates' own years (not the rates-only derivation,
// which is PolicyEngine's), as a range: "2025-26 to 2029-30".
function packageYears(rows) {
  const years = rows.filter((row) => !row.id.includes("rates_only")).map((row) => row.year).sort();
  return years[0] === years.at(-1) ? years[0] : `${years[0]} to ${years.at(-1)}`;
}

// ---- Sections ----

function StaticEqualisation({ block, dataset }) {
  const source = block.external[0];
  return (
    <section className="section-card">
      <SectionHeading
        title={`Static revenue: PolicyEngine and JRF, ${block.by_year[0].year} to ${block.by_year.at(-1).year}`}
        description={
          <>
            {"Static change from equalising, in 2026/27 prices. "}
            <SourceLink href={source.url}>JRF</SourceLink>
            {" scales the "}
            <SourceLink href={OBR_EFO}>OBR&apos;s</SourceLink>
            {` receipts, as the light dots do; the dark dots are ${PE}'s own liabilities on `}
            <DatasetName label={dataset.shortLabel} />
            {"."}
          </>
        }
      />
      <JrfComparisonChart
        rows={buildJrfRows(block)}
        labels={{
          static: `${PE}, static`,
          obr: `${PE} uplift applied to OBR receipts`,
          jrf: "JRF 2026",
        }}
      />
      <Notes>
        <p>
          Source: <SourceLabel href={source.url} label={source.source} />,{" "}
          {formatPublished(source.published)}, {source.locator.toLowerCase()}.
        </p>
        <p>
          JRF applies HMRC&apos;s grouped CGT <SourceLink href={CGT_STATISTICS}>statistics</SourceLink>{" "}
          by income band to the OBR&apos;s March 2026 CGT{" "}
          <SourceLink href={OBR_EFO}>projection</SourceLink>, with no behavioural response.
        </p>
        <p>
          The light dots apply the model&apos;s static uplift (the static change as a share of
          baseline liability) to the OBR&apos;s cash receipts{" "}
          <SourceLink href={OBR_EFO}>forecast</SourceLink> ({block.obr_receipts_source}), which ends in
          2030-31.
        </p>
        <p>
          Prices use the CPI <SourceLink href={OBR_EFO}>path</SourceLink> in {block.price_index_source};
          JRF&apos;s report does not name a
          deflator.
        </p>
      </Notes>
    </section>
  );
}

function CentaxRegions({ block, dataset }) {
  const national = block.national;
  const external = block.external;
  const rules = block.rules.baseline;
  const rows = buildRegionRows(block.regions);
  const shareGap = Math.max(...rows.map((r) => Math.abs(r.baseline_share_pct - r.centax_baseline_share_pct)));
  return (
    <section className="section-card">
      <SectionHeading
        title={`Regional CGT: PolicyEngine ${block.year} and CenTax 2019-20`}
        description={
          <>
            {`Each region's share of baseline CGT: ${PE} applies `}
            <SourceLink href={external.url}>CenTax&apos;s</SourceLink>
            {" 2019/20 rules to "}
            <DatasetName label={dataset.shortLabel} possessive />
            {` data with no behavioural response, beside CenTax's (2024) estimate. Each region's share is within ${shareGap.toFixed(1)} percentage points of CenTax's.`}
          </>
        }
      />
      <RegionalComparisonChart rows={rows} peLabel={PE} centaxLabel="CenTax 2024" />
      <Notes>
        <p>
          {`Nationally, CGT at 2019/20 rules rises from ${formatBn(national.baseline_cgt_bn, 1)} to ${formatBn(national.reform_cgt_bn, 1)} (current law: ${formatBn(national.current_law_cgt_bn, 1)}). `}
          <SourceLink href={external.url}>CenTax&apos;s</SourceLink>
          {` rates-only figure is +${formatBn(external.details.change_bn, 1)} on a ${formatBn(external.details.baseline_bn, 1)} baseline.`}
        </p>
        <p>
          {`The 2019/20 rules: main rates of ${percent(rules.main.basic_rate)} and ${percent(rules.main.higher_rate)}, ${percent(rules.residential_property.basic_rate)} and ${percent(rules.residential_property.higher_rate)} for residential property and carried interest, ${percent(rules.badr.rate)} under Business Asset Disposal`}{" "}
          <SourceLink href={BADR_GUIDANCE}>Relief</SourceLink>, and a £
          {rules.annual_exempt_amount.toLocaleString("en-GB")} exempt{" "}
          <SourceLink href={EXEMPT_AMOUNT}>amount</SourceLink> (not uprated), applied to that
          year&apos;s incomes, thresholds and gains.
        </p>
        <p>
          <SourceLink href={external.url}>CenTax</SourceLink> cover resident individuals, putting trusts and non-residents at about 5% of
          revenue, and count CGT and income tax together. Their regions are taxpayers&apos;
          regions of residence; these are households&apos; regions.
        </p>
        <p>
          Sources: <SourceLabel href={external.url} label={external.source} />, {external.locator}{" "}
          and {block.external_regions.locator}.
        </p>
      </Notes>
    </section>
  );
}

function CentaxPackage({ rows, onNavigate }) {
  const built = buildPackageRows(rows);
  return (
    <section className="section-card">
      <SectionHeading
        title={`CenTax's wider package, ${packageYears(rows)}`}
        description={
          <>
            <SourceLink href={CENTAX_REPORT}>CenTax</SourceLink> estimate what equalising would
            raise alongside wider changes to how gains are taxed. These cover more than this
            dashboard&apos;s reform, so they are context, not a direct comparison.
          </>
        }
      />
      <PackageEstimatesChart rows={built} />
      <Notes>
        <p>
          The package adds a rate-of-return investment allowance, removes the death uplift, and
          rebases on arrival with a deemed disposal on departure;{" "}
          <TabLink onNavigate={onNavigate} tab="methodology" section="elasticity">
            Methodology
          </TabLink>{" "}
          covers what that means for the elasticity.
        </p>
        {rows.map((row) => (
          <p key={row.id}>
            <SourceLabel href={row.url} label={row.source} />, {row.locator} ({row.year}):{" "}
            {row.note}
          </p>
        ))}
      </Notes>
    </section>
  );
}

function ReadyReckoner({ block, dataset, elasticities, rr, headlineYear, onNavigate }) {
  const firstYear = block.hmrc_years[0];
  const central = elasticities.central.e_retention.toFixed(1);
  const official = elasticities.official.e_retention;
  // The 3.0 case, described from the rows themselves: whether revenue
  // falls at it on exactly the rows where it falls at the official value
  // (and by less),
  // or rises in every row by less than at the central one.
  const upper = block.elasticities.elasticity_3.toFixed(1);
  const upperValues = rr.rows.flatMap((row) => rr.pairs.map((p) => row.values[p.key]));
  const complete = upperValues.every((v) => isNum(v.upper) && isNum(v.central) && isNum(v.official));
  const fallsWithOfficial =
    complete && upperValues.every((v) => v.upper < 0 === v.official < 0 && (v.official >= 0 || v.upper > v.official));
  const upperRises = complete && upperValues.every((v) => v.upper > 0 && v.upper < v.central);
  const upperClause = !complete
    ? ""
    : upperRises
      ? ` At ${upper} revenue still rises in every row, by less than at ${central}.`
      : fallsWithOfficial
        ? ` At ${upper} revenue falls on the same rows, by less than at ${official}.`
        : "";
  // The year select names PolicyEngine's year (HMRC's receipts follow a
  // year later), starting at the headline year.
  const [pairKey, setPairKey] = useState(
    (rr.pairs.find((p) => p.modelYear === headlineYear) ?? rr.pairs[0])?.key,
  );
  const currentPair = rr.pairs.find((p) => p.key === pairKey) ?? rr.pairs[0];
  return (
    <section className="section-card scroll-mt-24" id="ready-reckoner">
      <SectionHeading
        title={`Small rate changes: PolicyEngine and HMRC, ${currentPair.modelYear}`}
        action={
          rr.pairs.length > 1 ? (
            <label className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Year</span>
              <span className="relative inline-flex">
                <select
                  aria-label="Year"
                  value={pairKey}
                  onChange={(event) => setPairKey(event.target.value)}
                  className="h-8 cursor-pointer appearance-none rounded-md border border-slate-200 bg-slate-50 pl-3 pr-8 text-sm font-medium tabular-nums text-slate-800 transition-colors hover:border-slate-300 hover:bg-white focus:outline-none focus:ring-2 focus:ring-[color:var(--pe-color-primary-500)]"
                >
                  {rr.pairs.map((p) => (
                    <option key={p.key} value={p.key}>
                      {p.modelYear}
                    </option>
                  ))}
                </select>
                <svg
                  aria-hidden="true"
                  viewBox="0 0 12 12"
                  className="pointer-events-none absolute right-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-500"
                >
                  <path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            </label>
          ) : null
        }
        description={
          <>
            <SourceLink href={block.url}>HMRC&apos;s</SourceLink>
            {` (June 2025) receipts from small rate changes, beside ${PE}'s change in the government balance at the official elasticity, ${upper} and the central one. Bars left of £0 reduce revenue.`}
          </>
        }
      />
      <ReadyReckonerChart
        pairs={rr.pairs}
        rows={rr.rows}
        pairKey={pairKey}
        onPairKeyChange={setPairKey}
        labels={{
          hmrc: "HMRC",
          central: `${PE}, central (${elasticities.central.e_retention.toFixed(1)})`,
          upper: `${PE}, elasticity ${upper}`,
          official: `${PE}, official (${elasticities.official.e_retention}; ${elasticities.official.badr_e_retention} relief)`,
        }}
      />
      <Notes>
        <p>
          {`Why bars point different ways: a higher rate raises more tax on each gain sold, but fewer gains are sold. With a weaker response (${central}) the first effect is larger, so revenue rises; with a stronger one (${official}) the second is larger on the higher-rate rows, so revenue falls there.${upperClause}`}
        </p>
        <p>
          <SourceLink href={block.url}>HMRC&apos;s</SourceLink> figures are receipts in £m, including knock-on income tax and SDLT, and arrive
          a year after the tax is owed, so the chart shows HMRC&apos;s receipts in{" "}
          {currentPair.hmrcYear}; {PE}&apos;s are the change in the government balance in the
          year, as for custom rates in the{" "}
          <TabLink onNavigate={onNavigate} tab="reform">
            Reform
          </TabLink>{" "}
          tab.{" "}
          <TabLink onNavigate={onNavigate} tab="methodology" section="elasticity-gap">
            Methodology
          </TabLink>{" "}
          describes the elasticities.
        </p>
        <p>
          Rows raise the named rate from April 2026; higher-rate rows move the higher and additional
          rates together; HMRC says rows can&apos;t be scaled. HMRC delayed its 2026 edition, so
          these are provisional. Source: <SourceLink href={block.url}>HMRC</SourceLink>,{" "}
          {formatPublished(block.published).replace(/^\d+\s+/, "")}.
        </p>
        <p>
          <SourceLink href={block.url}>HMRC&apos;s</SourceLink>
          {` first-year (${firstYear}) figures: `}
          {block.rows.map((row, i) => (
            <span key={row.id}>
              {i > 0 ? "; " : ""}
              {shortRow(row.label)}{" "}
              <span className="whitespace-nowrap">{formatSignedMn(row.hmrc_m[firstYear])}</span>
            </span>
          ))}
          .
        </p>
      </Notes>
    </section>
  );
}

// The Baseline tab's comparisons: the intro and at-a-glance row, then
// `children` (the tab's own check against HMRC's statistics), then each
// comparison with a published estimate.
export default function BenchmarksTab({ data, onNavigate, baselineGlance, children }) {
  const benchmarks = getBenchmarks(data);
  const dataset = getDatasetInfo(data);
  const elasticities = benchmarks.elasticities;
  const rr = buildReckonerRows(benchmarks.ready_reckoner, elasticities.central.id, elasticities.official.id, "elasticity_3");
  return (
    <div id="comparisons" className="scroll-mt-24 space-y-6">
      <section className="pt-2">
        <SectionHeading
          size="lg"
          title="Comparison with HMRC, JRF and CenTax"
          description={
            <>
              {"HMRC's "}
              <SourceLink href={CGT_STATISTICS}>statistics</SourceLink>
              {` for the baseline, and published estimates that score the same reform or the same kind of rate change, next to ${PE}'s figures on `}
              <DatasetName label={dataset.shortLabel} />
              {" on the same basis. Estimates that cover a wider package are shown separately as context."}
            </>
          }
        />
      </section>
      <AtAGlance benchmarks={benchmarks} baseline={baselineGlance} />
      {children}
      <StaticEqualisation block={benchmarks.static_equalisation} dataset={dataset} />
      <CentaxRegions block={benchmarks.centax_2019_20_rules} dataset={dataset} />
      <CentaxPackage rows={benchmarks.centax_package_context} onNavigate={onNavigate} />
      <ReadyReckoner
        block={benchmarks.ready_reckoner}
        headlineYear={getHeadlineYear(data)}
        dataset={dataset}
        elasticities={elasticities}
        rr={rr}
        onNavigate={onNavigate}
      />
    </div>
  );
}
