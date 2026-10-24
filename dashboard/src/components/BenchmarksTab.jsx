"use client";

import { useState } from "react";
import { getBenchmarks, getDatasetInfo, getHeadlineYear } from "../lib/dataHelpers";
import { formatBn, formatPublished, formatSignedBn, formatSignedMn, reckonerElasticities } from "../lib/formatters";
import JrfComparisonChart, { buildJrfRows } from "./charts/JrfComparisonChart";
import PackageEstimatesChart, { buildPackageRows } from "./charts/PackageEstimatesChart";
import ReadyReckonerChart, { buildReckonerRows } from "./charts/ReadyReckonerChart";
import RegionalComparisonChart, {
  buildRegionRows,
  formatUplift,
} from "./charts/RegionalComparisonChart";
import { colors } from "../lib/colors";
import { DatasetName, Notes, SourceLabel, SourceLink, TabLink, YearPill } from "./controls";
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
// "Exchequer receipts in £m ..." reads as the rest of a sentence; a proper
// name ("Business Asset Disposal Relief") keeps its capital.
const lowerFirst = (text) =>
  text.startsWith("Business Asset") ? text : `${text[0].toLowerCase()}${text.slice(1)}`;
// "Higher rate +10 points (18% / 34% / 34%)" → "higher rate +10 points".
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

// `baseline`: the Baseline tab's model and HMRC figures, { modelYear,
// hmrcYear, url, gains: { model, hmrc }, liability: { model, hmrc } }, the
// HMRC values as the benchmark chart shows them ("£119.3bn").
function AtAGlance({ benchmarks, baseline }) {
  const centax = benchmarks.centax_2019_20_rules;
  // JRF's latest published year that PolicyEngine also scores on the OBR's
  // receipts: the same reform, scaled the same way, before behaviour.
  const statics = benchmarks.static_equalisation;
  const jrf = statics?.external
    .map((row) => ({ row, model: statics.by_year.find((y) => y.year === row.year) }))
    .filter(({ model }) => Number.isFinite(model?.uplift_on_obr_receipts_real_bn))
    .map(({ row, model }) => ({
      year: row.year,
      url: row.url,
      value: row.value,
      prices: row.price_basis,
      model: model.uplift_on_obr_receipts_real_bn,
      own: model.static_cgt_change_real_bn,
    }))
    .at(-1);
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
    {
      id: "centax-2019-20",
      title: "Equalising, 2019-20 rules",
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
      note: `Rise in CGT from equalising, before behaviour; PolicyEngine on ${centax.year} data, the earliest year it has.`,
    },
    jrf && {
      id: "jrf-static",
      title: `Equalising before behaviour, ${jrf.year}`,
      columns: [
        { ...pe("on OBR receipts"), value: formatBn(jrf.model, 1) },
        {
          label: <SourceLink href={jrf.url}>JRF</SourceLink>,
          tone: "other",
          value: formatBn(jrf.value, 0),
        },
      ],
      note: `Both scale the OBR's receipts; ${jrf.prices}. PolicyEngine's change with no behavioural response on its own liabilities: ${formatBn(jrf.own, 1)}.`,
    },
  ].filter(Boolean);
  return (
    <section className="section-card" aria-labelledby="benchmarks-glance">
      <h2 id="benchmarks-glance" className="text-xl font-semibold tracking-tight text-slate-900">
        At a glance
      </h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <div key={item.id} className="flex flex-col rounded-xl border border-slate-200 bg-slate-50/60 p-4">
            <p className="text-xs font-semibold leading-snug text-slate-600">{item.title}</p>
            <div className={`mt-2 grid gap-3 ${item.columns.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
              {item.columns.map((column, i) => (
                <div key={i} className="min-w-0">
                  <p className="text-xl font-bold tabular-nums text-slate-900">{column.value}</p>
                  {/* A two-line slot, so the cards' notes start on one line. */}
                  <p
                    className={`mt-0.5 text-xs leading-4 lg:min-h-8 ${column.tone === "pe" ? "font-bold" : "text-slate-500"}`}
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

// The years the package chart shows, as a range: "2025-26 to 2029-30".
function packageYears(rows) {
  const years = rows.map((row) => row.year).sort();
  return years[0] === years.at(-1) ? years[0] : `${years[0]} to ${years.at(-1)}`;
}

// ---- Sections ----

function StaticEqualisation({ block, dataset }) {
  const source = block.external[0];
  // The chart's years: the window plus JRF's earlier year (2026-27), which
  // is scored statically for this comparison only.
  const rows = buildJrfRows(block);
  return (
    <section className="section-card">
      <SectionHeading
        title={`Revenue with no behavioural response: PolicyEngine and JRF, ${rows[0].year} to ${rows.at(-1).year}`}
        description={
          <>
            {"The change in CGT revenue from equalising if taxpayers realised the same gains, in 2026-27 prices. "}
            <SourceLink href={source.url}>JRF</SourceLink>
            {" scales the "}
            <SourceLink href={OBR_EFO}>OBR&apos;s</SourceLink>
            {` receipts. ${PE} shows its own microsimulated liabilities on `}
            <DatasetName label={dataset.shortLabel} />
            {` (teal rings) and, for reference, ${PE}'s percentage increase applied to the OBR's receipts (light dots); JRF's figures are the dark dots.`}
          </>
        }
      />
      <JrfComparisonChart
        rows={rows}
        labels={{
          static: `${PE}, no behavioural response`,
          obr: `${PE}'s percentage increase applied to OBR receipts`,
          jrf: "JRF, no behavioural response (2026 report)",
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
          The light dots apply {PE}&apos;s percentage increase (the change with no behavioural
          response as a share of baseline liability) to the OBR&apos;s cash receipts{" "}
          <SourceLink href={OBR_EFO}>forecast</SourceLink> ({block.obr_receipts_source}), which ends in
          2030-31.
        </p>
        <p>
          JRF states its figures in 2026-27 prices; {PE}&apos;s are deflated with the CPI{" "}
          <SourceLink href={OBR_EFO}>path</SourceLink> in{" "}
          {block.price_index_source.replace(/^OBR EFO /, "the OBR's Economic and fiscal outlook (EFO), ")}.
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
  return (
    <section className="section-card">
      <SectionHeading
        title={`Regional CGT: PolicyEngine ${block.year} and CenTax 2019-20`}
        description={
          <>
            {"Each region's share of baseline CGT under "}
            <SourceLink href={external.url}>CenTax&apos;s</SourceLink>
            {` 2019-20 rules, with no behavioural response. ${PE} uses ${block.year} data, the earliest year the model has; CenTax uses 2019-20. HMRC's own regional `}
            <SourceLink href={CGT_STATISTICS}>shares</SourceLink>
            {" move by up to 1.8 percentage points from year to year."}
          </>
        }
      />
      <RegionalComparisonChart
        rows={rows}
        peLabel={`${PE} ${block.year} (2019-20 rules)`}
        centaxLabel="CenTax 2019-20 (2024 report)"
      />
      <Notes>
        <p>
          {`Equalising at 2019-20 rules, nationally: ${PE} ${block.year} +${formatBn(national.change_bn, 1)} on a ${formatBn(national.baseline_cgt_bn, 1)} baseline (current law: ${formatBn(national.current_law_cgt_bn, 1)}); `}
          <SourceLink href={external.url}>CenTax</SourceLink>
          {` 2019-20, rates only, +${formatBn(external.details.change_bn, 1)} on a ${formatBn(external.details.baseline_bn, 1)} baseline.`}
        </p>
        <p>
          {`The 2019-20 rules: main rates of ${percent(rules.main.basic_rate)} and ${percent(rules.main.higher_rate)}, ${percent(rules.residential_property.basic_rate)} and ${percent(rules.residential_property.higher_rate)} for residential property and carried interest, ${percent(rules.badr.rate)} under Business Asset Disposal`}{" "}
          <SourceLink href={BADR_GUIDANCE}>Relief</SourceLink>, and a £
          {rules.annual_exempt_amount.toLocaleString("en-GB")} exempt{" "}
          <SourceLink href={EXEMPT_AMOUNT}>amount</SourceLink> (not uprated).
        </p>
        <p>
          {`Years: ${PE} applies those rules to ${block.year}, the dataset's own year, with no projection, because its data do not reach back to 2019-20; incomes, gains and income tax thresholds are ${block.year}'s. CenTax's figures are for 2019-20.`}
        </p>
        <p>
          <SourceLink href={external.url}>CenTax</SourceLink> cover resident individuals (they put
          trusts and non-residents at about 5% of revenue) and count CGT and income tax together;{" "}
          {PE} covers individuals in UK households and counts CGT. CenTax&apos;s regions are
          taxpayers&apos; regions of residence; {PE}&apos;s are households&apos; regions.
        </p>
        <p>
          Sources: <SourceLabel href={external.url} label={external.source} />, {external.locator}{" "}
          and {block.external_regions.locator}.
        </p>
      </Notes>
    </section>
  );
}

function CentaxPackage({ rows: allRows, onNavigate }) {
  // CenTax's own published figures only; the file's rates-only derivation
  // (PolicyEngine's arithmetic on CenTax's tables) is left out.
  const rows = allRows.filter((row) => !row.id.endsWith("_derived"));
  const built = buildPackageRows(rows);
  return (
    <section className="section-card">
      <SectionHeading
        title={`CenTax's own estimates for a wider package, ${packageYears(rows)}`}
        description={
          <>
            Every bar is a figure <SourceLink href={CENTAX_REPORT}>CenTax</SourceLink> published,
            not a PolicyEngine estimate. Each is for equal rates together with wider changes to
            how gains are taxed, which this dashboard does not model, so they are context, not a
            comparison.
          </>
        }
      />
      <PackageEstimatesChart rows={built} />
      <Notes>
        <p>
          The package adds an allowance that exempts a normal return on investment, taxes gains
          on assets held until death, values assets at market price when people arrive in the UK,
          and taxes gains when they leave;{" "}
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
        title={`Small rate changes: PolicyEngine and HMRC, gains made in ${currentPair.modelYear}`}
        action={
          rr.pairs.length > 1 ? (
            <YearPill
              years={rr.pairs.map((p) => ({ value: p.key, label: p.modelYear }))}
              value={pairKey}
              onChange={setPairKey}
            />
          ) : null
        }
        description={
          <>
            <SourceLink href={block.url}>HMRC&apos;s</SourceLink>
            {` table of small rate changes (its ‘ready reckoner’, June 2025): HMRC's receipts beside ${PE}'s change in the government balance ${reckonerElasticities(elasticities.official, elasticities.central, block.elasticities.elasticity_3)}. Both are for the same gains: the tax on gains made in ${currentPair.modelYear} is paid, and counted by HMRC as receipts, in ${currentPair.hmrcYear}. Bars left of £0 reduce revenue.`}
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
          central: `${PE} at CenTax's central elasticity (${elasticities.central.e_retention.toFixed(1)})`,
          upper: `${PE} at elasticity ${upper}`,
          official: `${PE} at HMRC/OBR's elasticity (${elasticities.official.e_retention}; ${elasticities.official.badr_e_retention} for Business Asset Disposal Relief)`,
        }}
      />
      <Notes>
        <p>
          {`Why bars point different ways: a higher rate raises more tax on each gain sold, but fewer gains are sold. With a weaker response (${central}) the first effect is larger, so revenue rises; with a stronger one (${official}) the second is larger on the higher-rate rows, so revenue falls there.${upperClause}`}
        </p>
        <p>
          {`Years: `}
          <SourceLink href={block.url}>HMRC&apos;s</SourceLink>
          {` figures are receipts in £m, including knock-on income tax and stamp duty land tax (SDLT), which arrive about a year after the tax is owed, so ${PE}'s ${currentPair.modelYear} liabilities sit beside HMRC's ${currentPair.hmrcYear} receipts. HMRC's ${firstYear} receipts have no pair: they would need ${PE} liabilities for the year before the rows start. ${PE}'s figures are the change in the government balance in the year, as for custom rates in the `}
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
          rates together; HMRC says rows can&apos;t be scaled. HMRC deferred its 2026 edition on 6 July
          2026 pending a review of key assumptions, so these figures are provisional. Source:{" "}
          <SourceLink href={block.url}>HMRC</SourceLink>.
        </p>
        <p>
          {`${upper} is a value between CenTax's upper estimate (${elasticities.centax_range.upper.toFixed(1)}) and the official ${official}, applied as stated to every gain, including those qualifying for the relief.`}
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
          title="PolicyEngine alongside HMRC, JRF and CenTax"
          description={
            <>
              {"HMRC's "}
              <SourceLink href={CGT_STATISTICS}>statistics</SourceLink>
              {` and published estimates of the same reform, shown beside ${PE}'s estimates on `}
              <DatasetName label={dataset.shortLabel} />
              {" for the same year and on the same basis where possible. Differences reflect data, years and methods; estimates that cover a wider package are shown separately."}
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
