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
const POLICYENGINE_UK = "https://github.com/PolicyEngine/policyengine-uk";
// The sub-exempt gains distribution Microcosm draws from (its build's source).
const ADVANI_SUMMERS = "https://warwick.ac.uk/fac/soc/economics/research/centres/cage/manage/publications/wp465.2020.pdf";
const CARRIED_INTEREST =
  "https://www.gov.uk/government/publications/reform-of-the-tax-treatment-of-carried-interest";

// A calendar year as the fiscal year it starts ("2030" -> "2030-31").
const fiscalYear = (year) => `${year}-${String(Number(year) + 1).slice(2)}`;

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
  const exemptAmount = data.validation?.entrants_by_uprating?.exempt_amount_gbp;
  // Entrants by uprating in the first year, beside the whole taxpayer base.
  const validation = data.validation;
  const entrants = validation?.entrants_by_uprating;
  const baseYear = metadata.projection.base_year;
  const baseYearLabel = `${baseYear}-${String(baseYear + 1).slice(2)}`;
  // A higher-rate taxpayer under the reform: 24% to 40%.
  const atCentral = responseTo(0.24, 0.4, central);
  const atOfficial = responseTo(0.24, 0.4, official);

  // A link to a section of this tab: open it if it folds, then scroll to it.
  const openSection = (id) => {
    const element = document.getElementById(id);
    if (element?.tagName === "DETAILS") element.open = true;
    element?.scrollIntoView();
  };

  const firstYear = getFirstYear(data);
  const yearLabels = Object.keys(data.sensitivity ?? {});
  const lastYear = yearLabels.at(-1) ?? firstYear;
  // The last year's growth in gains: the step in the projection's
  // cumulative factor between the last two years.
  const gainFactors = metadata.projection.cumulative_factors?.capital_gains_before_response ?? {};
  const factorYears = Object.keys(gainFactors).sort();
  const lastGrowth =
    factorYears.length > 1
      ? gainFactors[factorYears.at(-1)] / gainFactors[factorYears.at(-2)] - 1
      : NaN;

  return (
    <div className="space-y-6">
      <section className="section-card scroll-mt-24" id="pathway">
        <SectionHeading
          title="Data and simulation"
          description={
            <p className="">
              The estimates come from{" "}
              <ExternalLink href={POLICYENGINE_UK}>PolicyEngine UK</ExternalLink>, a model of UK
              taxes and benefits. It runs on a sample of UK households for {baseYearLabel},
              projected to later years. Capital gains are concentrated among few people, so the
              results depend on how well the sample captures them.
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
            income tax band. Within each band, gains below the exempt{" "}
            <ExternalLink href={EXEMPT_AMOUNT}>amount</ExternalLink> (the yearly tax-free allowance)
            are spread using Advani and Summers&apos;{" "}
            <ExternalLink href={ADVANI_SUMMERS}>estimate</ExternalLink>.
          </p>
        </Topic>
        <Topic title="Asset types and reliefs">
          <p>
            Each person with gains gets a main asset type from HMRC Tables{" "}
            <ExternalLink href={HMRC_TABLE_7}>7</ExternalLink> and{" "}
            <ExternalLink href={HMRC_TABLE_8}>8</ExternalLink>. Residential property gains are
            kept separate. Some gains qualify for Business Asset Disposal{" "}
            <ExternalLink href={BADR_GUIDANCE}>Relief</ExternalLink> or Investors&apos;{" "}
            <ExternalLink href={INVESTORS_RELIEF}>Relief</ExternalLink>; these gains are assigned
            from HMRC Table <ExternalLink href={HMRC_TABLE_4}>4</ExternalLink>.
          </p>
        </Topic>
        <Topic title="Calibration">
          <p>
            Household weights are calibrated to {figures.targets ?? "a set of"} statistics across
            the tax and benefit system. The CGT ones are HMRC&apos;s{" "}
            <ExternalLink href={CGT_STATISTICS}>totals</ExternalLink> and size bands, gains by
            taxable income band, relief claims by size, and residential property gains.
          </p>
        </Topic>
        <Topic title="Which gains are taxed how">
          <p>
            Under current law, residential property gains and gains qualifying for Business Asset
            Disposal Relief (with Investors&apos; Relief) have their own rate schedules. The reform
            taxes main and residential property gains at income tax rates (20%, 40%, 45%); how it
            treats the relief is set out{" "}
            <TabLink onNavigate={() => openSection("relief")}>below</TabLink>. Carried interest (fund
            managers&apos; share of profits) has been taxed under income{" "}
            <ExternalLink href={CARRIED_INTEREST}>tax</ExternalLink>, outside CGT, since 6 April
            2026, so the reform does not affect it.
          </p>
        </Topic>
        <Topic title="Results by group">
          <p>
            Budget figures and the breakdowns by income group, household type and region are
            weighted totals and averages over the simulated households.
          </p>
        </Topic>

      </section>

      <section className="section-card scroll-mt-24" id="relief">
        <SectionHeading
          title="How the relief is modelled"
          description={<p>What the relief is, how this dashboard treats it, and the limits of the data.</p>}
        />
        <div className={`mt-4 ${COLUMN}`}>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>
                <strong className="font-semibold text-slate-800">What it is.</strong> Business Asset
                Disposal <ExternalLink href={BADR_GUIDANCE}>Relief</ExternalLink> lowers the tax on
                gains from selling a business or qualifying shares. Those gains pay one rate whatever
                the person&apos;s income: 10% up to 2024-25, 14% in 2025-26 and 18% from April 2026.
                This rate applies to up to £1m of such gains over a person&apos;s lifetime; gains above
                that pay the main rates.
              </li>
              <li>
                <strong className="font-semibold text-slate-800">In this reform.</strong> The relief
                stays as under current law. Custom rates can withdraw it, as{" "}
                <ExternalLink href={CENTAX_REPORT}>CenTax&apos;s</ExternalLink> rates-only estimate
                does, or change its rate and limit (see{" "}
                <TabLink onNavigate={() => openSection("explorer")}>Custom rates</TabLink>).
              </li>
              <li>
                <strong className="font-semibold text-slate-800">The £1m lifetime limit.</strong> The
                data show one year of gains, not past claims, so the model applies the £1m within each
                year. This comes close: the 2024-25 data match what HMRC records people actually
                claimed, after any earlier use (see{" "}
                <TabLink onNavigate={onNavigate} tab="baseline" section="benchmarks">
                  Baseline
                </TabLink>
                ), and HMRC and the{" "}
                <ExternalLink href="https://obr.uk/docs/dlm_uploads/CGT-supplementary-release-Jan-2025.pdf">OBR</ExternalLink>{" "}
                also cost it from one year&apos;s returns, split by rate (OBR, January 2025, para 1.4).
                Gains that grow past £1m pay the main rates on the excess: £0.8bn of gains in
                2027-28, adding about £0.05bn to baseline CGT and more each year as gains grow. The
                reform taxes that excess at 40% or 45%.
              </li>
              <li>
                <strong className="font-semibold text-slate-800">2024-25 was unusual.</strong> Claims
                jumped from 42k people and £11.0bn of gains in 2023-24 to 61k and £18.4bn, as owners
                sold before the rate rose in April 2025 (the OBR assumed +60%: January 2025, para
                1.12). The model carries that level forward, so it may overstate these gains in later
                years. This matters most for custom runs that change the relief; in the headline
                reform it affects only the gains above £1m and the behavioural response.
              </li>
              <li>
                <strong className="font-semibold text-slate-800">Investors&apos; Relief.</strong> The
                model counts it with this relief under one £1m limit, as HMRC&apos;s statistics report
                them together. In law it has its own £1m limit (£10m before 30 October 2024; TCGA
                1992{" "}
                <ExternalLink href="https://www.legislation.gov.uk/ukpga/1992/12/section/169VK">s.169VK</ExternalLink>
                ).
              </li>
              <li>
                <strong className="font-semibold text-slate-800">Behaviour.</strong> These gains
                respond like other gains, except under the official HMRC/OBR assumption, which gives
                them their own, lower elasticity (see{" "}
                <TabLink onNavigate={() => openSection("elasticity-gap")}>below</TabLink>).
              </li>
            </ul>
        </div>
      </section>

      <section className="section-card scroll-mt-24" id="projection">
        <SectionHeading
          title="Projecting to later years"
          description={
            <div className="space-y-2">
              <p>
                The data describe one year, {baseYearLabel}. The results cover {firstYear} to{" "}
                {lastYear}. In each later year, capital gains grow with cash GDP per person (the
                OBR&apos;s March 2026 <ExternalLink href={OBR_EFO}>forecast</ExternalLink> of nominal
                GDP, less population growth); the forecast ends in 2030-31, so in 2031-32 gains grow
                at its 2030-31 rate
                {Number.isFinite(lastGrowth) ? ` (${formatPct(100 * lastGrowth, 2)})` : ""}. Household
                weights grow with ONS population{" "}
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
                By {fiscalYear(figures.entrants.year)} about {figures.entrants.audit} such
                taxpayers are added (the dataset&apos;s build expects about{" "}
                {figures.entrants.bound}). HMRC counted {figures.entrants.hmrc} taxpayers with gains of{" "}
                {figures.entrants.band} in {figures.entrants.hmrcYear} (
                <ExternalLink href={HMRC_TABLE_2}>HMRC</ExternalLink> {figures.entrants.table}).
              </>
            ) : (
              dataset.notes
            )}
            {entrants
              ? ` In ${firstYear} they are ${formatCount(entrants.count)} of ${formatCount(validation.cgt_taxpayers)} CGT taxpayers (${formatPct((100 * entrants.count) / validation.cgt_taxpayers, 1)}) and ${formatSmallBn(entrants.gains_bn)} of ${formatBn(validation.total_gains_bn, 1)} in the gains of CGT taxpayers.`
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
            calculation. The elasticity is a power, so 2.0 does not give twice the response of 1.0.
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
              CenTax&apos;s central value applies to a package that also adds an investment
              allowance, ends the uplift at death and taxes gains when people leave the UK; this
              dashboard models the rate changes only (see{" "}
              <TabLink onNavigate={() => openSection("not-modelled")}>below</TabLink>). CenTax
              expect a larger response without those measures, and state that they would not equalise rates without them (Advani, Hughson &amp; Summers,{" "}
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
          HMRC and the{" "}
          <ExternalLink href={`${official.url}#page=3`}>OBR</ExternalLink> assume a stronger
          response than{" "}
          <ExternalLink href={CENTAX_REPORT}>CenTax</ExternalLink>. With HMRC&apos;s value, raising
          the higher rate by 5 or 10 points loses revenue, as HMRC&apos;s{" "}
          <ExternalLink href={READY_RECKONER_URL}>table</ExternalLink> of small rate changes (its
          &lsquo;ready reckoner&rsquo;) shows; with
          CenTax&apos;s value, the same rises bring in more.
        </p>

        <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <ValueCard label="CenTax central" value={central.e_retention.toFixed(1)}>
            <p>This dashboard&apos;s central case, for all gains.</p>
          </ValueCard>
          <ValueCard label="HMRC/OBR official" value={official.e_retention.toFixed(1)}>
            <p>
              For the main rates, and {official.badr_e_retention.toFixed(1)} for gains
              qualifying for Business Asset Disposal{" "}
              <ExternalLink href={BADR_GUIDANCE}>Relief</ExternalLink> (
              <ExternalLink href={`${official.url}#page=3`}>OBR</ExternalLink>,{" "}
              {formatPublished(official.published.slice(0, 7))}, para 1.9 and{" "}
              <ExternalLink href={`${official.url}#page=5`}>Table</ExternalLink> 1.1). This
              dashboard also applies it to residential property gains, whose rates that measure did
              not change.
            </p>
          </ValueCard>
        </div>

        <Topic title="Why the two values differ">
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              <strong className="font-semibold text-slate-800">HMRC</strong> start from 4.0, the
              value for shares and non-residential property agreed with the OBR in 2020 after HMRC
              analysed UK gains from 1998 to 2018. They lower it to{" "}
              {official.e_retention.toFixed(1)} for three reasons: aligned rates and the higher relief
              rate leave fewer ways to avoid the rise; forestalling is already in the baseline
              forecast; and the UK&apos;s effective rate stays near the average of advanced
              economies (OBR, January 2025, para 1.10).
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
            <li>
              CenTax make no adjustment for leaving the country: the US and Canada already tax gains
              on departure, as CenTax&apos;s package would.
            </li>
          </ul>
        </Topic>
        <Topic title="A worked example">
          <p>
            Take a higher-rate taxpayer whose rate on gains rises from 24% to 40% under the reform:
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
            the official value it {atOfficial.revenue >= 0 ? "rises" : "falls"}. Across all
            taxpayers, the result depends on each person&apos;s rate. The{" "}
            <TabLink onNavigate={onNavigate} tab="reform" section="response">
              Reform
            </TabLink>{" "}
            tab&apos;s revenue and behavioural response chart runs the reform at elasticities from 0
            to 4; the{" "}
            <TabLink onNavigate={onNavigate} tab="baseline" section="ready-reckoner">
              Baseline
            </TabLink>{" "}
            tab scores HMRC&apos;s small rate changes at {official.e_retention.toFixed(1)},{" "}
            {Number(getBenchmarks(data).ready_reckoner.elasticities.elasticity_3).toFixed(1)} and{" "}
            {central.e_retention.toFixed(1)}.
          </p>
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
            for every modelled year, with the same model as the main results; the behavioural
            response is yours to choose.
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
            Each set of rates is run through the full model; nothing is estimated from other
            runs. Equalisation with the
            relief kept shows its results at once; any other schedule, including
            equalisation with one value changed, runs live. Completed runs are saved and reused
            for the same schedule; a change to the data or the model triggers a fresh run.
          </p>
        </Topic>
      </details>
    </div>
  );
}
