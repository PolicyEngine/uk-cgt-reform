"use client";

import { useEffect } from "react";
import { formatBn, formatCount, formatPct, formatSmallBn } from "../lib/formatters";
import { getDatasetInfo, getEntrants, getFirstYear, getValidation } from "../lib/dataHelpers";
import { MetricCard, SourceLink } from "./controls";
import BenchmarkChart, { parseBenchmark } from "./charts/BenchmarkChart";
import ScheduleChart from "./charts/ScheduleChart";
import SectionHeading from "./SectionHeading";

// External benchmarks the baseline is compared with. These are published
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
const T1_2024 = "HMRC CGT statistics 2026 release, Table 1 (2024-25, provisional)";
const T2_2023 = "HMRC CGT statistics 2026 release, Table 2.2a (2023-24, revised)";
const T2_2024 = "HMRC CGT statistics 2026 release, Table 2.1a (2024-25, provisional)";
const TABLE_4 =
  "https://assets.publishing.service.gov.uk/media/6a7b242a347b198efd290ed7/Table_4_2026_Business_asset_disposal_and_investors_reliefs.ods";
const T4_2023 = "HMRC CGT statistics 2026 release, Table 4 (2023-24, individuals)";
const T4_2024 = "HMRC CGT statistics 2026 release, Table 4 (2024-25, provisional, individuals)";
const CGT_STATISTICS = "https://www.gov.uk/government/statistics/capital-gains-tax-statistics";
const FRS = "https://www.gov.uk/government/collections/family-resources-survey--2";
const EXEMPT_AMOUNT = "https://www.gov.uk/capital-gains-tax/allowances";
const BADR_GUIDANCE = "https://www.gov.uk/business-asset-disposal-relief";
const CGT_RATES = "https://www.gov.uk/capital-gains-tax/rates";

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

export default function BaselineTab({ data, anchor }) {
  // Other tabs link to a section here (``anchor``); the tab mounts after
  // navigation, so the scroll is replayed once it has.
  useEffect(() => {
    if (!anchor) return;
    const element = document.getElementById(anchor);
    if (element?.tagName === "DETAILS") element.open = true;
    element?.scrollIntoView();
  }, [anchor]);

  const validation = getValidation(data);
  const dataset = getDatasetInfo(data);
  const entrants = getEntrants(data);
  const firstYear = getFirstYear(data);
  const entrantShare = entrants.count / validation.cgt_taxpayers;
  const bench = (group, key, label, unit, model) => ({
    group,
    key,
    label,
    unit,
    model,
    hmrc2024: parseBenchmark(BENCHMARKS[key].y2024?.value),
  });
  const benchmarkRows = [
    bench("Overall", "totalGains", "Total taxable gains", "bn", validation.total_gains_bn),
    bench("Overall", "taxpayers", "CGT taxpayers", "count", validation.cgt_taxpayers),
    bench("Overall", "liability", "Baseline CGT liability", "bn", validation.baseline_cgt_revenue_bn),
    bench("Large gains", "shareOver1m", "Share of gains from gains of £1m or more", "pct", validation.share_gains_over_1m_pct),
    bench("Large gains", "shareOver5m", "Share of gains from gains of £5m or more", "pct", validation.share_gains_over_5m_pct),
    bench("Large gains", "taxpayersOver500k", "Taxpayers with gains over £500k", "count", validation.taxpayers_over_500k),
    bench("Large gains", "gainsOver500k", "Gains held by taxpayers with gains over £500k", "bn", validation.gains_over_500k_bn),
    bench("Large gains", "gainsOver5m", "Gains held in the £5m-and-over band", "bn", validation.gains_over_5m_bn),
    bench("Business Asset Disposal Relief", "badrClaimants", "People with qualifying gains", "count", validation.badr_claimants),
    bench("Business Asset Disposal Relief", "badrGains", "Qualifying gains", "bn", validation.badr_gains_bn),
  ];
  // A tiny share still reads as a number: "0.47%", "0.006%", "<0.001%".
  const formatShare = (share) => {
    const pct = 100 * share;
    if (pct < 0.001) return "<0.001%";
    return `${pct.toPrecision(pct < 1 ? 1 : 2)}%`;
  };
  const entrantRows = [
    { key: "taxpayers", label: "Taxpayers", unit: "count", total: validation.cgt_taxpayers, entrants: entrants.count },
    { key: "gains", label: "Taxable gains", unit: "bn", total: validation.total_gains_bn, entrants: entrants.gains_bn },
    { key: "liability", label: "Baseline CGT liability", unit: "bn", total: validation.baseline_cgt_revenue_bn, entrants: entrants.cgt_bn },
  ];
  const scheduleRows = [
    { key: "residential", label: "Residential property", gainsBn: validation.residential_property_gains_bn },
    { key: "badr", label: "Business Asset Disposal Relief", gainsBn: validation.badr_gains_bn },
  ];

  return (
    <div className="space-y-6">
      <div className="pt-2">
        <SectionHeading
          size="lg"
          title="Baseline estimation"
          description={
            <>
              The Family Resources <SourceLink href={FRS}>Survey</SourceLink> records few capital
              gains, so the dataset imputes them from HMRC data and weights households to
              HMRC&apos;s CGT <SourceLink href={CGT_STATISTICS}>statistics</SourceLink>. The charts
              below check that fit and two features that affect how the figures read.
            </>
          }
        />
      </div>

      <section className="section-card scroll-mt-24" id="benchmarks">
        <SectionHeading
          title="Model and HMRC statistics"
          description={
            <>
              PolicyEngine&apos;s {firstYear} baseline beside HMRC&apos;s{" "}
              <SourceLink href={CGT_STATISTICS}>statistics</SourceLink> for 2024-25 (provisional).{" "}
              {`Liabilities are higher relative to gains in ${firstYear} because CGT `}
              <SourceLink href={CGT_RATES}>rates</SourceLink>
              {" rose from 10% and 20% to 18% and 24% partway through 2024-25."}
            </>
          }
        />
        <BenchmarkChart rows={benchmarkRows} modelLabel={`PolicyEngine (${dataset.shortLabel}, ${firstYear})`} />
      </section>

      <details className="section-card group scroll-mt-24" id="entrants">
        <summary className="cursor-pointer select-none text-xl font-semibold tracking-tight text-slate-900 marker:text-[color:var(--pe-color-primary-600)]">
          Entrants by uprating
        </summary>
        <div className="mb-5 mt-2 text-sm leading-6 text-slate-600">
          <>
              The exempt <SourceLink href={EXEMPT_AMOUNT}>amount</SourceLink>{" "}
              {`stays at £${entrants.exempt_amount_gbp.toLocaleString("en-GB")} while gains grow with the economy, so some people with gains below it become CGT taxpayers in later years. These entrants, with ${firstYear} gains between £${entrants.exempt_amount_gbp.toLocaleString("en-GB")} and £${Math.round(entrants.ceiling_gbp).toLocaleString("en-GB")}, are shown separately so they can be netted out.${entrantShare > 0.05 ? "" : " They are under 5% of taxpayers, so the headline counts read as taxpayers in the ordinary sense."}`}
            </>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {entrantRows.map((row) => (
            <MetricCard
              key={row.key}
              label={`${row.label} from entrants`}
              value={row.unit === "count" ? formatCount(row.entrants) : formatSmallBn(row.entrants)}
              note={`Of ${row.unit === "count" ? formatCount(row.total) : formatBn(row.total, 1)} in all (${formatShare(row.entrants / row.total)}).`}
            />
          ))}
        </div>
        {entrantShare > 0.05 ? (
          <p className="note-card mt-4 rounded-lg p-4 text-sm leading-6 text-slate-600">
            <span className="note-eyebrow block text-xs font-semibold uppercase tracking-wide">
              Read with care
            </span>
            On this dataset {formatPct(100 * entrantShare, 0)} of the {firstYear} CGT taxpayers
            are entrants by uprating. {dataset.notes} The share of people the reform touches,
            and every count in this tab, mostly reflects that group; the gains and liability
            totals do not, because each entrant has a few hundred pounds of gains above the
            exempt amount.
          </p>
        ) : null}
      </details>

      <details className="section-card group scroll-mt-24" id="schedules">
        <summary className="cursor-pointer select-none text-xl font-semibold tracking-tight text-slate-900 marker:text-[color:var(--pe-color-primary-600)]">
          Schedule components
        </summary>
        <div className="mb-5 mt-2 text-sm leading-6 text-slate-600">
          <>
              <SourceLink href="https://github.com/PolicyEngine/policyengine-uk">
                policyengine-uk
              </SourceLink>{" "}
              charges residential property and Business Asset Disposal{" "}
              <SourceLink href={BADR_GUIDANCE}>Relief</SourceLink> gains on their own schedules
              when a dataset records them. Gains recorded on each schedule in {firstYear}, before
              any behavioural response.
            </>
        </div>
        <ScheduleChart rows={scheduleRows} datasetLabel={dataset.shortLabel} />
      </details>
    </div>
  );
}
