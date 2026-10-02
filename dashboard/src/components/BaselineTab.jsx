"use client";

import { formatBn, formatCount, formatPct } from "../lib/formatters";
import {
  getDatasetInfo,
  getEntrants,
  getFirstYear,
  getValidation,
} from "../lib/dataHelpers";
import { MetricCard } from "./controls";
import SectionHeading from "./SectionHeading";

// External benchmarks the baseline is validated against. These are published
// HMRC figures, not model outputs, so they live here rather than in the
// pipeline JSON. Both columns come from the same release (Capital Gains Tax
// statistics, 2026), which carries the revised 2023-24 year and the
// provisional 2024-25 year; the dataset calibrates its capital gains to the
// 2024-25 year.
const TABLE_1 =
  "https://assets.publishing.service.gov.uk/media/6a7b23f1bbafcd1db3b6e420/Table_1_2026_Taxpayer_numbers_gains_and_tax_liabilities.ods";
const TABLE_2 =
  "https://assets.publishing.service.gov.uk/media/6a7b240b423b0bdba0290eca/Table_2_2026_Size_of_gain.ods";
const T1_2023 = "HMRC CGT statistics 2026 release, Table 1 (2023-24, revised)";
const T1_2024 =
  "HMRC CGT statistics 2026 release, Table 1 (2024-25, provisional)";
const T2_2023 =
  "HMRC CGT statistics 2026 release, Table 2.2a (2023-24, revised)";
const T2_2024 =
  "HMRC CGT statistics 2026 release, Table 2.1a (2024-25, provisional)";
const TABLE_4 =
  "https://assets.publishing.service.gov.uk/media/6a7b242a347b198efd290ed7/Table_4_2026_Business_asset_disposal_and_investors_reliefs.ods";
const T4_2023 =
  "HMRC CGT statistics 2026 release, Table 4 (2023-24, individuals)";
const T4_2024 =
  "HMRC CGT statistics 2026 release, Table 4 (2024-25, provisional, individuals)";

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
  // HMRC Table 4 counts claimants of Business Asset Disposal Relief and
  // Investors' Relief together, individuals only (the engine's
  // capital_gains_badr input merges the two reliefs the same way).
  badrClaimants: {
    y2023: { value: "42k", source: T4_2023, url: TABLE_4 },
    y2024: { value: "61k", source: T4_2024, url: TABLE_4 },
  },
  badrGains: {
    y2023: { value: "£11.0bn", source: T4_2023, url: TABLE_4 },
    y2024: { value: "£18.4bn", source: T4_2024, url: TABLE_4 },
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

  return (
    <div className="space-y-6">
      <div className="pt-2">
        <SectionHeading
          size="lg"
          title="Baseline estimation"
          description={`The starting data combine household survey records with capital gains imputed from HMRC statistics. These are model projections for ${firstYear}, compared with earlier HMRC observations.`}
        />
      </div>

      <section className="section-card">
        <SectionHeading
          title="Model versus external benchmarks"
          description="HMRC’s 2024–25 gains were unusually high as disposals were brought forward before the October 2024 rate rises. Different years and definitions limit this comparison."
        />
        <div className="grid gap-4 md:grid-cols-3">
          <MetricCard
            label={`CGT liability · ${firstYear}`}
            value={formatBn(validation.baseline_cgt_revenue_bn, 1)}
            note="HMRC 2024–25: £22.5bn"
          />
          <MetricCard
            label={`Taxable gains · ${firstYear}`}
            value={formatBn(validation.total_gains_bn, 1)}
            note="HMRC 2024–25: £119.3bn"
          />
          <MetricCard
            label={`Taxpayers · ${firstYear}`}
            value={formatCount(validation.cgt_taxpayers)}
            note={`${formatPct(100 * entrantShare, 0)} cross the frozen allowance as gains are uprated.`}
          />
        </div>
        <details className="disclosure">
          <summary>Compare all baseline measures and sources</summary>
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Quantity</th>
                  <th>
                    PolicyEngine ({dataset.shortLabel}, {firstYear})
                  </th>
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
                <BenchmarkRow
                  label="People with gains qualifying for BADR"
                  model={formatCount(validation.badr_claimants)}
                  benchmark={BENCHMARKS.badrClaimants}
                />
                <BenchmarkRow
                  label="Gains qualifying for BADR"
                  model={formatBn(validation.badr_gains_bn)}
                  benchmark={BENCHMARKS.badrGains}
                />
              </tbody>
            </table>
          </div>
        </details>
      </section>
    </div>
  );
}
