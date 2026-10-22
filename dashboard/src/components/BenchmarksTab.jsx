"use client";

import { useState } from "react";
import { getBenchmarks, getDatasetInfo } from "../lib/dataHelpers";
import { formatBn, formatPublished, formatSignedBn, formatSignedMn } from "../lib/formatters";
import JrfComparisonChart, { buildJrfRows } from "./charts/JrfComparisonChart";
import PackageEstimatesChart, { buildPackageRows } from "./charts/PackageEstimatesChart";
import ReadyReckonerChart, { buildReckonerRows } from "./charts/ReadyReckonerChart";
import RegionalComparisonChart, {
  buildRegionRows,
  formatUplift,
} from "./charts/RegionalComparisonChart";
import { Notes, SourceLabel, SourceLink, TabLink } from "./controls";
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
const MICROCOSM = "https://github.com/PolicyEngine/microcosm";

// The dataset's short name with "Microcosm" linked to its builder.
function DatasetName({ label, possessive = false }) {
  const tail = possessive ? "'s" : "";
  if (!label?.startsWith("Microcosm")) return `${label}${tail}`;
  return (
    <>
      <SourceLink href={MICROCOSM}>Microcosm</SourceLink>
      {`${label.slice("Microcosm".length)}${tail}`}
    </>
  );
}

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
  const hmrcLink = baseline && <SourceLink href={baseline.url}>HMRC</SourceLink>;
  const items = [
    baseline && {
      id: "baseline-gains",
      title: <>Taxable gains: PolicyEngine and {hmrcLink}</>,
      value: `${formatBn(baseline.gains.model, 1)} · ${baseline.gains.hmrc}`,
      detail: `${PE} ${baseline.modelYear} and HMRC ${baseline.hmrcYear}.`,
    },
    baseline && {
      id: "baseline-liability",
      title: <>CGT liability: PolicyEngine and {hmrcLink}</>,
      value: `${formatBn(baseline.liability.model, 1)} · ${baseline.liability.hmrc}`,
      detail: `${PE} ${baseline.modelYear} and HMRC ${baseline.hmrcYear}; rates rose partway through 2024-25.`,
    },
    {
      id: "centax-2019-20",
      title: (
        <>
          At 2019/20 rules: PolicyEngine and <SourceLink href={centax.external.url}>CenTax</SourceLink>
        </>
      ),
      value: `${formatUplift(centax.national.uplift_pct)} · ${formatUplift(centax.external.value)}`,
      detail: "How much equalising raises CGT, before behaviour.",
    },
    range && {
      id: "centax-package",
      title: (
        <>
          <SourceLink href={CENTAX_REPORT}>CenTax&apos;s</SourceLink> wider package (context)
        </>
      ),
      value: `${formatBn(range[0], 1)}–${formatBn(range[1], 1)}`,
      detail: "After behaviour, for a wider reform of the CGT base, so not like-for-like.",
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
            <p className="text-xs font-semibold leading-snug text-slate-600 md:min-h-[2.25rem]">{item.title}</p>
            <p className="mt-1 text-xl font-bold tabular-nums text-slate-900 first-letter:uppercase">{item.value}</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">{item.detail}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

// ---- Sections ----

function StaticEqualisation({ block, dataset }) {
  const source = block.external[0];
  return (
    <section className="section-card">
      <SectionHeading
        title="Before behaviour: JRF's estimate"
        description={
          <>
            {"Static change from equalising, by year, in 2026/27 prices. "}
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
          baseline liability) to the OBR&apos;s cash receipts forecast ({block.obr_receipts_source}).
        </p>
        <p>
          Prices use the CPI path in {block.price_index_source}; JRF&apos;s report does not name a
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
        title="At 2019/20 rules: CenTax"
        description={
          <>
            {`Each region's share of baseline CGT: ${PE} applies `}
            <SourceLink href={external.url}>CenTax&apos;s</SourceLink>
            {" 2019/20 rules to "}
            <DatasetName label={dataset.shortLabel} possessive />
            {` 2026-27 data with no behavioural response, beside CenTax's (2024) estimate on 2019/20 data. Each region's share is within ${shareGap.toFixed(1)} percentage points of CenTax's.`}
          </>
        }
      />
      <RegionalComparisonChart rows={rows} peLabel={PE} centaxLabel="CenTax 2024" />
      <Notes>
        <p>
          {`Nationally, CGT at 2019/20 rules rises from ${formatBn(national.baseline_cgt_bn, 1)} to ${formatBn(national.reform_cgt_bn, 1)} on 2026-27 data (current law: ${formatBn(national.current_law_cgt_bn, 1)}). CenTax's rates-only figure is +${formatBn(external.details.change_bn, 1)} on a ${formatBn(external.details.baseline_bn, 1)} baseline in 2019/20.`}
        </p>
        <p>
          {`The 2019/20 rules: main rates of ${percent(rules.main.basic_rate)} and ${percent(rules.main.higher_rate)}, ${percent(rules.residential_property.basic_rate)} and ${percent(rules.residential_property.higher_rate)} for residential property and carried interest, ${percent(rules.badr.rate)} under Business Asset Disposal`}{" "}
          <SourceLink href={BADR_GUIDANCE}>Relief</SourceLink>, and a £
          {rules.annual_exempt_amount.toLocaleString("en-GB")} exempt{" "}
          <SourceLink href={EXEMPT_AMOUNT}>amount</SourceLink>, applied to 2026-27 incomes,
          thresholds and gains (the £12,000 in 2026 money).
        </p>
        <p>
          CenTax cover resident individuals, putting trusts and non-residents at about 5% of
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
        title="CenTax's wider package (context)"
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

function ReadyReckoner({ block, dataset, elasticities, rr, onNavigate }) {
  const firstYear = block.hmrc_years[0];
  const central = elasticities.central.e_retention.toFixed(1);
  const official = elasticities.official.e_retention;
  // CenTax's upper value, described from the rows themselves: whether it
  // raises revenue in every row and pair, and by less than the central case.
  const upper = elasticities.centax_range.upper.toFixed(1);
  const upperValues = rr.rows.flatMap((row) => rr.pairs.map((p) => row.values[p.key]));
  const upperRises = upperValues.every((v) => isNum(v.upper) && v.upper > 0);
  const upperBelowCentral = upperValues.every((v) => isNum(v.upper) && v.upper < v.central);
  const upperClause =
    upperRises && upperBelowCentral
      ? ` At CenTax's upper value (${upper}) revenue still rises in every row, by less than at ${central}.`
      : "";
  const [pairKey, setPairKey] = useState(rr.pairs[0]?.key);
  return (
    <section className="section-card scroll-mt-24" id="ready-reckoner">
      <SectionHeading
        title="Small rate changes: HMRC's ready reckoner"
        action={
          rr.pairs.length > 1 ? (
            <label className="flex items-center gap-2">
              <span className="text-xs text-slate-500">HMRC receipts</span>
              <span className="relative inline-flex">
                <select
                  aria-label="HMRC receipts year"
                  value={pairKey}
                  onChange={(event) => setPairKey(event.target.value)}
                  className="h-8 cursor-pointer appearance-none rounded-md border border-slate-200 bg-slate-50 pl-3 pr-8 text-sm font-medium tabular-nums text-slate-800 transition-colors hover:border-slate-300 hover:bg-white focus:outline-none focus:ring-2 focus:ring-[color:var(--pe-color-primary-500)]"
                >
                  {rr.pairs.map((p) => (
                    <option key={p.key} value={p.key}>
                      {p.hmrcYear}
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
            {` (June 2025) receipts from small rate changes, beside ${PE}'s change a year earlier at the central elasticity, CenTax's upper value and the official one. Bars left of £0 reduce revenue.`}
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
          upper: `${PE}, CenTax upper (${elasticities.centax_range.upper.toFixed(1)})`,
          official: `${PE}, official (${elasticities.official.e_retention}; ${elasticities.official.badr_e_retention} relief)`,
        }}
      />
      <Notes>
        <p>
          {`Why bars point different ways: a higher rate raises more tax on each gain sold, but fewer gains are sold. With a weaker response (${central}) the first effect is larger, so revenue rises; with a stronger one (${official}) the second is larger on the higher-rate rows, so revenue falls there.${upperClause}`}
        </p>
        <p>
          HMRC&apos;s figures are receipts in £m, including knock-on income tax and SDLT, and arrive
          a year after the tax is owed; {PE}&apos;s are the change in the government balance in the
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
          {`HMRC's first-year (${firstYear}) figures: `}
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
  const rr = buildReckonerRows(benchmarks.ready_reckoner, elasticities.central.id, elasticities.official.id);
  return (
    <div id="comparisons" className="scroll-mt-24 space-y-6">
      <section className="pt-2">
        <SectionHeading
          size="lg"
          title="How these results compare with other estimates"
          description={
            <>
              {`HMRC's statistics for the baseline, and published estimates that score the same reform or the same kind of rate change, next to ${PE}'s figures on `}
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
        dataset={dataset}
        elasticities={elasticities}
        rr={rr}
        onNavigate={onNavigate}
      />
    </div>
  );
}
