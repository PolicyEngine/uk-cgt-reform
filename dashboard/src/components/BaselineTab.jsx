"use client";

import { formatBn, formatCount, formatPct } from "../lib/formatters";
import { getDatasetInfo, getEntrants, getFirstYear, getValidation } from "../lib/dataHelpers";
import SectionHeading from "./SectionHeading";

// External benchmarks the baseline is validated against. These are published
// HMRC figures, not model outputs, so they live here rather than in the
// pipeline JSON. Both columns come from the same release (Capital Gains Tax
// statistics, 2026), which carries the revised 2023-24 year and the
// provisional 2024-25 year; the two datasets calibrate their capital gains to
// one or the other.
const TABLE_1 =
  "https://assets.publishing.service.gov.uk/media/6a7b23f1bbafcd1db3b6e420/Table_1_2026_Taxpayer_numbers_gains_and_tax_liabilities.ods";
const TABLE_2 =
  "https://assets.publishing.service.gov.uk/media/6a7b240b423b0bdba0290eca/Table_2_2026_Size_of_gain.ods";
const T1_2023 = "HMRC CGT statistics 2026 release, Table 1 (2023-24, revised)";
const T1_2024 = "HMRC CGT statistics 2026 release, Table 1 (2024-25, provisional)";
const T2_2023 = "HMRC CGT statistics 2026 release, Table 2.2a (2023-24, revised)";
const T2_2024 = "HMRC CGT statistics 2026 release, Table 2.1a (2024-25, provisional)";

const BENCHMARKS = {
  totalGains: {
    y2023: { value: "£66.6bn", source: T1_2023, url: TABLE_1 },
    y2024: { value: "£119.3bn", source: T1_2024, url: TABLE_1 },
  },
  taxpayers: {
    y2023: { value: "382k", source: T1_2023, url: TABLE_1 },
    y2024: { value: "551k", source: T1_2024, url: TABLE_1 },
  },
  liability: {
    y2023: { value: "£12.1bn", source: T1_2023, url: TABLE_1 },
    y2024: { value: "£22.5bn", source: T1_2024, url: TABLE_1 },
  },
  // Shares are ratios within Table 2's bands: gains of £1m+ were £40.4bn of
  // £66.6bn in 2023-24 and £77.8bn of £119.3bn in 2024-25; £5m+ were £23.6bn
  // and £48.5bn.
  shareOver1m: {
    y2023: { value: "61%", source: T2_2023, url: TABLE_2 },
    y2024: { value: "65%", source: T2_2024, url: TABLE_2 },
  },
  shareOver5m: {
    y2023: { value: "35%", source: T2_2023, url: TABLE_2 },
    y2024: { value: "41%", source: T2_2024, url: TABLE_2 },
  },
  taxpayersOver500k: {
    y2023: { value: "19k", source: T2_2023, url: TABLE_2 },
    y2024: { value: "33k", source: T2_2024, url: TABLE_2 },
  },
  gainsOver500k: {
    y2023: { value: "£46.5bn", source: T2_2023, url: TABLE_2 },
    y2024: { value: "£89.1bn", source: T2_2024, url: TABLE_2 },
  },
  gainsOver5m: {
    y2023: { value: "£23.6bn", source: T2_2023, url: TABLE_2 },
    y2024: { value: "£48.5bn", source: T2_2024, url: TABLE_2 },
  },
};

function BenchmarkCell({ benchmark }) {
  if (!benchmark) {
    return <td className="text-slate-400">—</td>;
  }
  return (
    <td>
      <a
        href={benchmark.url}
        target="_blank"
        rel="noopener noreferrer"
        className="underline decoration-1 underline-offset-2 hover:opacity-80"
        title={benchmark.source}
      >
        {benchmark.value}
      </a>
    </td>
  );
}

function BenchmarkRow({ label, model, benchmark, muted = false }) {
  return (
    <tr className={muted ? "text-slate-500" : ""}>
      <td className={muted ? "pl-6" : ""}>{label}</td>
      <td>{model}</td>
      <BenchmarkCell benchmark={benchmark.y2023} />
      <BenchmarkCell benchmark={benchmark.y2024} />
    </tr>
  );
}

const NO_BENCHMARK = { y2023: null, y2024: null };

export default function BaselineTab({ data }) {
  const validation = getValidation(data);
  const dataset = getDatasetInfo(data);
  const entrants = getEntrants(data);
  const firstYear = getFirstYear(data);
  const entrantShare = entrants.count / validation.cgt_taxpayers;
  const schedules = [
    ["Residential property", validation.residential_property_gains_bn],
    ["Business Asset Disposal Relief", validation.badr_gains_bn],
    ["Carried interest", validation.carried_interest_gains_bn],
  ];

  return (
    <div className="space-y-6">
      <div className="pt-2">
        <SectionHeading
          size="lg"
          title="Baseline estimation"
          description={`The Family Resources Survey barely captures capital gains, so each dataset imputes them from HMRC administrative data and calibrates household weights to HMRC's CGT statistics. This analysis uses ${dataset.shortLabel} exactly as published (${dataset.producer}), with no local reweighting: calibration belongs upstream in the data, not in an analysis repository. The tables below show the fit for the first simulated year and the two features that most affect how its numbers read: the entrants by uprating and the schedule components.`}
        />
      </div>

      <section className="section-card">
        <SectionHeading
          title="Model versus external benchmarks"
          description={`PolicyEngine's baseline for ${firstYear} on ${dataset.shortLabel}, alongside HMRC's statistics for the 2023-24 tax year (revised) and the provisional 2024-25 tax year, both from the 2026 release. The vintages differ by design: each dataset calibrates its base year to one HMRC year (${dataset.observation}) and the engine uprates it to the simulated years. HMRC's 2024-25 figures are far above 2023-24 because the rate rises announced in October 2024 brought disposals forward.`}
        />
        <table className="data-table">
          <thead>
            <tr>
              <th>Quantity</th>
              <th>PolicyEngine ({dataset.shortLabel}, {firstYear})</th>
              <th>HMRC, 2023-24 (revised)</th>
              <th>HMRC, 2024-25 (provisional)</th>
            </tr>
          </thead>
          <tbody>
            <BenchmarkRow
              label="Total taxable gains"
              model={formatBn(validation.total_gains_bn)}
              benchmark={BENCHMARKS.totalGains}
            />
            <BenchmarkRow
              label="of which held by entrants by uprating"
              model={formatBn(entrants.gains_bn)}
              benchmark={NO_BENCHMARK}
              muted
            />
            <BenchmarkRow
              label="CGT taxpayers (gains above the exempt amount)"
              model={formatCount(validation.cgt_taxpayers)}
              benchmark={BENCHMARKS.taxpayers}
            />
            <BenchmarkRow
              label="of which entrants by uprating"
              model={formatCount(entrants.count)}
              benchmark={NO_BENCHMARK}
              muted
            />
            <BenchmarkRow
              label="Baseline CGT liability"
              model={formatBn(validation.baseline_cgt_revenue_bn)}
              benchmark={BENCHMARKS.liability}
            />
            <BenchmarkRow
              label="of which paid by entrants by uprating"
              model={formatBn(entrants.cgt_bn)}
              benchmark={NO_BENCHMARK}
              muted
            />
            <BenchmarkRow
              label="Share of gains from gains of £1m or more"
              model={formatPct(validation.share_gains_over_1m_pct, 0)}
              benchmark={BENCHMARKS.shareOver1m}
            />
            <BenchmarkRow
              label="Share of gains from gains of £5m or more"
              model={formatPct(validation.share_gains_over_5m_pct, 0)}
              benchmark={BENCHMARKS.shareOver5m}
            />
            <BenchmarkRow
              label="Taxpayers with gains over £500k"
              model={formatCount(validation.taxpayers_over_500k)}
              benchmark={BENCHMARKS.taxpayersOver500k}
            />
            <BenchmarkRow
              label="Gains held by taxpayers with gains over £500k"
              model={formatBn(validation.gains_over_500k_bn)}
              benchmark={BENCHMARKS.gainsOver500k}
            />
            <BenchmarkRow
              label="Gains held in the £5m-and-over band"
              model={formatBn(validation.gains_over_5m_bn)}
              benchmark={BENCHMARKS.gainsOver5m}
            />
          </tbody>
        </table>
      </section>

      <section className="section-card">
        <SectionHeading
          title="Entrants by uprating"
          description={`The annual exempt amount is frozen at £${entrants.exempt_amount_gbp.toLocaleString("en-GB")} while the engine uprates gains with GDP per capita, so a person whose base-year gains sit at or below the exempt amount can cross it in a later year and count as a CGT taxpayer with a few hundred pounds of taxable gain. Entrants are persons whose pre-response gains in ${firstYear} exceed the exempt amount but not £${Math.round(entrants.ceiling_gbp).toLocaleString("en-GB")}, the base-year exempt amount carried forward by the uprating, so they were not taxpayers in the base year. Nothing is removed or edited; the figures are reported so a reader can net them out.`}
        />
        <table className="data-table">
          <thead>
            <tr>
              <th>Quantity, {firstYear}</th>
              <th>All CGT taxpayers</th>
              <th>Entrants by uprating</th>
              <th>Excluding entrants</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Taxpayers</td>
              <td>{formatCount(validation.cgt_taxpayers)}</td>
              <td>
                {formatCount(entrants.count)} ({formatPct(100 * entrantShare, 0)})
              </td>
              <td>{formatCount(validation.cgt_taxpayers_excluding_entrants)}</td>
            </tr>
            <tr>
              <td>Taxable gains</td>
              <td>{formatBn(validation.total_gains_bn)}</td>
              <td>{formatBn(entrants.gains_bn)}</td>
              <td>{formatBn(validation.total_gains_excluding_entrants_bn)}</td>
            </tr>
            <tr>
              <td>Baseline CGT liability</td>
              <td>{formatBn(validation.baseline_cgt_revenue_bn)}</td>
              <td>{formatBn(entrants.cgt_bn)}</td>
              <td>{formatBn(validation.baseline_cgt_revenue_bn - entrants.cgt_bn)}</td>
            </tr>
          </tbody>
        </table>
        {entrantShare > 0.05 ? (
          <p className="note-card mt-4 rounded-lg p-4 text-sm leading-6 text-slate-600">
            <span className="note-eyebrow block text-xs font-semibold uppercase tracking-wide">
              Read with care
            </span>
            On this dataset {formatPct(100 * entrantShare, 0)} of the {firstYear} CGT taxpayers
            are entrants by uprating. {dataset.notes} The share of people the reform touches,
            and every count in this tab, is dominated by that group; the gains and liability
            totals are not, because each entrant carries only a few hundred pounds above the
            exempt amount.
          </p>
        ) : (
          <p className="mt-4 text-sm leading-6 text-slate-600">
            Entrants are a small share of this dataset&apos;s taxpayers, so the headline counts
            read as taxpayers in the ordinary sense.
          </p>
        )}
      </section>

      <section className="section-card">
        <SectionHeading
          title="Schedule components"
          description={`policyengine-uk charges residential property, carried interest and Business Asset Disposal Relief gains on their own schedules when a dataset records them; the reform equalises every schedule. Gains recorded on each schedule in ${firstYear}, before any behavioural response.`}
        />
        <table className="data-table">
          <thead>
            <tr>
              <th>Schedule</th>
              <th>Gains, {firstYear}</th>
              <th>Recorded in {dataset.shortLabel}?</th>
            </tr>
          </thead>
          <tbody>
            {schedules.map(([name, gains]) => (
              <tr key={name}>
                <td>{name}</td>
                <td>{formatBn(gains)}</td>
                <td>{gains > 0 ? "Yes" : "No: charged on the main schedule"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
