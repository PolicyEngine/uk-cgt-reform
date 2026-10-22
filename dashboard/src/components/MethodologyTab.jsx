"use client";

import { useEffect } from "react";
import { getBenchmarks, getDatasetInfo, getFirstYear, getMetadata } from "../lib/dataHelpers";
import { formatPct, formatPublished } from "../lib/formatters";
import { TabLink } from "./controls";
import SectionHeading from "./SectionHeading";

function ExternalLink({ href, children }) {
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

const LIST = "mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-slate-600";
const CODE = "break-all font-mono text-xs";

// The auditable identifiers behind a section (build ids, file digests,
// parameter paths, versions), collapsed so the main text stays readable.
function TechnicalDetails({ children }) {
  return (
    <details className="group mt-5 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
      <summary className="cursor-pointer select-none text-sm font-semibold text-slate-800 marker:text-[color:var(--pe-color-primary-600)]">
        Technical details
      </summary>
      <ul className="mt-3 list-disc space-y-1.5 pl-5 text-xs leading-5 text-slate-600">
        {children}
      </ul>
    </details>
  );
}

// How realised gains and the revenue on them respond when one rate moves
// from t0 to t1, in the form the engine applies: a retention-rate
// elasticity, realised gains scaled by ((1 - t1) / (1 - t0)) ** e.
function responseTo(t0, t1, { e_retention: eRetention }) {
  const gains = ((1 - t1) / (1 - t0)) ** eRetention;
  return { gains: gains - 1, revenue: (gains * t1) / t0 - 1 };
}

function percent(change) {
  return `${Math.abs(100 * change).toFixed(0)}%`;
}

// CenTax's report, at a PDF page (printed page + 1).
const CENTAX_REPORT =
  "https://centax.org.uk/wp-content/uploads/2024/10/AdvaniLonsdaleSummers2024_CGTReform.pdf";
const centaxPage = (pdfPage) => `${CENTAX_REPORT}#page=${pdfPage}`;

// Official sources named in the text.
const FRS = "https://www.gov.uk/government/collections/family-resources-survey--2";
const CGT_STATISTICS = "https://www.gov.uk/government/statistics/capital-gains-tax-statistics";
const HMRC_TABLE_3 =
  "https://assets.publishing.service.gov.uk/media/6a85a2e654bcee010d51454b/Table_3_2026_Size_of_gain_by_income.ods";
const HMRC_TABLE_7 =
  "https://assets.publishing.service.gov.uk/media/6a7b2487423b0bdba0290ecb/Table_7_2026_Statistics_by_asset_type_in_the_2023_to_2024_tax_year.ods";
const HMRC_TABLE_8 =
  "https://assets.publishing.service.gov.uk/media/6a7b24a6423b0bdba0290ecc/Table_8_2026_Statistics_on_UK_residential_property.ods";
const HMRC_TABLE_2 =
  "https://assets.publishing.service.gov.uk/media/6a7b240b423b0bdba0290eca/Table_2_2026_Size_of_gain.ods";
const HMRC_TABLE_4 =
  "https://assets.publishing.service.gov.uk/media/6a7b242a347b198efd290ed7/Table_4_2026_Business_asset_disposal_and_investors_reliefs.ods";
const BADR_GUIDANCE = "https://www.gov.uk/business-asset-disposal-relief";
const INVESTORS_RELIEF = "https://www.gov.uk/government/publications/investors-relief-2020-hs308";
const EXEMPT_AMOUNT = "https://www.gov.uk/capital-gains-tax/allowances";
const OBR_EFO = "https://obr.uk/efo/economic-and-fiscal-outlook-march-2026/";
const ONS_PROJECTIONS =
  "https://www.ons.gov.uk/peoplepopulationandcommunity/populationandmigration/populationprojections";
const READY_RECKONER_URL =
  "https://assets.publishing.service.gov.uk/media/68552862b46781eacfd71d71/June_2025_TRR_ODS__1_.ods";
const AGERSNAP_ZIDAR = "https://www.aeaweb.org/articles?id=10.1257/aeri.20200535";

// The dataset's own notes carry the figures the plain-language text needs;
// pull them out so nothing is hardcoded, and fall back to the note itself.
function datasetFigures(dataset) {
  const targets = dataset.observation?.match(/calibrated to ([\d,]+) targets/)?.[1];
  const fence = dataset.notes?.match(
    /by (\d{4}) at ([\d.]+k), against HMRC's ([\d.]+k) taxpayers with gains of (.+?) in (\d{4}-\d{2}) \((Table [\w.]+)\)/,
  );
  const audit = dataset.notes?.match(/counts ([\d.]+k)/)?.[1];
  return {
    targets,
    entrants:
      fence && audit
        ? {
            year: fence[1],
            bound: fence[2],
            hmrc: fence[3],
            band: fence[4],
            hmrcYear: fence[5],
            table: fence[6],
            audit,
          }
        : null,
  };
}

export default function MethodologyTab({ data, anchor, onNavigate }) {
  // Analysis sections can link here with /?tab=methodology#<id>, or open the
  // tab at a section (``anchor``); the tab mounts after navigation, so the
  // browser's native hash scroll has already missed and we replay it.
  useEffect(() => {
    const target = anchor ?? window.location.hash.slice(1);
    if (target) {
      document.getElementById(target)?.scrollIntoView();
    }
  }, [anchor]);

  const dataset = getDatasetInfo(data);
  const figures = datasetFigures(dataset);
  const metadata = getMetadata(data);
  const { central, official } = getBenchmarks(data).elasticities;
  const centaxRange = getBenchmarks(data).elasticities.centax_range;
  const exemptAmount = data.validation?.entrants_by_uprating?.exempt_amount_gbp;
  // The engine's baseline liability against the OBR's receipts forecast,
  // year by year, from the results file's static-equalisation block.
  const obrComparison = getBenchmarks(data).static_equalisation;
  const obrGaps = (obrComparison?.by_year ?? [])
    .filter((row) => Number.isFinite(row.obr_receipts_bn) && row.obr_receipts_bn > 0)
    .map((row) => ({
      year: row.year,
      gap: 100 * (row.baseline_cgt_bn / row.obr_receipts_bn - 1),
    }));
  const signedGap = (gap) => {
    const text = formatPct(gap, 0);
    return Number(gap.toFixed(0)) > 0 ? `+${text}` : text;
  };
  const baseYear = metadata.projection.base_year;
  const baseYearLabel = `${baseYear}-${String(baseYear + 1).slice(2)}`;
  // The ready reckoner's largest row: the higher rate from 24% to 34%.
  const atCentral = responseTo(0.24, 0.34, central);
  const atOfficial = responseTo(0.24, 0.34, official);

  const firstYear = getFirstYear(data);
  const lastYear = data.budget.at(-1).year;
  const indices = metadata.projection.indices ?? {};

  return (
    <div className="space-y-6">
      <section className="section-card scroll-mt-24" id="pathway">
        <SectionHeading
          title="Data and simulation"
          description={
            <>
              The estimates come from{" "}
              <ExternalLink href="https://policyengine.org">PolicyEngine</ExternalLink> UK, a
              model of the UK tax and benefit system, run on a representative sample of UK
              households for {firstYear} to {lastYear}. How well that sample captures capital
              gains, which are concentrated among a small number of people, largely decides how
              reliable the results are.
            </>
          }
        />
        <ul className={LIST}>
          <li>
            <strong>The dataset.</strong> {dataset.label}. It starts from the Family Resources{" "}
            <ExternalLink href={FRS}>Survey</ExternalLink> and adds capital gains from HMRC{" "}
            <ExternalLink href={CGT_STATISTICS}>statistics</ExternalLink>. It is used exactly as published,
            with no reweighting in this dashboard.
          </li>
          <li>
            <strong>How gains are added.</strong> Gain sizes are drawn from HMRC&apos;s Table{" "}
            <ExternalLink href={HMRC_TABLE_3}>3</ExternalLink> (size of gain by taxable income), so the largest gains, which carry most of the tax,
            are represented and each gain falls in the right income tax band. Each gainer gets a
            main asset type from HMRC Tables <ExternalLink href={HMRC_TABLE_7}>7</ExternalLink>{" "}
            and <ExternalLink href={HMRC_TABLE_8}>8</ExternalLink>, with residential property
            gains kept separate, and gains qualifying for Business Asset Disposal{" "}
            <ExternalLink href={BADR_GUIDANCE}>Relief</ExternalLink> or Investors&apos;{" "}
            <ExternalLink href={INVESTORS_RELIEF}>Relief</ExternalLink> are imputed from HMRC
            Table <ExternalLink href={HMRC_TABLE_4}>4</ExternalLink>. Gains below the exempt{" "}
            <ExternalLink href={EXEMPT_AMOUNT}>amount</ExternalLink> follow the
            Advani&ndash;Summers distribution within each band.
          </li>
          <li>
            <strong>Calibration.</strong> Household weights are set so the sample matches{" "}
            {figures.targets ?? "a set of"} statistics, including HMRC&apos;s CGT totals and
            size bands, gains by taxable income band, the relief&apos;s bands, residential property
            gains, age and region.
          </li>
          <li>
            <strong>New taxpayers from growing gains.</strong> People with gains just below the
            exempt amount
            {Number.isFinite(exemptAmount) ? ` (£${exemptAmount.toLocaleString("en-GB")}, frozen)` : ""}{" "}
            owe nothing in the base year, but some cross it as gains grow and start paying.
            {figures.entrants ? (
              <>
                {" "}
                The model adds about {figures.entrants.audit} such taxpayers by{" "}
                {figures.entrants.year} (the dataset&apos;s own bound is {figures.entrants.bound}),
                against HMRC&apos;s {figures.entrants.hmrc} taxpayers with gains of{" "}
                {figures.entrants.band} in {figures.entrants.hmrcYear} (
                <ExternalLink href={HMRC_TABLE_2}>HMRC</ExternalLink> {figures.entrants.table}).
              </>
            ) : (
              <> {dataset.notes}</>
            )}{" "}
            The{" "}
            <TabLink onNavigate={onNavigate} tab="baseline" section="entrants">
              Baseline
            </TabLink>{" "}
            tab shows every figure with and without them.
          </li>
          <li>
            <strong>Projecting to later years.</strong> The data describe one year,{" "}
            {baseYearLabel}. Each later year grows capital gains in line with the OBR&apos;s
            forecast of GDP per head and household weights in line with ONS population{" "}
            <ExternalLink href={ONS_PROJECTIONS}>projections</ExternalLink>. Nothing specific to CGT enters the projection.
          </li>
          {obrGaps.length ? (
            <li>
              <strong>Comparison with the OBR&apos;s forecast.</strong> The model&apos;s baseline
              CGT bill differs from the OBR&apos;s{" "}
              <ExternalLink href={OBR_EFO}>forecast</ExternalLink> of CGT receipts (
              {obrComparison.obr_receipts_source}) by{" "}
              {obrGaps.map((row) => `${signedGap(row.gap)} in ${row.year}`).join(", ")}. The two
              measure different things: receipts arrive about a year after the tax they settle,
              and the model grows gains smoothly from {baseYearLabel}, where the OBR forecasts
              receipts year by year.
            </li>
          ) : null}
          <li>
            <strong>Which gains are taxed how.</strong> Under current law, residential property
            gains and gains qualifying for Business Asset Disposal Relief (with Investors&apos;
            Relief) are taxed on their own rate schedules. The reform charges residential property
            gains at income tax rates like other gains and withdraws the relief, so qualifying
            gains pay the new main rates, as in{" "}
            <ExternalLink href={CENTAX_REPORT}>CenTax&apos;s</ExternalLink> rates-only estimate. Carried interest
            has been taxed as income, outside CGT, since 6 April 2026, so it is unaffected.
          </li>
          <li>
            <strong>Results by group.</strong> Budget figures and the breakdowns by income group,
            household type and region are weighted totals over the simulated households.
          </li>
        </ul>
        <TechnicalDetails>
          <li>
            Dataset file <span className={CODE}>{dataset.uri}</span>, sha256{" "}
            <span className="font-mono">{dataset.sha256.slice(0, 12)}…</span>, checked before
            any run.
          </li>
          <li>
            Build record: {dataset.producer}. Built with{" "}
            <ExternalLink href="https://github.com/PolicyEngine/microcosm">microcosm</ExternalLink>.
          </li>
          <li>{dataset.columns} On a dataset without these columns the schedule parameters are inert.</li>
          {figures.entrants ? (
            <li>
              New taxpayers: the {figures.entrants.bound} bound is the dataset build&apos;s projection
              fence; the {figures.entrants.audit} count is this repository&apos;s uprating audit on
              policyengine-uk {metadata.policyengine_uk_version}.
            </li>
          ) : null}
          <li>
            Engine:{" "}
            <ExternalLink href="https://github.com/PolicyEngine/policyengine-uk">
              policyengine-uk
            </ExternalLink>{" "}
            {metadata.policyengine_uk_version}, run through{" "}
            <ExternalLink href="https://github.com/PolicyEngine/policyengine.py">
              policyengine.py
            </ExternalLink>{" "}
            {metadata.policyengine_version}; aggregates are weighted{" "}
            <ExternalLink href="https://github.com/PolicyEngine/microdf">microdf</ExternalLink> sums. The 4.x
            wrapper is used because later releases pin a single engine version that predates the
            schedules.
          </li>
          <li>
            Projection indices:{" "}
            {Object.entries(indices).map(([variable, path], i) => (
              <span key={variable}>
                {i ? "; " : ""}
                <span className="font-mono">{variable}</span> by{" "}
                <span className={CODE}>{path}</span>
              </span>
            ))}
            . Factors applied are in{" "}
            <span className="font-mono">{metadata.projection.audit}</span>, fingerprint{" "}
            <span className="font-mono">{metadata.projection.fingerprint}</span> (part of every
            simulation id).
          </li>
          <li>
            Behavioural response: applied through a policy simulation modifier that registers the
            baseline branch, so the change in marginal rates is measured against current law; the
            pipeline checks the response is active before writing results. Each case sets{" "}
            <span className={CODE}>{metadata.elasticity_parameter}</span> and leaves the
            engine&apos;s marginal-tax-rate elasticity at zero.
          </li>
        </TechnicalDetails>
      </section>

      <section className="section-card scroll-mt-24" id="elasticity">
        <SectionHeading
          title="How taxpayers respond to higher rates"
          description="When CGT rates rise, people sell fewer assets or delay selling, so fewer gains are realised and taxed. The size of that response is the single biggest assumption behind the revenue estimates."
        />
        <ul className={LIST}>
          <li>
            <strong>How it is measured.</strong> The response is an elasticity: how much realised
            gains change when the share of each gain a taxpayer keeps after tax, 1 − t, changes.
            This follows the convention of Advani, Lonsdale &amp; Summers (
            <ExternalLink href={CENTAX_REPORT}>CenTax</ExternalLink>, 2024, pp.{" "}
            <ExternalLink href={centaxPage(33)}>32</ExternalLink> and{" "}
            <ExternalLink href={centaxPage(38)}>37</ExternalLink>).
          </li>
          <li>
            <strong>How it is applied.</strong> For each person, realised gains are scaled by
            <span className="my-3 block overflow-x-auto whitespace-nowrap rounded-lg bg-slate-50 px-1 py-3 text-center font-mono text-xs sm:p-4 sm:text-sm">
              realised gains × ((1 − t₁) / (1 − t₀))<sup>e</sup>
            </span>
            where t₀ and t₁ are the person&apos;s marginal rates on gains under current law and
            under the reform (averaged across the main, residential property and relief schedules
            in proportion to their gains), and e is the elasticity.
          </li>
          <li>
            <strong>Per person, not in aggregate.</strong> CenTax apply one elasticity to total
            gains; this model applies it to each person&apos;s own marginal rate, so it takes
            CenTax&apos;s convention but not their calculation. Because the elasticity is a power,
            values away from 1.0, such as 0.5 and 2.0, also differ from a straight-line reading.
          </li>
          <li>
            <strong>Central value: {central.e_retention.toFixed(1)}.</strong> This is CenTax&apos;s
            &ldquo;central elasticity estimate&rdquo; (p.{" "}
            <ExternalLink href={central.url}>37</ExternalLink>) and PolicyEngine UK&apos;s default.
          </li>
          <li>
            <strong>Main caveat.</strong> CenTax chose that value for a package that also removes
            the uplift at death and charges gains when people leave the UK, two ways of deferring
            or avoiding the tax. This dashboard models neither. CenTax expect a larger response to
            a rate rise on today&apos;s tax base and advise against equalising rates without those
            reforms (Advani, Hughson &amp; Summers, <em>Taxes at the top</em>, CenTax, September
            2026, p.{" "}
            <ExternalLink href="https://www.nuffieldfoundation.org/wp-content/uploads/2023/03/Taxes-at-the-top-Understanding-what-high-earners-pay-and-options-for-reform.pdf#page=20">
              17
            </ExternalLink>
            ).
          </li>
          <li>
            <strong>Testing the assumption.</strong> The{" "}
            <TabLink onNavigate={onNavigate} tab="reform" section="sensitivity">
              Reform
            </TabLink>{" "}
            tab&apos;s sensitivity chart shows the result with no response, across CenTax&apos;s
            range
            {centaxRange ? ` (${centaxRange.lower.toFixed(1)} to ${centaxRange.upper.toFixed(1)})` : ""}
            , and at the official HMRC/OBR value described below.
          </li>
        </ul>
        <TechnicalDetails>
          <li>
            PolicyEngine UK adopted CenTax&apos;s central value as its default in policyengine-uk
            2.134.0 (PR{" "}
            <ExternalLink href="https://github.com/PolicyEngine/policyengine-uk/pull/2419">
              #2419
            </ExternalLink>
            ); this dashboard still sets the elasticity explicitly in every case.
          </li>
        </TechnicalDetails>
      </section>

      <section className="section-card scroll-mt-24" id="elasticity-gap">
        <SectionHeading
          title="Why official estimates differ"
          description={
            <>
              HMRC and the OBR assume a much stronger response than CenTax, which is why
              HMRC&apos;s ready <ExternalLink href={READY_RECKONER_URL}>reckoner</ExternalLink>{" "}
              shows large rate rises losing revenue while this dashboard&apos;s central case
              raises it.
            </>
          }
        />
        <ul className={LIST}>
          <li>
            <strong>The official values.</strong> HMRC and the OBR use {official.e_retention} for
            the main CGT rates and {official.badr_e_retention} for gains qualifying for Business
            Asset Disposal Relief (<ExternalLink href={`${official.url}#page=3`}>OBR</ExternalLink>,{" "}
            {formatPublished(official.published.slice(0, 7))}, para 1.9 and{" "}
            <ExternalLink href={`${official.url}#page=5`}>Table</ExternalLink> 1.1). HMRC&apos;s own{" "}
            <ExternalLink href={`${official.url}#page=3`}>estimate</ExternalLink> for 1998 to 2018
            is 4.0 (para 1.10). The main value is{" "}
            {(official.e_retention / central.e_retention).toFixed(1)} times CenTax&apos;s central
            one. The dashboard&apos;s official case uses both values, each on its own kind of gain.
          </li>
          <li>
            <strong>Why they differ.</strong> HMRC&apos;s figure comes from UK responses under the
            current tax base. CenTax start from US evidence of about 1.5 five years after a change
            (<ExternalLink href={AGERSNAP_ZIDAR}>Agersnap</ExternalLink> &amp; Zidar, 2021) and lower it to {central.e_retention.toFixed(1)} because
            their package removes the uplift at death, which the US keeps, and because equalising
            rates brings income that was presented as gains back into income tax, which estimates
            based only on CGT count as lost. They make no adjustment for the charge on leaving the
            UK, since the US evidence already reflects little scope to avoid the tax by emigrating.
          </li>
          <li>
            <strong>A worked example.</strong> Take a taxpayer whose marginal rate on gains rises
            from 24% to 34%, the ready reckoner&apos;s largest row. At the central elasticity their
            realised gains fall by {percent(atCentral.gains)} and the tax on them{" "}
            {atCentral.revenue >= 0 ? "rises" : "falls"} by {percent(atCentral.revenue)}. At the
            official elasticity gains fall by {percent(atOfficial.gains)} and the tax{" "}
            {atOfficial.revenue >= 0 ? "rises" : "falls"} by {percent(atOfficial.revenue)}, the
            direction HMRC&apos;s row shows. Across the whole dataset the effect depends on where
            taxpayers&apos; marginal rates sit.
          </li>
          <li>
            <strong>Where to see it.</strong> The{" "}
            <TabLink onNavigate={onNavigate} tab="reform" section="sensitivity">
              Reform
            </TabLink>{" "}
            tab&apos;s sensitivity chart gives the reform&apos;s first-year revenue at each
            elasticity, and the{" "}
            <TabLink onNavigate={onNavigate} tab="benchmarks">
              Benchmarks
            </TabLink>{" "}
            tab scores the ready reckoner&apos;s rows at the central and official values.
          </li>
        </ul>
      </section>

      <section className="section-card scroll-mt-24" id="explorer">
        <SectionHeading
          title="Custom rates"
          description={
            <>
              The{" "}
              <TabLink onNavigate={onNavigate} tab="reform">
                Reform
              </TabLink>{" "}
              tab&apos;s Custom rates option lets you choose your own CGT rates and treatment of
              Business Asset Disposal Relief, and scores them on {dataset.shortLabel} for every
              modelled year with the same model and assumptions as the main results.
            </>
          }
        />
        <ul className={LIST}>
          <li>
            <strong>What you can change.</strong> The rates apply to both the main and the
            residential property schedules, which have charged the same rates since 30 October
            2024. The relief can be withdrawn, or kept at a whole-percentage-point rate no higher
            than the additional rate with a lifetime limit of £500k, £1m (current law) or £10m
            (the limit until March 2020).
          </li>
          <li>
            <strong>How it runs.</strong> Each schedule is simulated in full; nothing is
            interpolated. Equalisation with the relief withdrawn is the main reform, so its
            results appear at once; any other schedule, including equalisation with one value
            changed, runs live.
          </li>
          <li>
            <strong>Saved results.</strong> Every completed run is stored, so anyone who later
            asks for the same schedule gets it at once. A change to the data or the model always
            triggers a fresh run rather than reusing an old result.
          </li>
        </ul>
        <TechnicalDetails>
          <li>
            Runs the pipeline&apos;s own code (the same pinned per-year datasets, cached baseline
            simulations, behavioural response and impact calculations) on a Modal backend, or
            locally with <span className="font-mono">uk-cgt-reform-explore</span>.
          </li>
          <li>
            Cache key: dataset digest, projection fingerprint, engine and wrapper versions, and
            the reform fingerprint (rates and elasticity).
          </li>
        </TechnicalDetails>
      </section>
    </div>
  );
}
