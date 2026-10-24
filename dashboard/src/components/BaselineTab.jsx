"use client";

import { useEffect } from "react";
import { getBaselineComparison, getDatasetInfo } from "../lib/dataHelpers";
import { formatBn } from "../lib/formatters";
import { Notes, SourceLink } from "./controls";
import BenchmarkChart, { parseBenchmark } from "./charts/BenchmarkChart";
import BenchmarksTab from "./BenchmarksTab";
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

export default function BaselineTab({ data, anchor, onNavigate }) {
  // Other tabs link to a section here (``anchor``); the tab mounts after
  // navigation, so the scroll is replayed once it has.
  useEffect(() => {
    if (!anchor) return;
    const element = document.getElementById(anchor);
    if (element?.tagName === "DETAILS") element.open = true;
    element?.scrollIntoView();
  }, [anchor]);

  // PolicyEngine in HMRC's own year: 2024-25, the dataset's own year, with
  // no projection (the pipeline's ``baseline_comparison`` block).
  const comparison = getBaselineComparison(data);
  const validation = comparison.validation;
  const dataset = getDatasetInfo(data);
  const modelYear = comparison.year;
  const rates = comparison.rates;
  const liability = comparison.liability_bn;
  const bench = (group, key, label, unit, model) => ({
    group,
    key,
    label,
    unit,
    model,
    hmrc2024: parseBenchmark(BENCHMARKS[key].y2024?.value),
  });
  // The liability under each rate schedule for the year: the main rates in
  // force before 30 October 2024 for the whole year, and those after it.
  const liabilityTip = liability
    ? `Charged at the main rates in force before 30 October 2024 (10% and 20%) for the whole year, PolicyEngine's ${modelYear} liability would be ${formatBn(liability.pre_30_october_rates_all_year, 1)}; at the rates from that date (18% and 24%), ${formatBn(liability.post_30_october_rates_all_year, 1)}. The notes below give the schedule PolicyEngine applies.`
    : null;
  const pct1 = (rate) => `${(100 * rate).toFixed(1)}%`;
  const benchmarkRows = [
    bench("Overall", "totalGains", "Total taxable gains", "bn", validation.total_gains_bn),
    bench("Overall", "taxpayers", "CGT taxpayers", "count", validation.cgt_taxpayers),
    {
      ...bench("Overall", "liability", "Baseline CGT liability", "bn", validation.baseline_cgt_revenue_bn),
      tip: liabilityTip,
    },
    bench("Large gains", "shareOver1m", "Share of gains from gains of £1m or more", "pct", validation.share_gains_over_1m_pct),
    bench("Large gains", "shareOver5m", "Share of gains from gains of £5m or more", "pct", validation.share_gains_over_5m_pct),
    bench("Large gains", "taxpayersOver500k", "Taxpayers with gains over £500k", "count", validation.taxpayers_over_500k),
    bench("Large gains", "gainsOver500k", "Gains held by taxpayers with gains over £500k", "bn", validation.gains_over_500k_bn),
    bench("Large gains", "gainsOver5m", "Gains held in the £5m-and-over band", "bn", validation.gains_over_5m_bn),
    bench("Business Asset Disposal Relief", "badrClaimants", "People with qualifying gains", "count", validation.badr_claimants),
    bench("Business Asset Disposal Relief", "badrGains", "Qualifying gains", "bn", validation.badr_gains_bn),
  ];
  // The comparisons' intro and at-a-glance row come first; this tab's own
  // check against HMRC's statistics sits under them, before the comparisons
  // with other published estimates.
  return (
    <BenchmarksTab
      data={data}
      onNavigate={onNavigate}
      baselineGlance={{
        modelYear,
        hmrcYear: "2024-25",
        url: CGT_STATISTICS,
        gains: { model: validation.total_gains_bn, hmrc: BENCHMARKS.totalGains.y2024.value },
        liability: { model: validation.baseline_cgt_revenue_bn, hmrc: BENCHMARKS.liability.y2024.value },
      }}
    >
      <section className="section-card scroll-mt-24" id="benchmarks">
        <SectionHeading
          title={`Baseline: PolicyEngine ${modelYear} and HMRC 2024-25`}
          description={
            <>
              PolicyEngine&apos;s baseline beside HMRC&apos;s{" "}
              <SourceLink href={CGT_STATISTICS}>statistics</SourceLink>, which are provisional for
              that year.
            </>
          }
        />
        <BenchmarkChart
          rows={benchmarkRows}
          modelLabel={`PolicyEngine ${modelYear} (${dataset.shortLabel})`}
          modelColumn={`PolicyEngine ${modelYear}`}
        />
        <Notes>
          <p>
            The Family Resources <SourceLink href={FRS}>Survey</SourceLink> records few capital
            gains, so the dataset imputes them from HMRC data and weights households to
            HMRC&apos;s CGT <SourceLink href={CGT_STATISTICS}>statistics</SourceLink>.
          </p>
          <p>
            {`PolicyEngine's figures are for ${modelYear}, the dataset's own year, with no projection; the Reform tab's figures start in 2027-28.`}
          </p>
          {rates?.main_blended ? (
            <p>
              {"The main CGT "}
              <SourceLink href={CGT_RATES}>rates</SourceLink>
              {` rose from 10% and 20% to 18% and 24% on 30 October 2024. PolicyEngine applies one schedule to the whole of ${modelYear}: main rates of ${pct1(rates.main.basic_rate)} and ${pct1(rates.main.higher_rate)}, the average of the two weighted by days. HMRC's figures follow when each gain was realised; HMRC publishes no split of the year by disposal date, so the model does not split it.`}
            </p>
          ) : null}
        </Notes>
      </section>
    </BenchmarksTab>
  );
}
