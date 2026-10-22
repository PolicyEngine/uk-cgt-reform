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

const CODE = "break-all font-mono text-xs";
const LINK =
  "font-semibold text-[color:var(--pe-color-primary-600)] underline decoration-1 underline-offset-2 hover:opacity-80";

// The auditable identifiers behind a section (build ids, file digests,
// parameter paths, versions), collapsed so the main text stays readable.
function TechnicalDetails({ children }) {
  return (
    <details className="group mt-8 border-t border-slate-200 pt-4">
      <summary className="cursor-pointer select-none text-sm font-medium text-slate-600 marker:text-[color:var(--pe-color-primary-600)]">
        Technical details
      </summary>
      <ul className="mt-3 list-disc space-y-1.5 pl-5 text-xs leading-5 text-slate-600">
        {children}
      </ul>
    </details>
  );
}

// The reading column every section's prose sits in.
const COLUMN = "space-y-3 text-sm leading-6 text-slate-600";

// One sub-topic: a plain sentence-case heading over short paragraphs.
function Topic({ title, id, children }) {
  return (
    <div id={id} className="mt-7 scroll-mt-24">
      <h3 className="text-base font-semibold text-slate-900">{title}</h3>
      <div className={`mt-2 ${COLUMN}`}>{children}</div>
    </div>
  );
}

// A headline value with its label, for the side-by-side elasticity comparison.
function ValueCard({ label, value, children }) {
  return (
    <div className="min-w-0 rounded-lg border border-slate-200 p-4">
      <p className="text-sm font-medium text-slate-600">{label}</p>
      <p className="mt-1 text-3xl font-semibold tabular-nums text-slate-900">{value}</p>
      <div className="mt-2 space-y-1 text-sm leading-6 text-slate-600">{children}</div>
    </div>
  );
}

// A symbol with a subscript, e.g. t with 0, as inline MathML.
function Sub({ base, sub }) {
  return (
    <math style={{ fontFamily: MATH_FONT }}>
      <msub>
        <mi>{base}</mi>
        <mn>{sub}</mn>
      </msub>
    </math>
  );
}

// A font with an OpenType MATH table, so the brackets stretch to the fraction.
const MATH_FONT = '"STIX Two Math", "Cambria Math", "Latin Modern Math", math';

const FORMULA_TEXT = "realised gains × ((1 − t₁) / (1 − t₀))^e";

// The response formula, typeset: gains scaled by (1 − t1)/(1 − t0) to the e.
function ResponseFormula() {
  const retention = (sub) => (
    <mrow>
      <mn>1</mn>
      <mo>−</mo>
      <msub>
        <mi>t</mi>
        <mn>{sub}</mn>
      </msub>
    </mrow>
  );
  return (
    <div className="overflow-x-auto rounded-lg bg-slate-50 px-3 py-5 text-slate-900">
      <math
        display="block"
        alttext={FORMULA_TEXT}
        aria-label={FORMULA_TEXT}
        className="text-xl sm:text-2xl"
        style={{ fontFamily: MATH_FONT }}
      >
        <mrow>
          <mtext>realised gains</mtext>
          <mo>×</mo>
          <msup>
            <mrow>
              <mo stretchy="true">(</mo>
              <mfrac>
                {retention(1)}
                {retention(0)}
              </mfrac>
              <mo stretchy="true">)</mo>
            </mrow>
            <mi>e</mi>
          </msup>
        </mrow>
      </math>
    </div>
  );
}

// How realised gains and the revenue on them respond when one rate moves
// from t0 to t1, in the form the engine applies: a retention-rate
// elasticity, realised gains scaled by ((1 - t1) / (1 - t0)) ** e.
function responseTo(t0, t1, { e_retention: eRetention }) {
  const gains = ((1 - t1) / (1 - t0)) ** eRetention;
  return { gains: gains - 1, revenue: (gains * t1) / t0 - 1 };
}

// A change as a signed whole percentage, e.g. "+12%" or "−22%".
function signedPercent(change) {
  const text = formatPct(100 * change, 0);
  return Number((100 * change).toFixed(0)) > 0 ? `+${text}` : text;
}

// CenTax's report, at a PDF page (printed page + 1).
const CENTAX_REPORT =
  "https://centax.org.uk/wp-content/uploads/2024/10/AdvaniLonsdaleSummers2024_CGTReform.pdf";
const centaxPage = (pdfPage) => `${CENTAX_REPORT}#page=${pdfPage}`;

// CenTax's Taxes at the top (September 2026), at a PDF page (printed page + 2).
const TAXES_AT_THE_TOP =
  "https://centax.org.uk/wp-content/uploads/2026/09/AdvaniHughsonSummers2026_Taxes-at-the-top.pdf";
const taxesAtTheTopPage = (pdfPage) => `${TAXES_AT_THE_TOP}#page=${pdfPage}`;

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
      <nav
        aria-label="On this page"
        className="flex flex-wrap items-baseline gap-x-5 gap-y-1 px-1 text-sm text-slate-500"
      >
        <span>On this page</span>
        {[
          ["pathway", "Data"],
          ["projection", "Projection"],
          ["elasticity", "Response"],
          ["explorer", "Rates"],
        ].map(([id, word]) => (
          <a key={id} href={`#${id}`} className={LINK}>
            {word}
          </a>
        ))}
      </nav>

      <section className="section-card scroll-mt-24" id="pathway">
        <SectionHeading
          title="Data and simulation"
          description={
            <p className="">
              The estimates come from{" "}
              <ExternalLink href="https://policyengine.org">PolicyEngine</ExternalLink> UK, a
              model of UK taxes and benefits. It runs on a representative sample of UK households
              for {firstYear} to {lastYear}. Capital gains are concentrated among a small number
              of people. How well the sample captures them largely decides how reliable the
              results are.
            </p>
          }
        />

        <Topic title="The dataset">
          <p>
            {dataset.label}. It starts from the Family Resources{" "}
            <ExternalLink href={FRS}>Survey</ExternalLink> and adds capital gains from HMRC{" "}
            <ExternalLink href={CGT_STATISTICS}>statistics</ExternalLink>. This dashboard uses it
            as published, with no reweighting.
          </p>
        </Topic>
        <Topic title="Gain sizes">
          <p>
            Gain sizes come from HMRC&apos;s Table{" "}
            <ExternalLink href={HMRC_TABLE_3}>3</ExternalLink> (size of gain by taxable income).
            This keeps the largest gains, which carry most of the tax. It also puts each gain in
            the right income tax band.
          </p>
          <p>
            Gains below the exempt <ExternalLink href={EXEMPT_AMOUNT}>amount</ExternalLink> (the
            yearly tax-free allowance) follow the Advani&ndash;Summers distribution, their
            estimate of how small gains spread, within each band.
          </p>
        </Topic>
        <Topic title="Asset types and reliefs">
          <p>
            Each person with gains gets a main asset type from HMRC Tables{" "}
            <ExternalLink href={HMRC_TABLE_7}>7</ExternalLink> and{" "}
            <ExternalLink href={HMRC_TABLE_8}>8</ExternalLink>. Residential property gains are
            kept separate.
          </p>
          <p>
            Some gains qualify for Business Asset Disposal{" "}
            <ExternalLink href={BADR_GUIDANCE}>Relief</ExternalLink> or Investors&apos;{" "}
            <ExternalLink href={INVESTORS_RELIEF}>Relief</ExternalLink>, which tax gains on
            selling a business or certain shares at a lower rate. These gains are imputed from
            HMRC Table <ExternalLink href={HMRC_TABLE_4}>4</ExternalLink>.
          </p>
        </Topic>
        <Topic title="Calibration">
          <p>
            Household weights are set so the sample matches {figures.targets ?? "a set of"}{" "}
            statistics. These include HMRC&apos;s CGT totals and size bands, gains by taxable
            income band, the relief&apos;s bands, residential property gains, age and region.
          </p>
        </Topic>
        <Topic title="Which gains are taxed how">
          <p>
            Today, residential property gains and gains qualifying for Business Asset Disposal
            Relief (with Investors&apos; Relief) have their own rate schedules.
          </p>
          <p>
            The reform taxes residential property gains at income tax rates, like other gains. It
            also withdraws the relief, so qualifying gains pay the new main rates. This matches{" "}
            <ExternalLink href={CENTAX_REPORT}>CenTax&apos;s</ExternalLink> rates-only estimate.
          </p>
          <p>
            Carried interest (fund managers&apos; share of profits) is unaffected. It has been
            taxed as income, outside CGT, since 6 April 2026.
          </p>
        </Topic>
        <Topic title="Results by group">
          <p>
            Budget figures and the breakdowns by income group, household type and region are
            weighted totals over the simulated households.
          </p>
        </Topic>

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
            Behavioural response: applied through a policy simulation modifier that registers the
            baseline branch, so the change in marginal rates is measured against current law; the
            pipeline checks the response is active before writing results. Each case sets{" "}
            <span className={CODE}>{metadata.elasticity_parameter}</span> and leaves the
            engine&apos;s marginal-tax-rate elasticity at zero.
          </li>
        </TechnicalDetails>
      </section>

      <section className="section-card scroll-mt-24" id="projection">
        <SectionHeading
          title="Projecting to later years"
          description={
            <div className="space-y-2">
              <p>
                The data describe one year, {baseYearLabel}. In each later year, capital gains
                grow with the OBR&apos;s forecast of GDP per head. Household weights grow with ONS
                population <ExternalLink href={ONS_PROJECTIONS}>projections</ExternalLink>.
              </p>
              <p>Nothing specific to CGT enters the projection.</p>
            </div>
          }
        />

        <Topic title="New taxpayers from growing gains">
          <p>
            Some people have gains just below the exempt amount
            {Number.isFinite(exemptAmount)
              ? ` (£${exemptAmount.toLocaleString("en-GB")}, frozen)`
              : ""}
            . They owe nothing in the base year. As gains grow, some cross it and start paying.
          </p>
          {figures.entrants ? (
            <p>
              The model adds about {figures.entrants.audit} such taxpayers by{" "}
              {figures.entrants.year}. The dataset&apos;s own bound is {figures.entrants.bound}.
              For comparison, HMRC counted {figures.entrants.hmrc} taxpayers with gains of{" "}
              {figures.entrants.band} in {figures.entrants.hmrcYear} (
              <ExternalLink href={HMRC_TABLE_2}>HMRC</ExternalLink> {figures.entrants.table}).
            </p>
          ) : (
            <p>{dataset.notes}</p>
          )}
          <p>
            The{" "}
            <TabLink onNavigate={onNavigate} tab="baseline" section="entrants">
              Baseline
            </TabLink>{" "}
            tab shows every figure with and without them.
          </p>
        </Topic>
        {obrGaps.length ? (
          <Topic title="Comparison with the OBR's forecast">
            <p>
              The model&apos;s baseline CGT bill differs from the OBR&apos;s{" "}
              <ExternalLink href={OBR_EFO}>forecast</ExternalLink> of CGT receipts (
              {obrComparison.obr_receipts_source}) by:
            </p>
            <ul
              className="flex flex-wrap gap-x-5 gap-y-1 tabular-nums"
              aria-label="Model minus OBR, by year"
            >
              {obrGaps.map((row) => (
                <li key={row.year}>
                  {row.year}{" "}
                  <span className="font-semibold text-slate-900">
                    {signedPercent(row.gap / 100)}
                  </span>
                </li>
              ))}
            </ul>
            <p>
              The two measure different things. Receipts arrive about a year after the tax they
              settle. The model grows gains smoothly from {baseYearLabel}, while the OBR forecasts
              receipts year by year.
            </p>
          </Topic>
        ) : null}

        <TechnicalDetails>
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
          {figures.entrants ? (
            <li>
              New taxpayers: the {figures.entrants.bound} bound is the dataset build&apos;s projection
              fence; the {figures.entrants.audit} count is this repository&apos;s uprating audit on
              policyengine-uk {metadata.policyengine_uk_version}.
            </li>
          ) : null}
        </TechnicalDetails>
      </section>

      <section className="section-card scroll-mt-24" id="elasticity">
        <SectionHeading
          title="How taxpayers respond to higher rates"
          description={
            <p className="">
              When CGT rates rise, people sell fewer assets or wait longer to sell. Fewer gains are
              then realised and taxed. The size of this response is the biggest single assumption
              behind the revenue estimates.
            </p>
          }
        />

        <Topic title="What is measured">
          <p>
            The response is an elasticity: the percentage change in realised gains for a 1%
            change in the share of each gain a taxpayer keeps after tax. That share is{" "}
            <span className="whitespace-nowrap">1 − t</span>, where t is the tax rate.
          </p>
          <p>
            This follows the convention of Advani, Lonsdale &amp; Summers (
            <ExternalLink href={CENTAX_REPORT}>CenTax</ExternalLink>, 2024, pp.{" "}
            <ExternalLink href={centaxPage(33)}>32</ExternalLink> and{" "}
            <ExternalLink href={centaxPage(38)}>37</ExternalLink>).
          </p>
        </Topic>
        <Topic title={`Central value: ${central.e_retention.toFixed(1)}`}>
          <p>
            This is CenTax&apos;s &ldquo;central elasticity estimate&rdquo; (p.{" "}
            <ExternalLink href={central.url}>37</ExternalLink>). It is also PolicyEngine UK&apos;s
            default.
          </p>
        </Topic>
        <Topic title="How it is applied">
          <p>For each person, realised gains are scaled as follows.</p>
          <ResponseFormula />
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <Sub base="t" sub="0" /> and <Sub base="t" sub="1" /> are the person&apos;s marginal
              rate on gains under current law and under the reform. Each is an average across the
              main, residential property and relief schedules, weighted by the gains on each.
            </li>
            <li>
              <math style={{ fontFamily: MATH_FONT }}>
                <mi>e</mi>
              </math>{" "}
              is the elasticity.
            </li>
          </ul>
        </Topic>
        <Topic title="Per person, not in aggregate">
          <p>
            CenTax apply one elasticity to total gains. This model applies it to each
            person&apos;s own marginal rate. It takes CenTax&apos;s convention but not their
            calculation.
          </p>
          <p>
            The elasticity is a power, so values away from 1.0, such as 0.5 and 2.0, also differ
            from a straight-line reading.
          </p>
        </Topic>
        <Topic title="Testing the assumption">
          <p>
            The{" "}
            <TabLink onNavigate={onNavigate} tab="reform" section="sensitivity">
              Reform
            </TabLink>{" "}
            tab&apos;s sensitivity chart shows the result in three ways: with no response, across
            CenTax&apos;s range
            {centaxRange
              ? ` (${centaxRange.lower.toFixed(1)} to ${centaxRange.upper.toFixed(1)})`
              : ""}
            , and at the official HMRC/OBR value described below.
          </p>
        </Topic>

        <aside
          aria-labelledby="main-caveat"
          className="mt-7 rounded-lg text-sm border border-amber-200 bg-amber-50/60 p-4 sm:p-5"
        >
          <h3 id="main-caveat" className="text-base font-semibold text-slate-900">
            Main caveat
          </h3>
          <div className={`mt-2 ${COLUMN}`}>
            <p>
              CenTax chose the central value for a package with two further reforms. It removes
              the uplift at death, which today wipes out the gain on assets held until death. It
              also charges gains when people leave the UK. Both close ways to defer or avoid the
              tax. This dashboard models neither.
            </p>
            <p>
              On today&apos;s tax base, CenTax expect a larger response to a rate rise. They advise
              against equalising rates without those reforms (Advani, Hughson &amp; Summers,{" "}
              <em>Taxes at the top</em>, CenTax, September 2026, pp.{" "}
              <ExternalLink href={taxesAtTheTopPage(19)}>17</ExternalLink>&ndash;
              <ExternalLink href={taxesAtTheTopPage(20)}>18</ExternalLink>).
            </p>
          </div>
        </aside>

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
            <p className="">
              HMRC and the OBR assume a much stronger response than CenTax. That is why HMRC&apos;s
              ready <ExternalLink href={READY_RECKONER_URL}>reckoner</ExternalLink>, its table of
              costings for rate changes, shows large rate rises losing revenue. This
              dashboard&apos;s central case raises revenue instead.
            </p>
          }
        />

        <div className="grid gap-3 text-sm sm:grid-cols-2">
          <ValueCard label="CenTax central" value={central.e_retention.toFixed(1)}>
            <p>Used for all gains in this dashboard&apos;s central case.</p>
          </ValueCard>
          <ValueCard label="HMRC/OBR official" value={official.e_retention.toFixed(1)}>
            <p>
              Used for the main CGT rates, and {official.badr_e_retention.toFixed(1)} for gains
              qualifying for Business Asset Disposal Relief (
              <ExternalLink href={`${official.url}#page=3`}>OBR</ExternalLink>,{" "}
              {formatPublished(official.published.slice(0, 7))}, para 1.9 and{" "}
              <ExternalLink href={`${official.url}#page=5`}>Table</ExternalLink> 1.1).
            </p>
            <p>
              HMRC&apos;s own <ExternalLink href={`${official.url}#page=3`}>estimate</ExternalLink>{" "}
              for 1998 to 2018 is 4.0 (para 1.10).
            </p>
          </ValueCard>
        </div>
        <div className={`mt-4 ${COLUMN}`}>
          <p>
            The main official value is {(official.e_retention / central.e_retention).toFixed(1)}{" "}
            times CenTax&apos;s central one. The dashboard&apos;s official case uses both official
            values, each on its own kind of gain.
          </p>
        </div>

        <Topic title="Why they differ">
          <p>
            HMRC&apos;s figure comes from UK responses under the current tax base. CenTax start
            from US evidence of about 1.5 five years after a change (
            <ExternalLink href={AGERSNAP_ZIDAR}>Agersnap</ExternalLink> &amp; Zidar, 2021).
          </p>
          <p>They lower it to {central.e_retention.toFixed(1)} for two reasons:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Their package removes the uplift at death, which the US keeps.</li>
            <li>
              Equalising rates brings income that was presented as gains back into income tax.
              Estimates based only on CGT count that income as lost.
            </li>
          </ul>
          <p>
            They make no adjustment for the charge on leaving the UK. The US evidence already
            reflects little scope to avoid the tax by emigrating.
          </p>
        </Topic>
        <Topic title="A worked example">
          <p>
            Take a taxpayer whose marginal rate on gains rises from 24% to 34%, the ready
            reckoner&apos;s largest row.
          </p>
          <div className="overflow-x-auto rounded-lg border border-slate-200 px-4 py-2">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th scope="col" className="py-2 pr-3 font-medium">
                    Elasticity
                  </th>
                  <th scope="col" className="py-2 pr-3 text-right font-medium">
                    Realised gains
                  </th>
                  <th scope="col" className="py-2 text-right font-medium">
                    Tax on them
                  </th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {[
                  ["Central", atCentral],
                  ["Official", atOfficial],
                ].map(([label, change]) => (
                  <tr key={label} className="border-b border-slate-100 last:border-0">
                    <th scope="row" className="py-2 pr-3 font-medium text-slate-900">
                      {label}
                    </th>
                    <td className="py-2 pr-3 text-right">{signedPercent(change.gains)}</td>
                    <td className="py-2 text-right font-semibold text-slate-900">
                      {signedPercent(change.revenue)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p>
            At the official value the tax {atOfficial.revenue >= 0 ? "rises" : "falls"}, the
            direction HMRC&apos;s row shows. Across the whole dataset, the effect depends on where
            taxpayers&apos; marginal rates sit.
          </p>
        </Topic>
        <Topic title="Where to see it">
          <p>
            The{" "}
            <TabLink onNavigate={onNavigate} tab="reform" section="sensitivity">
              Reform
            </TabLink>{" "}
            tab&apos;s sensitivity chart gives the reform&apos;s first-year revenue at each
            elasticity. The{" "}
            <TabLink onNavigate={onNavigate} tab="benchmarks">
              Benchmarks
            </TabLink>{" "}
            tab scores the ready reckoner&apos;s rows at the central and official values.
          </p>
        </Topic>
      </section>

      <section className="section-card scroll-mt-24" id="explorer">
        <SectionHeading
          title="Custom rates"
          description={
            <p className="">
              The{" "}
              <TabLink onNavigate={onNavigate} tab="reform">
                Reform
              </TabLink>{" "}
              tab&apos;s Custom rates option lets you set your own CGT rates and your own
              treatment of Business Asset Disposal Relief. It scores them on{" "}
              {dataset.shortLabel} for every modelled year, with the same model and assumptions
              as the main results.
            </p>
          }
        />

        <Topic title="What you can change">
          <p>
            Your rates apply to both the main and the residential property schedules. These have
            charged the same rates since 30 October 2024.
          </p>
          <p>
            You can withdraw the relief or keep it. If you keep it, its rate is a whole percentage
            point, no higher than the additional rate. Its lifetime limit is £500k, £1m (current
            law) or £10m (the limit until March 2020).
          </p>
        </Topic>
        <Topic title="How it runs">
          <p>
            Each schedule is simulated in full. Nothing is interpolated. The main reform,
            equalisation with the relief withdrawn, shows its results at once. Any other schedule
            runs live, including equalisation with one value changed.
          </p>
        </Topic>
        <Topic title="Saved results">
          <p>
            Every completed run is saved. Anyone who later asks for the same schedule gets it at
            once. A change to the data or the model always triggers a fresh run.
          </p>
        </Topic>

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
