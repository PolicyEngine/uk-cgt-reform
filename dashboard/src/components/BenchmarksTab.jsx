"use client";

import { getBenchmarks, getDatasetInfo } from "../lib/dataHelpers";
import { formatBn, formatPublished, formatSignedMn } from "../lib/formatters";
import JrfComparisonChart, { buildJrfRows } from "./charts/JrfComparisonChart";
import PackageEstimatesChart, { buildPackageRows } from "./charts/PackageEstimatesChart";
import ReadyReckonerChart, { buildReckonerRows } from "./charts/ReadyReckonerChart";
import RegionalComparisonChart, {
  buildRegionRows,
  formatUplift,
} from "./charts/RegionalComparisonChart";
import { MetricCard, Notes, SourceLabel, SourceLink, TabLink } from "./controls";
import SectionHeading from "./SectionHeading";

// Published estimates next to this dataset's own figures on the same basis
// (issue #7). Every external number comes from the results file's
// `benchmarks` block, which the pipeline builds from comparison.py.

const CGT_STATISTICS = "https://www.gov.uk/government/statistics/capital-gains-tax-statistics";
const OBR_EFO = "https://obr.uk/efo/economic-and-fiscal-outlook-march-2026/";
const BADR_GUIDANCE = "https://www.gov.uk/business-asset-disposal-relief";
const EXEMPT_AMOUNT = "https://www.gov.uk/capital-gains-tax/allowances";

const percent = (rate) => `${Math.round(rate * 100)}%`;
// "Exchequer receipts in £m ..." reads as the rest of a sentence.
const lowerFirst = (text) => `${text[0].toLowerCase()}${text.slice(1)}`;
const noStop = (text) => text.replace(/\.$/, "");

function StaticEqualisation({ block, dataset }) {
  const jrf = Object.fromEntries(block.external.map((row) => [row.year, row]));
  const source = block.external[0];
  return (
    <section className="section-card">
      <SectionHeading
        title="Equalisation before behavioural responses: JRF (2026)"
        description={`JRF estimates that equalising CGT with income tax rates raises about £${jrf["2026-27"].value.toFixed(0)}bn in 2026-27 and £${jrf["2029-30"].value.toFixed(0)}bn in 2029-30 (2026/27 prices) before behavioural responses. Because JRF scales the OBR's receipts, the chart also applies ${dataset.shortLabel}'s static uplift to those receipts.`}
      />
      <JrfComparisonChart
        rows={buildJrfRows(block)}
        labels={{
          static: `${dataset.shortLabel}, static change`,
          obr: `${dataset.shortLabel} uplift on OBR receipts`,
          jrf: "JRF (2026)",
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
        <p>JRF uses grouped statistics rather than microdata.</p>
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
  return (
    <section className="section-card">
      <SectionHeading
        title="Equalisation at 2019/20 rules: CenTax (2024)"
        description={`CenTax's rates-only estimate equalises from 2019/20 CGT rules. To compare like with like, this dashboard applies those rules to ${dataset.shortLabel}'s 2026-27 data, with no behavioural response, and equalises from there.`}
      />
      <div className="mb-5 grid gap-4 md:grid-cols-2">
        <MetricCard
          label={`Uplift from equalising, ${dataset.shortLabel}`}
          value={formatUplift(national.uplift_pct)}
          note={`CGT at 2019/20 rules rises from ${formatBn(national.baseline_cgt_bn, 1)} to ${formatBn(national.reform_cgt_bn, 1)} on 2026-27 data (current law: ${formatBn(national.current_law_cgt_bn, 1)}).`}
        />
        <MetricCard
          label="CenTax (2024), rates only"
          value={formatUplift(external.value)}
          note={`+${formatBn(external.details.change_bn, 1)} on a ${formatBn(external.details.baseline_bn, 1)} baseline, 2019/20 data (${external.locator}).`}
        />
      </div>
      <RegionalComparisonChart rows={buildRegionRows(block.regions)} peLabel={dataset.shortLabel} />
      <Notes>
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
  return (
    <section className="section-card">
      <SectionHeading
        title="CenTax's package estimates (a different scope)"
        description="CenTax's headline figures cost equalisation within a wider package of reforms to the CGT base, so they are context rather than like-for-like with a rates-only reform."
      />
      <PackageEstimatesChart rows={buildPackageRows(rows)} />
      <Notes>
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

function ReadyReckoner({ block, dataset, elasticities, onNavigate }) {
  const firstYear = block.hmrc_years[0];
  const rr = buildReckonerRows(block, elasticities.central.id, elasticities.official.id);
  return (
    <section className="section-card">
      <SectionHeading
        title="Rate changes: HMRC ready reckoner (June 2025)"
        description={`HMRC's ready reckoner gives the receipts effect of small CGT rate changes after behavioural responses. Each row compares HMRC's receipts with ${dataset.shortLabel}'s liabilities a year earlier, scored at this dashboard's central elasticity and the official HMRC/OBR one.`}
      />
      <ReadyReckonerChart
        pairs={rr.pairs}
        rows={rr.rows}
        labels={{
          hmrc: "HMRC (receipts)",
          central: `Model, central (${elasticities.central.e_retention.toFixed(1)})`,
          official: `Model, official (${elasticities.official.e_retention}; ${elasticities.official.badr_e_retention} relief)`,
        }}
      />
      <Notes>
        <p>
          Source: <SourceLabel href={block.url} label={block.source} />, {block.locator}.
        </p>
        {block.note
          .split(/(?<=\.)\s+(?=[A-Z])/)
          .map((sentence) => (
            <p key={sentence}>{sentence}</p>
          ))}
        <p>HMRC&apos;s figures are {lowerFirst(block.measure)}.</p>
        <p>
          Receipts arrive about a year after the liability, so HMRC&apos;s receipts in each year are
          compared with the model&apos;s liabilities in the year before.
        </p>
        <p>
          The model figures are the change in government balance on its own data, in the scope of
          the{" "}
          <TabLink onNavigate={onNavigate} tab="reform">
            Reform
          </TabLink>{" "}
          tab&apos;s custom rates (main and residential rates and the relief).
        </p>
        <p>
          {`The model's central elasticity is a retention elasticity of ${elasticities.central.e_retention.toFixed(1)}; the official one is ${elasticities.official.e_retention}, with ${elasticities.official.badr_e_retention} for gains qualifying for the relief.`}
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
          .
        </p>
        <p>
          Not scored:{" "}
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
  return (
    <div className="space-y-6">
      <section>
        <SectionHeading
          size="lg"
          title="How these results compare with other estimates"
          description="Published estimates that score the same reform, or the same kind of rate change, next to this dataset's own figures on the same basis. Estimates that cover a wider package are listed separately as context."
        />
      </section>
      <StaticEqualisation block={benchmarks.static_equalisation} dataset={dataset} />
      <CentaxRegions block={benchmarks.centax_2019_20_rules} dataset={dataset} />
      <CentaxPackage rows={benchmarks.centax_package_context} onNavigate={onNavigate} />
      <ReadyReckoner
        block={benchmarks.ready_reckoner}
        dataset={dataset}
        elasticities={benchmarks.elasticities}
        onNavigate={onNavigate}
      />
      <section className="note-card rounded-lg p-4 text-sm leading-6 text-slate-600">
        <p className="note-eyebrow">Why the elasticity matters</p>
        <p>
          The ready reckoner&apos;s rows, like the reform&apos;s yield, move with the elasticity: the
          chart above scores each row at this dashboard&apos;s central elasticity and at the
          official HMRC/OBR one. The{" "}
          <TabLink onNavigate={onNavigate} tab="methodology" section="elasticity-gap">
            Methodology
          </TabLink>{" "}
          tab explains how the two differ.
        </p>
      </section>
    </div>
  );
}
