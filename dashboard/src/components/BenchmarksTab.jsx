"use client";

import { getBenchmarks, getDatasetInfo, getSensitivity } from "../lib/dataHelpers";
import { formatBn, formatPct, formatSignedBn, formatSignedMn } from "../lib/formatters";
import { MetricCard, SourceLink, TipHeader } from "./controls";
import SectionHeading from "./SectionHeading";

// Published estimates next to this dataset's own figures on the same basis
// (issue #7). Every external number comes from the results file's
// `benchmarks` block, which the pipeline builds from comparison.py.

function formatUplift(value) {
  if (value === null || value === undefined) return "—";
  const sign = value < 0 ? "−" : "+";
  return `${sign}${Math.abs(value).toFixed(0)}%`;
}

function Dash() {
  return <span className="text-slate-400">—</span>;
}

function StaticEqualisation({ block, dataset }) {
  const jrf = Object.fromEntries(block.external.map((row) => [row.year, row]));
  const source = block.external[0];
  return (
    <section className="section-card">
      <SectionHeading
        title="Equalisation before behavioural responses: JRF (2026)"
        description={`The Joseph Rowntree Foundation estimates that equalising CGT with income tax rates raises about £${jrf["2026-27"].value.toFixed(0)}bn in 2026-27 and £${jrf["2029-30"].value.toFixed(0)}bn in 2029-30 (2026/27 prices) before any behavioural response. It applies HMRC's CGT statistics by income band to the OBR's March 2026 CGT projection. Because that method scales the OBR's receipts, the last model column applies ${dataset.shortLabel}'s static uplift to the same OBR receipts, which separates the uplift from the dataset's own baseline level.`}
      />
      <div className="table-scroll mt-4 overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Year</th>
              <th>Baseline CGT liability</th>
              <th>Static change</th>
              <TipHeader
                label="Uplift"
                tip="Static change in CGT liability as a share of the baseline liability."
              />
              <th>Static change, 2026/27 prices</th>
              <TipHeader
                label="Uplift on OBR receipts, 2026/27 prices"
                tip={`The uplift applied to the OBR's CGT receipts forecast (${block.obr_receipts_source}), JRF's method.`}
              />
              <th>JRF, 2026/27 prices</th>
            </tr>
          </thead>
          <tbody>
            {block.by_year.map((row) => (
              <tr key={row.year}>
                <td>{row.year}</td>
                <td>{formatBn(row.baseline_cgt_bn, 1)}</td>
                <td>{formatSignedBn(row.static_cgt_change_bn, 1)}</td>
                <td>{formatUplift(row.static_uplift_pct)}</td>
                <td>{formatSignedBn(row.static_cgt_change_real_bn, 1)}</td>
                <td>
                  {row.uplift_on_obr_receipts_real_bn === null ? (
                    <Dash />
                  ) : (
                    formatSignedBn(row.uplift_on_obr_receipts_real_bn, 1)
                  )}
                </td>
                <td className="font-semibold">
                  {jrf[row.year] ? `about ${formatBn(jrf[row.year].value, 0)}` : <Dash />}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs leading-5 text-slate-500">
        Source: <SourceLink href={source.url}>{source.source}</SourceLink>, 29 June 2026,{" "}
        {source.locator.toLowerCase()}. JRF uses grouped statistics rather than microdata and does
        not state its deflator; this table deflates with the OBR's CPI path from the March 2026 EFO.
        Model figures are liabilities in the year; the OBR figures are cash receipts.
      </p>
    </section>
  );
}

function CentaxRegions({ block, dataset }) {
  const national = block.national;
  const external = block.external;
  return (
    <section className="section-card">
      <SectionHeading
        title="Equalisation at 2019/20 rules: CenTax (2024)"
        description={`CenTax's rates-only estimate starts from 2019/20 rules: main rates of 10% and 20%, 18% and 28% for residential property and carried interest, and a £12,000 exempt amount. To compare like with like, this dashboard applies those rules to ${dataset.shortLabel}'s 2026-27 data, with no behavioural response, and equalises from there.`}
      />
      <div className="mt-4 grid gap-4 md:grid-cols-2">
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
      <div className="table-scroll mt-5 overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Region</th>
              <th>Share of baseline CGT, {dataset.shortLabel}</th>
              <th>Share of baseline CGT, CenTax</th>
              <th>Uplift, {dataset.shortLabel}</th>
              <th>Uplift, CenTax</th>
            </tr>
          </thead>
          <tbody>
            {block.regions.map((row) => (
              <tr key={row.region}>
                <td>{row.region}</td>
                <td>{formatPct(row.baseline_share_pct, 1)}</td>
                <td>{formatPct(row.centax_baseline_share_pct, 1)}</td>
                <td>{formatUplift(row.uplift_pct)}</td>
                <td>{formatUplift(row.centax_uplift_pct)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="note-card mt-4 rounded-lg p-4 text-sm leading-6 text-slate-600">
        <p className="note-eyebrow">Read with care</p>
        <p>
          The counterfactual applies 2019/20 CGT rules to 2026-27 incomes, income tax thresholds and
          gains, with the £12,000 exempt amount in 2026 money. CenTax covers resident individuals
          only (it puts the omitted trusts and non-residents at about 5% of revenue) and counts CGT
          and income tax together. Its regions are taxpayers&apos; regions of residence; these are
          households&apos; regions. A dataset that records no residential property gains charges
          every gain at the main rates in both runs.
        </p>
        <p className="mt-2">
          Sources: <SourceLink href={external.url}>{external.source}</SourceLink>,{" "}
          {external.locator} and {block.external_regions.locator}.
        </p>
      </div>
    </section>
  );
}

function packageValue(row) {
  if (row.id === "centax_2024_table6_package_range") {
    return row.details.by_retention_elasticity
      .map((entry) => `${formatBn(entry.value, 1)} at ${entry.retention_elasticity.toFixed(1)}`)
      .join(", ");
  }
  if (row.details?.uplift_pct) {
    return `${formatBn(row.value, 1)} (+${row.details.uplift_pct}%)`;
  }
  if (row.details?.with_carried_interest_bn) {
    return `${formatBn(row.value, 1)} (${formatBn(row.details.with_carried_interest_bn, 1)} with carried interest)`;
  }
  return formatBn(row.value, 1);
}

function CentaxPackage({ rows }) {
  return (
    <section className="section-card">
      <SectionHeading
        title="CenTax's package estimates (a different scope)"
        description="CenTax's headline figures add an investment allowance, the removal of the death uplift and a charge on departure to equalisation, so they are not like-for-like with a rates-only reform. They are listed as context."
      />
      <div className="table-scroll mt-4 overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Estimate</th>
              <th>Year</th>
              <th>Revenue, after behavioural responses</th>
              <th>Note</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>
                  <SourceLink href={row.url}>{row.source}</SourceLink>
                  <span className="block text-xs text-slate-500">{row.locator}</span>
                </td>
                <td>{row.year}</td>
                <td className="whitespace-nowrap">{packageValue(row)}</td>
                <td className="text-xs leading-5 text-slate-500">{row.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ReadyReckoner({ block, dataset }) {
  const [first, second] = block.lag;
  const model = (row, elasticityId, year) => row.model_m[elasticityId][year];
  return (
    <section className="section-card">
      <SectionHeading
        title="Rate changes: HMRC ready reckoner (June 2025)"
        description={`HMRC's ready reckoner gives the Exchequer effect of small changes to CGT rates after behavioural responses. Its figures are receipts, which arrive about a year after the liability, so each row compares HMRC's receipts in ${first.hmrc_year} and ${second.hmrc_year} with ${dataset.shortLabel}'s liabilities in ${first.model_year} and ${second.model_year}. The model scores each row at this dashboard's central elasticity and at the official HMRC/OBR one.`}
      />
      <div className="table-scroll mt-4 overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th rowSpan={2}>Change from April 2026</th>
              <th rowSpan={2}>HMRC, {block.hmrc_years[0]}</th>
              <th colSpan={3}>
                HMRC {first.hmrc_year} vs model {first.model_year}
              </th>
              <th colSpan={3}>
                HMRC {second.hmrc_year} vs model {second.model_year}
              </th>
            </tr>
            <tr>
              <th>HMRC</th>
              <th>Central (e = −0.7)</th>
              <th>Official (retention 3.6)</th>
              <th>HMRC</th>
              <th>Central (e = −0.7)</th>
              <th>Official (retention 3.6)</th>
            </tr>
          </thead>
          <tbody>
            {block.rows.map((row) => (
              <tr key={row.id}>
                <td>{row.label}</td>
                <td className="text-slate-500">{formatSignedMn(row.hmrc_m[block.hmrc_years[0]])}</td>
                <td className="font-semibold">{formatSignedMn(row.hmrc_m[first.hmrc_year])}</td>
                <td>{formatSignedMn(model(row, "centax_central", first.model_year))}</td>
                <td>{formatSignedMn(model(row, "official", first.model_year))}</td>
                <td className="font-semibold">{formatSignedMn(row.hmrc_m[second.hmrc_year])}</td>
                <td>{formatSignedMn(model(row, "centax_central", second.model_year))}</td>
                <td>{formatSignedMn(model(row, "official", second.model_year))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs leading-5 text-slate-500">
        Source: <SourceLink href={block.url}>{block.source}</SourceLink>, {block.locator}. {block.note}{" "}
        HMRC&apos;s figures include income tax and stamp duty land tax effects and are built on the
        OBR&apos;s March 2025 forecast; the model figures are the change in government balance on
        its own data, in the Rate explorer&apos;s scope (main and residential rates). Not scored:{" "}
        {block.excluded
          .map((row) => {
            const reason = row.reason.replace(/\.$/, "");
            return `${row.hmrc_label} (${reason[0].toLowerCase()}${reason.slice(1)})`;
          })
          .join("; ")}
        .
      </p>
    </section>
  );
}

export default function BenchmarksTab({ data, onNavigate }) {
  const benchmarks = getBenchmarks(data);
  const dataset = getDatasetInfo(data);
  const official = getSensitivity(data).find(
    (row) => row.e_mtr === benchmarks.elasticities.official.e_mtr,
  );
  const central = getSensitivity(data).find(
    (row) => row.e_mtr === benchmarks.elasticities.central.e_mtr,
  );
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
      <CentaxPackage rows={benchmarks.centax_package_context} />
      <ReadyReckoner block={benchmarks.ready_reckoner} dataset={dataset} />
      <section className="note-card rounded-lg p-4 text-sm leading-6 text-slate-600">
        <p className="note-eyebrow">Why the elasticity matters</p>
        <p>
          The official HMRC/OBR assumption is a retention-rate elasticity of{" "}
          {benchmarks.elasticities.official.e_retention}, against CenTax&apos;s central{" "}
          {benchmarks.elasticities.central.e_retention.toFixed(1)} behind this dashboard&apos;s central
          case. On {dataset.shortLabel}, equalisation changes CGT revenue in 2026-27 by{" "}
          {formatSignedBn(central.revenue_2026_bn, 1)} at the central elasticity and by{" "}
          {formatSignedBn(official.revenue_2026_bn, 1)} at the official one.{" "}
          <button
            type="button"
            onClick={() => onNavigate("methodology", "elasticity-gap")}
            className="font-semibold text-[color:var(--pe-color-primary-600)] underline decoration-1 underline-offset-2 hover:opacity-80"
          >
            The Methodology tab explains the difference.
          </button>
        </p>
      </section>
    </div>
  );
}
