"use client";

import { Fragment, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { colors } from "../lib/colors";
import {
  formatBn,
  formatCount,
  formatCurrency,
  formatPct,
  formatSignedBn,
  formatSignedCurrency,
  formatSignedPct,
} from "../lib/formatters";
import ChartLogo from "./ChartLogo";
import SectionHeading from "./SectionHeading";

const AXIS_STYLE = { fontSize: 12, fill: colors.gray[500] };

// Validation metrics that are not £bn amounts.
const METRIC_FORMATS = {
  cgt_taxpayers: formatCount,
  "entrants_by_uprating.count": formatCount,
  cgt_taxpayers_excluding_entrants: formatCount,
  taxpayers_over_500k: formatCount,
  mean_gain: formatCurrency,
  median_gain: formatCurrency,
  share_gains_over_1m_pct: (v) => formatPct(v, 0),
  share_gains_over_5m_pct: (v) => formatPct(v, 0),
  largest_gain_m: (v) => `£${Number(v).toFixed(1)}m`,
};

function formatMetric(metric, value) {
  if (value === null || value === undefined) return "—";
  const format = METRIC_FORMATS[metric];
  return format ? format(value) : formatBn(value, 2);
}

// Columns: the incumbent first, then the candidate.
function orderedKeys(comparison) {
  return Object.keys(comparison.datasets).sort((a, b) => {
    const rank = (key) => (comparison.datasets[key].dataset_role === "incumbent" ? 0 : 1);
    return rank(a) - rank(b);
  });
}

const FILLS = { incumbent: colors.gray[400], candidate: colors.primary[600] };

// Published counterparts of the headline measures. Outturns describe the tax
// year stated (HMRC Capital Gains Tax statistics, 2026 release); the OBR
// receipts are the only projected figures; the yield estimates describe
// similar, not identical, reforms.
const HMRC_TABLE_1 =
  "https://assets.publishing.service.gov.uk/media/6a7b23f1bbafcd1db3b6e420/Table_1_2026_Taxpayer_numbers_gains_and_tax_liabilities.ods";
const OBR_EFO = "https://obr.uk/economic-and-fiscal-outlooks/";
const CENTAX_2024 =
  "https://centax.org.uk/wp-content/uploads/2024/10/AdvaniLonsdaleSummers2024_CGTReform.pdf";
const ADVANI_SUMMERS = "https://arunadvani.com/taxreform.html";

function BenchmarkLink({ href, children }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="underline decoration-1 underline-offset-2 hover:opacity-80"
    >
      {children}
    </a>
  );
}

function Toggle({ options, value, onChange }) {
  return (
    <div className="inline-flex overflow-hidden rounded-md border border-slate-300 text-sm">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={
            option.value === value
              ? "bg-[color:var(--pe-color-primary-600)] px-3 py-1.5 font-semibold text-white"
              : "bg-white px-3 py-1.5 text-slate-600 hover:bg-slate-50"
          }
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function RoleBadge({ role }) {
  return (
    <span className="ml-2 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-normal text-slate-500">
      {role}
    </span>
  );
}

function DatasetCard({ dataset }) {
  return (
    <div className="metric-card">
      <p className="text-sm font-semibold text-slate-800">
        {dataset.dataset_label}
        <RoleBadge role={dataset.dataset_role} />
      </p>
      <dl className="mt-3 space-y-2 text-xs leading-5 text-slate-600">
        <div>
          <dt className="font-semibold text-slate-700">Built by</dt>
          <dd>{dataset.dataset_producer}</dd>
        </div>
        <div>
          <dt className="font-semibold text-slate-700">Capital gains observation</dt>
          <dd>{dataset.dataset_observation}</dd>
        </div>
        {dataset.dataset_notes ? (
          <div>
            <dt className="font-semibold text-slate-700">Notes</dt>
            <dd>{dataset.dataset_notes}</dd>
          </div>
        ) : null}
        <div>
          <dt className="font-semibold text-slate-700">Pinned input</dt>
          <dd className="break-all font-mono text-[11px]">
            {dataset.dataset}
            <br />
            sha256 {dataset.dataset_sha256}
          </dd>
        </div>
      </dl>
    </div>
  );
}

export default function ComparisonTab({ comparison }) {
  const keys = orderedKeys(comparison);
  const datasets = comparison.datasets;
  const label = (key) => datasets[key].dataset_short_label;
  const role = (key) => datasets[key].dataset_role;
  const firstYear = comparison.first_year;
  const [budgetView, setBudgetView] = useState("change");

  const validationRow = (metric) => comparison.validation.find((row) => row.metric === metric);
  const taxpayers = validationRow("cgt_taxpayers");
  const entrants = validationRow("entrants_by_uprating.count");
  const entrantGains = validationRow("entrants_by_uprating.gains_bn");
  const entrantCgt = validationRow("entrants_by_uprating.cgt_bn");
  const staticRow = comparison.sensitivity.find((row) => row.e_mtr === 0);
  const firstBudget = comparison.budget[0];

  const chartData = comparison.budget.map((row) => ({
    year: row.year,
    ...Object.fromEntries(
      keys.map((key) => [
        key,
        budgetView === "levels" ? row[key].baseline_cgt_bn : row[key].gov_balance_change_bn,
      ]),
    ),
  }));

  const headline = [
    {
      label: `Revenue raised, ${firstYear} (e = −0.7)`,
      values: keys.map((key) => formatSignedBn(firstBudget[key].gov_balance_change_bn, 1)),
      benchmark: (
        <>
          <BenchmarkLink href={CENTAX_2024}>CenTax (2024)</BenchmarkLink>: £14.0bn central,
          £9.7bn worst case, both with base broadening; HMRC ready reckoner: −£2bn by
          year 3 for +10pp on the higher rates alone
        </>
      ),
    },
    {
      label: "Five-year total, 2026-27 to 2030-31",
      values: keys.map((key) => formatSignedBn(comparison.five_year_total_bn[key], 1)),
      benchmark: null,
    },
    {
      label: `Static yield, ${firstYear} (e = 0)`,
      values: keys.map((key) => formatSignedBn(staticRow[key], 1)),
      benchmark: (
        <>
          <BenchmarkLink href={ADVANI_SUMMERS}>Advani &amp; Summers (2020)</BenchmarkLink>, static,
          GDP-uprated: £16.7bn
        </>
      ),
    },
    {
      label: `Baseline CGT liability, ${firstYear}`,
      values: keys.map((key) => formatBn(firstBudget[key].baseline_cgt_bn, 1)),
      benchmark: (
        <>
          <BenchmarkLink href={HMRC_TABLE_1}>HMRC Table 1</BenchmarkLink>: £12.1bn (2023-24),
          £22.5bn (2024-25, provisional);{" "}
          <BenchmarkLink href={OBR_EFO}>OBR receipts</BenchmarkLink>: £20.8bn (2026-27),
          £25.5bn (2027-28)
        </>
      ),
    },
    {
      label: `CGT taxpayers, ${firstYear}`,
      values: keys.map((key) => formatCount(taxpayers[key])),
      benchmark: (
        <>
          <BenchmarkLink href={HMRC_TABLE_1}>HMRC Table 1</BenchmarkLink>: 382k (2023-24), 551k
          (2024-25, provisional)
        </>
      ),
    },
    {
      label: "of which entrants by uprating",
      values: keys.map((key) => formatCount(entrants[key])),
      benchmark: "None: HMRC counts only taxpayers with a liability",
    },
    {
      label: `Top income quintile, net income change, ${firstYear}`,
      values: keys.map(
        (key) =>
          `${formatSignedPct(comparison.top_quintile[key].relative_change_pct)} (${formatSignedCurrency(comparison.top_quintile[key].avg_change_gbp)}/household)`,
      ),
      benchmark: null,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="pt-2">
        <SectionHeading
          size="lg"
          title="Incumbent and candidate datasets side by side"
          description={
            <>
              The same reform, engine (policyengine-uk{" "}
              {datasets[keys[0]].policyengine_uk_version}), wrapper (policyengine.py{" "}
              {datasets[keys[0]].policyengine_version}) and projection (fingerprint{" "}
              <span className="font-mono">{comparison.projection_fingerprint}</span>) run on
              each dataset as published, with no local reweighting. Every difference below
              comes from the data.
            </>
          }
        />
      </div>

      <section className="grid gap-4 md:grid-cols-2">
        {keys.map((key) => (
          <DatasetCard key={key} dataset={datasets[key]} />
        ))}
      </section>

      <section className="section-card">
        <SectionHeading
          title="Headline results"
          description="Revenue after the behavioural response, the static yield, and the baseline each dataset starts from, with the published counterparts where one exists. Benchmarks are outturns for the tax year stated (HMRC Capital Gains Tax statistics, 2026 release) or other institutions’ estimates of a similar reform; only the OBR receipts describe a projected year."
        />
        <table className="data-table">
          <thead>
            <tr>
              <th>Quantity</th>
              {keys.map((key) => (
                <th key={key}>
                  {label(key)}
                  <RoleBadge role={role(key)} />
                </th>
              ))}
              <th>External benchmark</th>
            </tr>
          </thead>
          <tbody>
            {headline.map((row) => (
              <tr key={row.label}>
                <td>{row.label}</td>
                {row.values.map((value, i) => (
                  <td key={keys[i]}>{value}</td>
                ))}
                <td className="text-sm text-slate-600">{row.benchmark ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="section-card">
        <SectionHeading
          title="Reading the comparison"
          description="Two things separate the datasets before any reform is applied."
        />
        <ol className="list-decimal space-y-3 pl-5 text-sm leading-6 text-slate-600">
          <li>
            <strong>Entrants by uprating.</strong> The annual exempt amount is frozen at
            £3,000 while the engine uprates gains with GDP per capita, so anyone whose
            base-year gains sit at or just below the exempt amount crosses it in the
            projection and counts as a CGT taxpayer with a few hundred pounds of taxable gain.
            {keys.map((key) => (
              <span key={key}>
                {" "}
                In {label(key)}, {formatCount(entrants[key])} of the{" "}
                {formatCount(taxpayers[key])} taxpayers in {firstYear} (
                {formatPct((100 * entrants[key]) / taxpayers[key], 0)}) are such entrants,
                holding {formatBn(entrantGains[key], 2)} of gains, paying{" "}
                {formatBn(entrantCgt[key], 2)} of baseline CGT and contributing{" "}
                {formatSignedBn(firstBudget[key].cgt_change_from_entrants_bn, 2)} of the
                reform&apos;s {firstYear} yield.
              </span>
            ))}{" "}
            The candidate builds gainers beyond HMRC&apos;s taxpayer count with their gains
            capped at exactly the exempt amount, so the group is large there; nothing here
            edits the data, and the validation table reports every figure with and without
            them.
          </li>
          <li>
            <strong>Vintage of the capital gains calibration.</strong>{" "}
            {keys.map((key, i) => (
              <span key={key}>
                {i > 0 ? " " : ""}
                {label(key)}: {datasets[key].dataset_observation}.
              </span>
            ))}{" "}
            HMRC&apos;s 2024-25 statistics record far more gains than 2023-24 (the rate rises
            announced in October 2024 brought disposals forward), so a base calibrated to
            2024-25 and then uprated with GDP per capita carries that one-off into every
            projected year. Issue #2&apos;s CGT-specific projection is where that timing effect
            belongs.
          </li>
        </ol>
      </section>

      <section className="section-card">
        <SectionHeading
          title="Budgetary impact by year"
          description="Net change in the government balance after the behavioural response, or the baseline CGT liability each dataset projects, for every fiscal year."
        />
        <div className="mb-3 flex flex-wrap items-center gap-4">
          <Toggle
            options={[
              { value: "change", label: "Change vs baseline" },
              { value: "levels", label: "Baseline CGT liability" },
            ]}
            value={budgetView}
            onChange={setBudgetView}
          />
        </div>
        <div className="h-[380px] w-full">
          <ResponsiveContainer>
            <BarChart data={chartData} margin={{ top: 10, right: 20, bottom: 5, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={colors.border.light} />
              <XAxis dataKey="year" tick={AXIS_STYLE} />
              <YAxis
                tick={AXIS_STYLE}
                tickFormatter={(v) => formatBn(v, 0)}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip formatter={(v) => formatBn(v)} />
              <Legend />
              {keys.map((key) => (
                <Bar
                  key={key}
                  dataKey={key}
                  name={label(key)}
                  fill={FILLS[role(key)] ?? colors.primary[400]}
                  radius={[6, 6, 0, 0]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
        <ChartLogo />
        <table className="data-table mt-4">
          <thead>
            <tr>
              <th>Fiscal year</th>
              {keys.map((key) => (
                <th key={key} colSpan={3}>
                  {label(key)}
                </th>
              ))}
            </tr>
            <tr>
              <th></th>
              {keys.map((key) => (
                <Fragment key={key}>
                  <th>Baseline CGT</th>
                  <th>Reform CGT</th>
                  <th>Change (entrants)</th>
                </Fragment>
              ))}
            </tr>
          </thead>
          <tbody>
            {comparison.budget.map((row) => (
              <tr key={row.year}>
                <td>{row.year}</td>
                {keys.map((key) => (
                  <Fragment key={key}>
                    <td>{formatBn(row[key].baseline_cgt_bn, 1)}</td>
                    <td>{formatBn(row[key].reform_cgt_bn, 1)}</td>
                    <td>
                      {formatSignedBn(row[key].gov_balance_change_bn, 1)} (
                      {formatSignedBn(row[key].cgt_change_from_entrants_bn, 2)})
                    </td>
                  </Fragment>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="section-card">
        <SectionHeading
          title={`Baseline validation, ${firstYear}`}
          description="Every statistic the Baseline tab reports, for both datasets. Rows marked “excluding entrants” net out the entrants by uprating."
        />
        <table className="data-table">
          <thead>
            <tr>
              <th>Quantity</th>
              {keys.map((key) => (
                <th key={key}>{label(key)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {comparison.validation.map((row) => (
              <tr key={row.metric} className={row.label.startsWith("of which") ? "text-slate-500" : ""}>
                <td className={row.label.startsWith("of which") ? "pl-6" : ""}>{row.label}</td>
                {keys.map((key) => (
                  <td key={key}>{formatMetric(row.metric, row[key])}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="section-card">
        <SectionHeading
          title={`Sensitivity to the behavioural elasticity, ${firstYear}`}
          description="Net change in the government balance in the first year under each elasticity, by dataset."
        />
        <table className="data-table">
          <thead>
            <tr>
              <th>Scenario</th>
              <th>MTR elasticity</th>
              {keys.map((key) => (
                <th key={key}>{label(key)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {comparison.sensitivity.map((row) => (
              <tr key={row.name} className={row.e_mtr === -0.7 ? "font-semibold" : ""}>
                <td>{row.name}</td>
                <td>{row.e_mtr.toFixed(2)}</td>
                {keys.map((key) => (
                  <td key={key}>{formatSignedBn(row[key])}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="section-card">
        <SectionHeading
          title={`Who bears the cost, ${firstYear}`}
          description="Average change in household net income by household type and by region, by dataset. Losses include the gains taxpayers stop realising under the −0.7 elasticity, not just tax paid."
        />
        <div className="grid gap-6 lg:grid-cols-2">
          <table className="data-table">
            <thead>
              <tr>
                <th>Household type</th>
                {keys.map((key) => (
                  <th key={key}>{label(key)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {comparison.household_type[keys[0]].map((row, i) => (
                <tr key={row.group}>
                  <td>{row.group}</td>
                  {keys.map((key) => {
                    const cell = comparison.household_type[key][i];
                    return (
                      <td key={key}>
                        {formatSignedCurrency(cell.avg_change_gbp)} (
                        {formatSignedPct(cell.relative_change_pct)})
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <table className="data-table">
            <thead>
              <tr>
                <th>Region</th>
                {keys.map((key) => (
                  <th key={key}>{label(key)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {comparison.region[keys[0]].map((row) => (
                <tr key={row.group}>
                  <td>{row.group}</td>
                  {keys.map((key) => {
                    const cell = comparison.region[key].find((r) => r.group === row.group);
                    return (
                      <td key={key}>
                        {cell ? formatSignedCurrency(cell.avg_change_gbp) : "—"}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
