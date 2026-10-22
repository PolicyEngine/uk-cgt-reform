"use client";

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
const noStop = (text) => text.replace(/\.$/, "");
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

function jrfGlance(block) {
  const byYear = Object.fromEntries(block.by_year.map((row) => [row.year, row]));
  const first = block.external.find((row) => isNum(byYear[row.year]?.uplift_on_obr_receipts_real_bn));
  if (!first) return null;
  return {
    id: "jrf",
    title: (
      <>
        Before behaviour: PolicyEngine vs <SourceLink href={first.url}>JRF</SourceLink>
      </>
    ),
    value: `${formatBn(byYear[first.year].uplift_on_obr_receipts_real_bn, 1)} vs ${formatBn(first.value, 0)}`,
    detail: (
      <>
        {`${first.year}, in 2026/27 prices. ${PE}'s uplift applied to the `}
        <SourceLink href={OBR_EFO}>OBR&apos;s</SourceLink>
        {" receipts; JRF's figure is approximate."}
      </>
    ),
  };
}

function packageRange(rows) {
  const values = rows
    .filter((row) => !row.derived)
    .flatMap((row) => (row.bars ? row.bars.map((b) => b.value) : [row.value]))
    .filter(isNum);
  return values.length ? [Math.min(...values), Math.max(...values)] : null;
}

// Rows on which the two elasticities give opposite signs in every year pair,
// and the one of them with the widest gap.
function reckonerSplit(rr) {
  const split = rr.rows.filter((row) =>
    rr.pairs.every((p) => {
      const v = row.values[p.key];
      return isNum(v.central) && isNum(v.official) && Math.sign(v.central) !== Math.sign(v.official);
    }),
  );
  const pair = rr.pairs[0];
  const widest = [...split].sort(
    (a, b) =>
      Math.abs(b.values[pair.key].central - b.values[pair.key].official) -
      Math.abs(a.values[pair.key].central - a.values[pair.key].official),
  )[0];
  return { split, widest, pair };
}

function AtAGlance({ benchmarks, rr, elasticities }) {
  const centax = benchmarks.centax_2019_20_rules;
  const range = packageRange(buildPackageRows(benchmarks.centax_package_context));
  const { widest, pair } = reckonerSplit(rr);
  const v = widest?.values[pair.key];
  // £m from the reckoner block as "+£5.3bn" / "−£4.5bn".
  const bnFromM = (m) => formatSignedBn(m / 1000, 1);
  const items = [
    jrfGlance(benchmarks.static_equalisation),
    {
      id: "centax-2019-20",
      title: (
        <>
          At 2019/20 rules: PolicyEngine vs <SourceLink href={centax.external.url}>CenTax</SourceLink>
        </>
      ),
      value: `${formatUplift(centax.national.uplift_pct)} vs ${formatUplift(centax.external.value)}`,
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
    widest && {
      title: `${widest.label.replace(/\s*\(.*\)\s*$/, "")}: central vs official response`,
      value: `${bnFromM(v.central)} vs ${bnFromM(v.official)}`,
      id: "ready-reckoner",
      detail: (
        <>
          {`${PE}'s change in revenue at ${elasticities.central.e_retention.toFixed(1)} and ${elasticities.official.e_retention}. `}
          <SourceLink href={benchmarks.ready_reckoner.url}>HMRC</SourceLink>
          {`: ${bnFromM(v.hmrc)} (${pair.hmrcYear} receipts).`}
        </>
      ),
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
            {`The static change in CGT from equalising with income tax rates, by year in 2026/27 prices: ${PE}'s own figure on `}
            <DatasetName label={dataset.shortLabel} />
            {`, ${PE}'s uplift applied to the `}
            <SourceLink href={OBR_EFO}>OBR&apos;s</SourceLink>
            {" receipts, and "}
            <SourceLink href={source.url}>JRF&apos;s</SourceLink>
            {` (2026) published figures. Compare the light dots with the diamonds: JRF also scales the OBR's receipts, so that pair shares a method; the dark dots are ${PE}'s own liabilities.`}
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
          JRF applies HMRC&apos;s CGT <SourceLink href={CGT_STATISTICS}>statistics</SourceLink> by
          income band to the OBR&apos;s March 2026 CGT{" "}
          <SourceLink href={OBR_EFO}>projection</SourceLink>.
        </p>
        <p>JRF uses grouped statistics rather than microdata, with no behavioural response.</p>
        <p>
          All figures are in 2026/27 prices. JRF does not state its deflator; the chart deflates
          with the CPI path in {block.price_index_source}.
        </p>
        <p>
          The uplift on OBR receipts applies the model&apos;s static uplift (the static change as a
          share of baseline liability) to the OBR&apos;s CGT receipts forecast (
          {block.obr_receipts_source}), as JRF&apos;s method does.
        </p>
        <p>Model figures are liabilities in the year; the OBR figures are cash receipts.</p>
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
            {` 2026-27 data with no behavioural response, against CenTax's (2024) estimate on 2019/20 data. The shares line up closely: each region is within ${shareGap.toFixed(1)} percentage points of CenTax's.`}
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
          <SourceLink href={EXEMPT_AMOUNT}>amount</SourceLink>.
        </p>
        <p>
          The counterfactual applies those rules to 2026-27 incomes, income tax thresholds and
          gains, with the £12,000 exempt amount in 2026 money.
        </p>
        <p>
          Regions are ordered by {PE}&apos;s share of baseline CGT, largest first; CenTax&apos;s
          table lists them in the standard regional order.
        </p>
        <p>
          CenTax covers resident individuals only. It puts the omitted trusts and non-residents at
          about 5% of revenue.
        </p>
        <p>CenTax counts CGT and income tax together.</p>
        <p>
          CenTax&apos;s regions are taxpayers&apos; regions of residence; these are households&apos;
          regions.
        </p>
        <p>
          A dataset that records no residential property gains charges every gain at the main rates
          in both runs.
        </p>
        <p>{block.rules.not_modelled}</p>
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
          rebases on arrival with a deemed disposal on departure.
        </p>
        <p>
          The{" "}
          <TabLink onNavigate={onNavigate} tab="methodology" section="elasticity">
            Methodology
          </TabLink>{" "}
          tab explains what the package means for the elasticity.
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
  const agree = rr.rows.length - reckonerSplit(rr).split.length;
  return (
    <section className="section-card">
      <SectionHeading
        title="Small rate changes: HMRC's ready reckoner"
        description={
          <>
            <SourceLink href={block.url}>HMRC&apos;s</SourceLink>
            {` (June 2025) receipts effect of small CGT rate changes after behavioural responses, next to ${PE}'s change on `}
            <DatasetName label={dataset.shortLabel} />
            {` at the central and official elasticities. Each row sets HMRC's receipts in the chosen year against ${PE}'s liabilities a year earlier. Bars left of £0 lose revenue; the two elasticities give the same sign on ${agree} of ${rr.rows.length} rows.`}
          </>
        }
      />
      <ReadyReckonerChart
        pairs={rr.pairs}
        rows={rr.rows}
        labels={{
          hmrc: "HMRC",
          central: `${PE}, central (${elasticities.central.e_retention.toFixed(1)})`,
          official: `${PE}, official (${elasticities.official.e_retention}; ${elasticities.official.badr_e_retention} relief)`,
        }}
      />
      <Notes>
        <p>
          {`Why the bars point different ways: a rate rise takes more tax from each gain still sold, but people sell fewer assets, and each bar is the net. At ${elasticities.central.e_retention.toFixed(1)} the higher rate wins; at ${elasticities.official.e_retention} the lost sales win. The rate that raises the most is 1 / (1 + elasticity): about ${Math.round(100 / (1 + elasticities.official.e_retention))}% at ${elasticities.official.e_retention}, below today's 24% higher rate, and ${Math.round(100 / (1 + elasticities.central.e_retention))}% at ${elasticities.central.e_retention.toFixed(1)}.`}
        </p>
        <p>
          HMRC&apos;s figures are {lowerFirst(block.measure).replace(/\.$/, "")}; receipts arrive about a
          year after the liability, so each is set against {PE}&apos;s liabilities a year earlier.
        </p>
        <p>
          {PE}&apos;s figures are the change in government balance on its own data, within the{" "}
          <TabLink onNavigate={onNavigate} tab="reform">
            Reform
          </TabLink>{" "}
          tab&apos;s custom rates. The official elasticity uses its lower value for gains qualifying
          for the relief;{" "}
          <TabLink onNavigate={onNavigate} tab="methodology" section="elasticity-gap">
            Methodology
          </TabLink>{" "}
          explains how the two differ.
        </p>
        <p>
          {block.note.replace(/\s+$/, "")}{" "}
          Source: <SourceLabel href={block.url} label={block.source} />, {block.locator}.
        </p>
        <p>
          {`HMRC's first-year (${firstYear}) receipts: `}
          {block.rows.map((row, i) => (
            <span key={row.id}>
              {i > 0 ? "; " : ""}
              {noStop(row.label)}{" "}
              <span className="whitespace-nowrap">{formatSignedMn(row.hmrc_m[firstYear])}</span>
            </span>
          ))}
          {". Not scored: "}
          {block.excluded
            .map((row) => {
              const reason = noStop(row.reason);
              return `${row.hmrc_label} (${reason[0].toLowerCase()}${reason.slice(1)})`;
            })
            .join("; ")}
          .
        </p>
      </Notes>
    </section>
  );
}

export default function BenchmarksTab({ data, onNavigate }) {
  const benchmarks = getBenchmarks(data);
  const dataset = getDatasetInfo(data);
  const elasticities = benchmarks.elasticities;
  const rr = buildReckonerRows(benchmarks.ready_reckoner, elasticities.central.id, elasticities.official.id);
  return (
    <div className="space-y-6">
      <section>
        <SectionHeading
          size="lg"
          title="How these results compare with other estimates"
          description={
            <>
              {`Published estimates that score the same reform, or the same kind of rate change, next to ${PE}'s figures on `}
              <DatasetName label={dataset.shortLabel} />
              {" on the same basis. Estimates that cover a wider package are shown separately as context."}
            </>
          }
        />
      </section>
      <AtAGlance benchmarks={benchmarks} rr={rr} elasticities={elasticities} />
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
