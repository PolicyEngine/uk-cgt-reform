"use client";

import { useEffect } from "react";
import { getBenchmarks, getDatasetInfo, getFirstYear, getMetadata } from "../lib/dataHelpers";
import { formatBn, formatCount, formatPct, formatPublished, formatSmallBn } from "../lib/formatters";
import { MICROCOSM_URL, TabLink } from "./controls";
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
const CGT_RATES = "https://www.gov.uk/capital-gains-tax/rates";
const CARRIED_INTEREST =
  "https://www.gov.uk/government/publications/reform-of-the-tax-treatment-of-carried-interest";

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
      const element = document.getElementById(target);
      if (element?.tagName === "DETAILS") element.open = true;
      element?.scrollIntoView();
    }
  }, [anchor]);

  const dataset = getDatasetInfo(data);
  const figures = datasetFigures(dataset);
  const metadata = getMetadata(data);
  const { central, official } = getBenchmarks(data).elasticities;
  const centaxRange = getBenchmarks(data).elasticities.centax_range;
  const exemptAmount = data.validation?.entrants_by_uprating?.exempt_amount_gbp;
  // Entrants by uprating in the first year, beside the whole taxpayer base.
  const validation = data.validation;
  const entrants = validation?.entrants_by_uprating;
  const baseYear = metadata.projection.base_year;
  const baseYearLabel = `${baseYear}-${String(baseYear + 1).slice(2)}`;
  // The ready reckoner's largest row: the higher rate from 24% to 34%.
  const atCentral = responseTo(0.24, 0.34, central);
  const atOfficial = responseTo(0.24, 0.34, official);

  // A link to a section of this tab: open it if it folds, then scroll to it.
  const openSection = (id) => {
    const element = document.getElementById(id);
    if (element?.tagName === "DETAILS") element.open = true;
    element?.scrollIntoView();
  };

  const firstYear = getFirstYear(data);
  const lastYear = data.budget.at(-1).year;

  return (
    <div className="space-y-6">
      <section className="section-card scroll-mt-24" id="pathway">
        <SectionHeading
          title="Data and simulation"
          description={
            <p className="">
              The estimates come from{" "}
              <ExternalLink href="https://policyengine.org">PolicyEngine</ExternalLink> UK, a
              model of UK taxes and benefits. It runs on a representative sample of UK households
              for {firstYear} to {lastYear}. Capital gains are concentrated among few people, so
              the results depend on how well the sample captures them.
            </p>
          }
        />

        <Topic title="The dataset">
          <p>
            {dataset.label?.startsWith("Microcosm ") ? (
              <>
                <ExternalLink href={MICROCOSM_URL}>Microcosm</ExternalLink>
                {dataset.label.slice("Microcosm".length)}
              </>
            ) : (
              dataset.label
            )}
            . It starts from the Family Resources{" "}
            <ExternalLink href={FRS}>Survey</ExternalLink> and adds capital gains from HMRC{" "}
            <ExternalLink href={CGT_STATISTICS}>statistics</ExternalLink>. This dashboard uses it
            as published, with no reweighting.
          </p>
        </Topic>
        <Topic title="Gain sizes">
          <p>
            Gain sizes come from HMRC&apos;s Table{" "}
            <ExternalLink href={HMRC_TABLE_3}>3</ExternalLink> (size of gain by taxable income).
            This keeps the largest gains, which carry most of the tax, and puts each gain in its
            income tax band. Gains below the exempt <ExternalLink href={EXEMPT_AMOUNT}>amount</ExternalLink> (the
            yearly tax-free allowance) follow the Advani&ndash;Summers distribution, their
            estimate of how gains below it are spread, within each band.
          </p>
        </Topic>
        <Topic title="Asset types and reliefs">
          <p>
            Each person with gains gets a main asset type from HMRC Tables{" "}
            <ExternalLink href={HMRC_TABLE_7}>7</ExternalLink> and{" "}
            <ExternalLink href={HMRC_TABLE_8}>8</ExternalLink>. Residential property gains are
            kept separate. Some gains qualify for Business Asset Disposal{" "}
            <ExternalLink href={BADR_GUIDANCE}>Relief</ExternalLink> or Investors&apos;{" "}
            <ExternalLink href={INVESTORS_RELIEF}>Relief</ExternalLink>, which tax gains on
            selling a business or certain shares at a lower rate. These gains are imputed from
            HMRC Table <ExternalLink href={HMRC_TABLE_4}>4</ExternalLink>.
          </p>
        </Topic>
        <Topic title="Calibration">
          <p>
            Household weights are set so the sample matches {figures.targets ?? "a set of"}{" "}
            statistics. These include HMRC&apos;s CGT{" "}
            <ExternalLink href={CGT_STATISTICS}>totals</ExternalLink> and size bands, gains by taxable
            income band, the relief&apos;s bands, residential property gains, age and region.
          </p>
        </Topic>
        <Topic title="Which gains are taxed how">
          <p>
            Under current law, residential property gains and gains qualifying for Business Asset
            Disposal Relief (with Investors&apos; Relief) have their own rate schedules. The reform taxes residential property gains at income tax rates and
            withdraws the relief, so qualifying gains pay the new main rates, as in{" "}
            <ExternalLink href={CENTAX_REPORT}>CenTax&apos;s</ExternalLink> rates-only estimate.
            Carried interest (fund managers&apos; share of profits) has been taxed as{" "}
            <ExternalLink href={CARRIED_INTEREST}>income</ExternalLink>, outside CGT, since 6 April
            2026, so the reform does not affect it.
          </p>
        </Topic>
        <Topic title="How the relief is modelled" id="relief">
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              <strong className="font-semibold text-slate-800">Current law.</strong> Gains
              qualifying for Business Asset Disposal{" "}
              <ExternalLink href={BADR_GUIDANCE}>Relief</ExternalLink> pay one rate whatever the
              person&apos;s income tax band: 10% to 2024-25, 14% in 2025-26 and 18% from 6 April
              2026. The rate applies to up to £1m of qualifying gains over a person&apos;s lifetime;
              gains above that pay the main rates.
            </li>
            <li>
              <strong className="font-semibold text-slate-800">The lifetime limit.</strong> The
              data hold one year&apos;s gains and no record of earlier claims, so the model applies
              the £1m to each year&apos;s qualifying gains as if none of it had been used before.
              In 2024-25, the data&apos;s own year, qualifying gains are calibrated to what HMRC
              records as relieved, so earlier use is already reflected; the{" "}
              <TabLink onNavigate={onNavigate} tab="baseline" section="benchmarks">
                Baseline
              </TabLink>{" "}
              tab shows the claimants and gains beside HMRC&apos;s. In later years, gains that grow
              but stay under £1m are not checked against earlier claims; this overstates baseline
              relief by at most about £0.1bn of CGT a year.
            </li>
            <li>
              <strong className="font-semibold text-slate-800">Investors&apos; Relief.</strong>{" "}
              HMRC Table <ExternalLink href={HMRC_TABLE_4}>4</ExternalLink> reports it with Business
              Asset Disposal Relief, so the model treats the two together, with one £1m limit. In
              law, Investors&apos; <ExternalLink href={INVESTORS_RELIEF}>Relief</ExternalLink> had
              its own £10m limit until 30 October 2024.
            </li>
            <li>
              <strong className="font-semibold text-slate-800">Under the reform.</strong>{" "}
              Withdrawing the relief sets the limit to zero, so all qualifying gains pay the new
              main rates. Custom rates can instead keep the relief at a chosen rate and a lifetime
              limit of £500k, £1m or £10m.
            </li>
            <li>
              <strong className="font-semibold text-slate-800">Behaviour.</strong> Qualifying gains
              respond like other gains, except under the HMRC/OBR official assumption, which gives
              them their own elasticity (described{" "}
              <TabLink onNavigate={() => openSection("elasticity-gap")}>below</TabLink>).
            </li>
          </ul>
        </Topic>
        <Topic title="Results by group">
          <p>
            Budget figures and the breakdowns by income group, household type and region are
            weighted totals over the simulated households.
          </p>
        </Topic>

      </section>

      <section className="section-card scroll-mt-24" id="projection">
        <SectionHeading
          title="Projecting to later years"
          description={
            <div className="space-y-2">
              <p>
                The data describe one year, {baseYearLabel}. In each later year, capital gains
                grow with the OBR&apos;s <ExternalLink href={OBR_EFO}>forecast</ExternalLink> of GDP
                per head. Household weights grow with ONS population{" "}
                <ExternalLink href={ONS_PROJECTIONS}>projections</ExternalLink>. Nothing specific to
                CGT enters the projection.
              </p>
            </div>
          }
        />

        <Topic title="New taxpayers from growing gains" id="new-taxpayers">
          <p>
            Some people have gains below the exempt{" "}
            <ExternalLink href={EXEMPT_AMOUNT}>amount</ExternalLink>
            {Number.isFinite(exemptAmount)
              ? ` (£${exemptAmount.toLocaleString("en-GB")}, frozen)`
              : ""}
            . They owe nothing in the base year. As gains grow, some cross it and start paying.{" "}
            {figures.entrants ? (
              <>
                The model adds about {figures.entrants.audit} such taxpayers by{" "}
                {figures.entrants.year}. The dataset&apos;s own bound is {figures.entrants.bound}.
                HMRC counted {figures.entrants.hmrc} taxpayers with gains of{" "}
                {figures.entrants.band} in {figures.entrants.hmrcYear} (
                <ExternalLink href={HMRC_TABLE_2}>HMRC</ExternalLink> {figures.entrants.table}).
              </>
            ) : (
              dataset.notes
            )}
            {entrants
              ? ` In ${firstYear} they are ${formatCount(entrants.count)} of ${formatCount(validation.cgt_taxpayers)} CGT taxpayers (${formatPct((100 * entrants.count) / validation.cgt_taxpayers, 1)}) and ${formatSmallBn(entrants.gains_bn)} of ${formatBn(validation.total_gains_bn, 1)} in taxable gains.`
              : ""}
          </p>
        </Topic>

      </section>

      <section className="section-card scroll-mt-24" id="elasticity">
        <SectionHeading
          title="How taxpayers respond to higher rates"
          description={
            <p className="">
              When CGT rates rise, people sell fewer assets or wait longer to sell. Fewer gains are
              then realised and taxed. The revenue estimates depend on the size of this response.
            </p>
          }
        />

        <Topic title="What is measured">
          <p>
            The response is an elasticity: the percentage change in realised gains for a 1%
            change in the share of each gain a taxpayer keeps after tax. That share is{" "}
            <span className="whitespace-nowrap">1 − t</span>, where t is the tax rate. This follows the convention of Advani, Lonsdale &amp; Summers (
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
            calculation. The elasticity is a power, so values away from 1.0, such as 0.5 and 2.0, also differ
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
            , and at the official HMRC/OBR value described{" "}
            <TabLink onNavigate={() => openSection("elasticity-gap")}>below</TabLink>
            .
          </p>
        </Topic>

        <aside
          aria-labelledby="main-caveat"
          className="mt-7 rounded-lg text-sm border border-amber-200 bg-amber-50/60 p-4 sm:p-5"
        >
          <h3 id="main-caveat" className="text-base font-semibold text-slate-900">
            Scope of CenTax&apos;s central value
          </h3>
          <div className={`mt-2 ${COLUMN}`}>
            <p>
              CenTax&apos;s central value applies to a package that also ends the uplift at death,
              under which gains on assets held until death are not taxed, and taxes gains when
              people leave the UK; this dashboard models the rate changes only (see{" "}
              <TabLink onNavigate={() => openSection("not-modelled")}>below</TabLink>). CenTax
              estimate a larger behavioural response when rates change without those measures, and
              state that they would not equalise rates without them (Advani, Hughson &amp; Summers,{" "}
              <em>Taxes at the top</em>, CenTax, September 2026, pp.{" "}
              <ExternalLink href={taxesAtTheTopPage(19)}>17</ExternalLink>&ndash;
              <ExternalLink href={taxesAtTheTopPage(20)}>18</ExternalLink>).
            </p>
          </div>
        </aside>

        <Topic title="What the model leaves out" id="not-modelled">
          <ul className="list-disc space-y-1 pl-5">
            <li>No investment allowance: the full gain is taxed, with no deduction for a normal return.</li>
            <li>No change to the uplift at death: gains on assets held until death stay untaxed.</li>
            <li>No exit charge: gains are not taxed when people leave the UK.</li>
            <li>
              No migration response: the number and mix of taxpayers do not change with the
              reform; any effect of people leaving or arriving is not modelled beyond what the
              elasticity captures.
            </li>
          </ul>
        </Topic>
      </section>

      <details className="section-card group scroll-mt-24" id="elasticity-gap">
        <summary className="cursor-pointer select-none text-xl font-semibold tracking-tight text-slate-900 marker:text-[color:var(--pe-color-primary-600)]">
          How strongly people respond: CenTax and HMRC
        </summary>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          The elasticity measures how much people cut the gains they realise when the tax rate
          rises. HMRC and the{" "}
          <ExternalLink href={`${official.url}#page=3`}>OBR</ExternalLink> assume a stronger
          response than{" "}
          <ExternalLink href={CENTAX_REPORT}>CenTax</ExternalLink>. With HMRC&apos;s value, raising
          the higher rate by 5 or 10 points loses revenue, as its ready{" "}
          <ExternalLink href={READY_RECKONER_URL}>reckoner</ExternalLink> shows; with
          CenTax&apos;s value, the same rises bring in more.
        </p>

        <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <ValueCard label="CenTax central" value={central.e_retention.toFixed(1)}>
            <p>This dashboard&apos;s central case, for all gains.</p>
          </ValueCard>
          <ValueCard label="HMRC/OBR official" value={official.e_retention.toFixed(1)}>
            <p>
              For the main CGT rates, and {official.badr_e_retention.toFixed(1)} for gains
              qualifying for Business Asset Disposal{" "}
              <ExternalLink href={BADR_GUIDANCE}>Relief</ExternalLink> (
              <ExternalLink href={`${official.url}#page=3`}>OBR</ExternalLink>,{" "}
              {formatPublished(official.published.slice(0, 7))}, para 1.9 and{" "}
              <ExternalLink href={`${official.url}#page=5`}>Table</ExternalLink> 1.1). HMRC&apos;s
              own estimate for 1998 to 2018 is 4.0 (para 1.10).
            </p>
          </ValueCard>
        </div>

        <Topic title="Why the two values differ">
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              <strong className="font-semibold text-slate-800">HMRC</strong> estimate theirs from
              how UK taxpayers responded to past rate changes under today&apos;s rules.
            </li>
            <li>
              <strong className="font-semibold text-slate-800">CenTax</strong> start from US
              evidence of about 1.5 five years after a change (
              <ExternalLink href={AGERSNAP_ZIDAR}>Agersnap</ExternalLink> &amp; Zidar, 2021) and
              lower it to {central.e_retention.toFixed(1)} for two reasons:
              <ul className="mt-1 list-[circle] space-y-1 pl-5">
                <li>
                  their package ends the uplift at death, which the US keeps, so holding assets
                  until death no longer avoids the tax;
                </li>
                <li>
                  with equal rates, there is no gain from presenting income as capital gains, so
                  income that moves back into income tax is not lost revenue.
                </li>
              </ul>
            </li>
            <li>CenTax make no adjustment for the charge on people leaving the UK.</li>
          </ul>
        </Topic>
        <Topic title="A worked example">
          <p>
            Take a taxpayer whose rate on gains rises from 24% to 34%, the ready{" "}
            <ExternalLink href={READY_RECKONER_URL}>reckoner&apos;s</ExternalLink> largest row:
          </p>
          <div className="overflow-x-auto rounded-lg border border-slate-200 px-4 py-2">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th scope="col" className="py-2 pr-3 font-medium">
                    Elasticity
                  </th>
                  <th scope="col" className="py-2 pr-3 text-right font-medium">
                    Gains realised
                  </th>
                  <th scope="col" className="py-2 text-right font-medium">
                    Tax paid on them
                  </th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {[
                  [`CenTax (${central.e_retention.toFixed(1)})`, atCentral],
                  [`HMRC/OBR (${official.e_retention.toFixed(1)})`, atOfficial],
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
            With CenTax&apos;s value the tax paid {atCentral.revenue >= 0 ? "rises" : "falls"}; with
            the official value it {atOfficial.revenue >= 0 ? "rises" : "falls"}, as in HMRC&apos;s{" "}
            <ExternalLink href={READY_RECKONER_URL}>table</ExternalLink>. Across all taxpayers, the result depends on each person&apos;s rate.
          </p>
        </Topic>
        <Topic title="Where to see it">
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              The{" "}
              <TabLink onNavigate={onNavigate} tab="reform" section="sensitivity">
                Reform
              </TabLink>{" "}
              tab&apos;s sensitivity chart shows the reform&apos;s revenue at each value.
            </li>
            <li>
              The{" "}
              <TabLink onNavigate={onNavigate} tab="baseline" section="ready-reckoner">
                Baseline
              </TabLink>{" "}
              tab scores the ready reckoner&apos;s rows at the official values, 3.0 and{" "}
              {central.e_retention.toFixed(1)}.
            </li>
          </ul>
        </Topic>
      </details>

      <details className="section-card group scroll-mt-24" id="explorer">
        <summary className="cursor-pointer select-none text-xl font-semibold tracking-tight text-slate-900 marker:text-[color:var(--pe-color-primary-600)]">
          Custom rates
        </summary>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            The{" "}
            <TabLink onNavigate={onNavigate} tab="reform">
              Reform
            </TabLink>{" "}
            tab&apos;s Custom rates option lets you set your own CGT rates and your own
            treatment of Business Asset Disposal{" "}
            <ExternalLink href={BADR_GUIDANCE}>Relief</ExternalLink>. It scores them on{" "}
            {dataset.shortLabel?.startsWith("Microcosm") ? (
              <>
                <ExternalLink href={MICROCOSM_URL}>Microcosm</ExternalLink>
                {dataset.shortLabel.slice("Microcosm".length)}
              </>
            ) : (
              dataset.shortLabel
            )}{" "}
            for every modelled year, with the same model and assumptions
            as the main results.
          </p>


        <Topic title="Options">
          <p>
            Your rates apply to the main and residential property schedules, which have charged
            the same <ExternalLink href={CGT_RATES}>rates</ExternalLink> since 30 October 2024.
            The relief can be withdrawn or kept, at a whole-point rate no higher than the
            additional rate and a lifetime limit of £500k, £1m (current law) or £10m (the limit
            until March 2020).
          </p>
        </Topic>
        <Topic title="Runs and saved results">
          <p>
            Each schedule is simulated in full, with nothing interpolated. Equalisation with the
            relief withdrawn shows its results at once; any other schedule, including
            equalisation with one value changed, runs live. Completed runs are saved and reused
            for the same schedule; a change to the data or the model triggers a fresh run.
          </p>
        </Topic>
      </details>
    </div>
  );
}
