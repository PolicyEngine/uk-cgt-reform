"use client";

import { useEffect } from "react";
import {
  getApproachOptions,
  getBenchmarks,
  getDatasetInfo,
  getIncomeShifting,
  getMetadata,
  getSensitivity,
} from "../lib/dataHelpers";
import {
  formatElasticityValue,
  formatPublished,
  formatSignedBn,
} from "../lib/formatters";
import { ReadingLayout } from "./ReadingGuide";
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

// The engine floors each marginal rate at 0.1% in the marginal-rate form.
const MTR_FLOOR = 0.001;

// How realised gains and the revenue on them respond when one rate moves
// from t0 to t1, in the form the engine applies to a case: PolicyEngine's
// elasticity with respect to the rate, realised gains scaled by
// (t1 / t0) ** e; the rest with respect to the retention rate, scaled by
// ((1 - t1) / (1 - t0)) ** e.
function responseTo(t0, t1, { elasticity, applied_as: appliedAs }) {
  const gains =
    appliedAs === "mtr"
      ? (Math.max(t1, MTR_FLOOR) / Math.max(t0, MTR_FLOOR)) ** elasticity
      : ((1 - t1) / (1 - t0)) ** elasticity;
  return { gains: gains - 1, revenue: (gains * t1) / t0 - 1 };
}

// The retention-rate elasticity that an elasticity with respect to the
// marginal rate equals at the rate t, for small changes around it.
const pointRetention = (eMtr, t) => (-eMtr * (1 - t)) / t;

function percent(change) {
  return `${Math.abs(100 * change).toFixed(0)}%`;
}

const share = (rate) => `${Math.round(100 * rate)}%`;

// CenTax's PDF pages run one ahead of its printed pages (#page=37 opens
// printed p. 36); the text cites printed pages.
const CENTAX_2024_PDF =
  "https://centax.org.uk/wp-content/uploads/2024/10/AdvaniLonsdaleSummers2024_CGTReform.pdf";

export default function MethodologyTab({ data, anchor }) {
  // Analysis sections can link here with /?tab=methodology#<id>, or open the
  // tab at a section (``anchor``); the tab mounts after navigation, so the
  // browser's native hash scroll has already missed and we replay it.
  useEffect(() => {
    const target = anchor ?? window.location.hash.slice(1);
    if (target) {
      const section = document.getElementById(target);
      if (section?.tagName === "DETAILS") section.open = true;
      section?.scrollIntoView();
    }
  }, [anchor]);

  const dataset = getDatasetInfo(data);
  const metadata = getMetadata(data);
  const {
    central,
    centax,
    centax_central: centaxCentral,
    unadjusted,
    official,
    centax_range: centaxRange,
  } = getBenchmarks(data).elasticities;
  const { approach } = data;
  const netOfShifting = approach.id === "total_revenue";
  const approaches = Object.fromEntries(
    getApproachOptions(data).map((a) => [a.id, a]),
  );
  const shifting = getIncomeShifting(data);
  const cases = Object.fromEntries(
    data.sensitivity_all.map((row) => [row.id, row]),
  );
  const officialOffset = cases.official.income_shifting_offset_2026_bn;
  const centralOffset = cases[central.id].income_shifting_offset_2026_bn;
  const revenueAt = (id) =>
    getSensitivity(data).find((row) => row.id === id).revenue_2026_bn;
  // The central case's value, and the retention-rate elasticity it behaves
  // like over each of the reform's rate changes.
  const e = formatElasticityValue(central.elasticity);
  const [basic, higher, additional] = central.retention_equivalents.map((row) =>
    row.e_retention.toFixed(1),
  );
  // The US studies behind the central case, as each paper reports them.
  const evidence = Object.fromEntries(
    central.evidence.map((row) => [row.study, row]),
  );
  const notch = evidence["Dowd and McClelland (2019)"];
  const panel = evidence["Dowd, McClelland and Muthitacharoen (2015)"];
  const auten = evidence["Auten and Clotfelter (1982)"];
  const estimate = (value) => formatElasticityValue(value, 2);
  // How far a 10% rise in the rate lowers realised gains at the central case.
  const tenPercentRise = (100 * (1 - 1.1 ** central.elasticity)).toFixed(1);
  // The rate at which the central case equals CenTax's central elasticity.
  const parity =
    -central.elasticity / (centaxCentral.elasticity - central.elasticity);
  const revenuePeak = (eRetention) => share(1 / (1 + eRetention));
  // A cut from 24% to nothing, as a multiple of the gains it reaches.
  const cutToZero = (caseOf) => {
    const multiple = 1 + responseTo(0.24, 0, caseOf).gains;
    return multiple >= 10 ? multiple.toFixed(0) : multiple.toFixed(1);
  };
  // The ready reckoner's largest row: the higher rate from 24% to 34%.
  const atCentral = responseTo(0.24, 0.34, central);
  const atCentax = responseTo(0.24, 0.34, centaxCentral);
  const atOfficial = responseTo(0.24, 0.34, official);

  return (
    <ReadingLayout
      sections={[
        { id: "method-overview", label: "The analysis in four steps" },
        { id: "pathway", label: "Data and simulation" },
        { id: "elasticity", label: "Behavioural response" },
        { id: "conversion", label: "Elasticity definitions" },
        { id: "elasticity-gap", label: "The official case" },
        { id: "income-shifting", label: "Income shifting" },
        { id: "explorer", label: "The rate explorer" },
      ]}
    >
      <section className="story-section" id="method-overview">
        <p className="eyebrow">From households to an estimate</p>
        <h2>How we build the results</h2>
        <p className="section-intro">
          The same households are simulated under current policy and a reform.
          The difference gives the revenue and income effects.
        </p>
        <ol className="method-steps">
          <li>
            <h3>Start with the population</h3>
            <p>
              {dataset.shortLabel} combines household survey data with imputed
              capital gains and weights calibrated to HMRC statistics. It is a
              staged dataset, not a certified release.
            </p>
          </li>
          <li>
            <h3>Change the policy</h3>
            <p>
              Apply the new CGT rates and treatment of Business Asset Disposal
              Relief, keeping the rest of the system the same.
            </p>
          </li>
          <li>
            <h3>Allow people to respond</h3>
            <p>
              An elasticity describes how realised gains change as rates change.
              The central case uses {e} with respect to the tax rate;
              sensitivity cases use a different, retention-rate definition.
            </p>
          </li>
          <li>
            <h3>Compare the outcomes</h3>
            <p>
              Sum the weighted revenue change. Then group households by their
              baseline income, age, type or region. Where selected, income
              shifting adds income tax and NI to revenue, but not to the
              household results.
            </p>
          </li>
        </ol>
        <div className="analysis-note">
          <strong>What these results mean.</strong> The medium-term response
          applies in full from the first year. Household net income includes
          realised gains, so its change includes gains no longer realised as
          well as extra tax. It is not a measure of welfare or lost wealth.
        </div>
        <p className="source-note">
          Open a section below for the evidence, equations, sources and
          limitations.
        </p>
      </section>
      <details className="section-card method-detail scroll-mt-24" id="pathway">
        <summary>Data and simulation</summary>
        <div>
          <SectionHeading title="Data and simulation" />
          <ul className="mt-2 list-disc space-y-2 pl-5 text-sm leading-6 text-slate-600">
            <li>
              <strong>The dataset.</strong> {dataset.label}: {dataset.producer}.
              Pinned input{" "}
              <span className="break-all font-mono text-xs">{dataset.uri}</span>{" "}
              (sha256{" "}
              <span className="font-mono text-xs">
                {dataset.sha256.slice(0, 12)}…
              </span>
              ), checked before anything runs and used exactly as published with
              no local reweighting &mdash; calibration belongs upstream in the
              dataset, so whatever the file provides is what is simulated here.
              It is a staged build from{" "}
              <ExternalLink href="https://github.com/PolicyEngine/microcosm">
                microcosm
              </ExternalLink>{" "}
              main, not a certified release, and is re-pinned to the published
              release once that exists.
            </li>
            <li>
              <strong>Gains imputation.</strong> {dataset.observation}. Amounts
              are redrawn from HMRC&apos;s Table 3 (size of gain by taxable
              income) so the top bands that carry most of the tax are
              represented, and the weights reproduce Table 3&apos;s gains by
              taxable income band, which sets the income tax band each gain
              falls in. Each liable gainer is assigned a main asset type from
              HMRC Tables 7 and 8, with residential property gains written to
              their own column, and gains qualifying for Business Asset Disposal
              Relief are imputed and weighted to HMRC Table 4&apos;s bands, so
              the relief is charged on its own schedule.
            </li>
            <li>
              <strong>Gainers below the exempt amount.</strong> {dataset.notes}{" "}
              At the base year they owe nothing; once the engine uprates gains
              past the frozen exempt amount they become taxpayers. The Baseline
              tab identifies these entrants separately in the comparison table.
            </li>
            <li>
              <strong>Projection.</strong> Each file is one engine year (
              {metadata.projection.base_year}
              ). The engine copies it forward to 2030 and uprates it year on
              year from its own uprating indices: capital gains and the schedule
              components follow OBR GDP per capita, household weights follow ONS
              population. Nothing CGT-specific enters the projection; the
              factors actually applied are recorded in{" "}
              <span className="font-mono text-xs">
                {metadata.projection.audit}
              </span>{" "}
              and fingerprinted into every simulation id (
              <span className="font-mono text-xs">
                {metadata.projection.fingerprint}
              </span>
              ).
            </li>
            <li>
              <strong>Schedules.</strong> policyengine-uk{" "}
              {metadata.policyengine_uk_version} charges residential property
              and Business Asset Disposal Relief gains on their own schedules
              when a dataset records them. The reform takes residential property
              gains to the same income tax rates and withdraws the relief, so
              qualifying gains (Investors&apos; Relief included, which the
              engine&apos;s input merges with it) take the reformed main rates,
              as in CenTax&apos;s rates-only estimate. Carried interest has been
              taxed as income since 6 April 2026 and is left where it is. On a
              dataset without those columns the extra parameters are inert.
            </li>
            <li>
              <strong>Simulation.</strong> The reform runs through{" "}
              <ExternalLink href="https://github.com/PolicyEngine/policyengine.py">
                policyengine.py
              </ExternalLink>{" "}
              {metadata.policyengine_version}, PolicyEngine&apos;s standard
              simulation wrapper: budget and distributional outputs (income
              deciles, age of the oldest household member, household type and
              region) are weighted microdf aggregates over the simulation
              outputs. The 4.x wrapper series is used because later releases
              certify one pinned engine version and refuse to import alongside
              the engine release that carries the schedules.
            </li>
            <li>
              <strong>Behavioural response.</strong> Applied through a policy
              simulation modifier that registers the baseline branch, so the
              elasticity measures the true change in marginal rates; the
              pipeline verifies the response is active before writing results.
              The central case sets the engine&apos;s marginal-tax-rate
              parameter (
              <span className="font-mono text-xs">
                {metadata.elasticity_parameter}
              </span>
              ) and leaves its retention-rate parameter at zero; CenTax&apos;s
              and the official cases do the reverse (see below).
            </li>
          </ul>
        </div>
      </details>

      <details
        className="section-card method-detail scroll-mt-24"
        id="elasticity"
      >
        <summary>How people respond</summary>
        <div>
          <SectionHeading
            title="Behavioural response: PolicyEngine's elasticity"
            description="How realised gains respond to the tax rate on them, and how PolicyEngine chose its central case."
          />
          <p className="text-sm leading-6 text-slate-600">
            The central case is {e}, the capital gains elasticity PolicyEngine
            has used by default since{" "}
            {formatPublished(central.published.slice(0, 7))} (
            <ExternalLink href={central.url}>
              How PolicyEngine UK models behavioural responses
            </ExternalLink>
            ). The model applies it as an elasticity of realised gains with
            respect to the marginal tax rate on them, through
            policyengine-uk&apos;s marginal-tax-rate parameter. For each person,
          </p>
          <p className="my-3 rounded-lg bg-slate-50 p-4 text-center font-mono text-sm">
            realised gains × (t₁ / t₀)<sup>e</sup>
          </p>
          <p className="text-sm leading-6 text-slate-600">
            where t₀ and t₁ are the person&apos;s marginal rates on gains under
            current law and under the reform (each at least 0.1%), shared across
            the main, residential property and Business Asset Disposal Relief
            schedules in proportion to the gains on each. A 10% rise in the rate
            (from 24% to 26.4%, say) lowers realised gains by about{" "}
            {tenPercentRise}%. The post explains how the value was chosen. In
            brief:
          </p>
          <ul className="mt-2 list-disc space-y-2 pl-5 text-sm leading-6 text-slate-600">
            <li>
              <strong>US evidence.</strong> PolicyEngine found no UK estimates
              of how realised gains respond to the tax rate, so it drew on US
              studies. {notch.study} estimate{" "}
              {estimate(notch.estimates.quasi_permanent)} for the
              quasi-permanent response ({estimate(notch.estimates.short_run)} in
              the short run), from the bunching of realisations just after the
              one-year holding period, on transaction-level data. The post also
              cites {auten.study}: {estimate(auten.estimates.permanent)} for a
              permanent change in the rate and{" "}
              {estimate(auten.estimates.transitory)} for a transitory one, which
              people can time their sales around. An earlier paper by the same
              authors, {panel.study}, uses a panel of US tax returns for 1999 to
              2008 and estimates {estimate(panel.estimates.permanent)} for a
              permanent change ({estimate(panel.estimates.permanent_corrected)}{" "}
              after a 2024 correction) and{" "}
              {formatElasticityValue(panel.estimates.transitory)} for a
              transitory one.
            </li>
            <li>
              <strong>A smaller response in the UK.</strong> PolicyEngine set{" "}
              {e} for the UK, judging that UK capital gains respond less to tax
              changes than US gains: the US has more tax-advantaged investment
              vehicles, more generous treatment of real estate, a more active
              trading culture and scope to move investments between state tax
              jurisdictions.
            </li>
          </ul>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            CenTax&apos;s and the official elasticities are stated with respect
            to the <em>retention rate</em> (1 − t), the share of each pound of
            gain a taxpayer keeps, and the model applies them in that form,
            realised gains × ((1 − t₁) / (1 − t₀))
            <sup>e</sup>. The Reform impacts tab&apos;s sensitivity table sets
            the central case beside no response,{" "}
            {netOfShifting
              ? `CenTax's central ${centax.elasticity.toFixed(1)}`
              : `CenTax's ${centax.elasticity.toFixed(1)} before its adjustments`}{" "}
            and range ({centaxRange.lower.toFixed(1)} to{" "}
            {centaxRange.upper.toFixed(1)}), and the official HMRC/OBR{" "}
            {official.elasticity} for main-rate gains and{" "}
            {official.badr_elasticity} for gains qualifying for Business Asset
            Disposal Relief. The approach to income shifting chosen above sets
            which CenTax case is shown and whether PolicyEngine&apos;s and the
            official cases add income tax back (see{" "}
            <a
              href="#income-shifting"
              className="underline decoration-1 underline-offset-2"
            >
              Income shifting: two approaches
            </a>
            ).
          </p>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            The evidence behind {e} comes from the US, and carrying it to UK
            taxpayers is a judgement. CenTax estimate their elasticity for a
            package that also removes the uplift at death and charges gains on
            departure, closing two ways of deferring or avoiding the tax, which
            this dashboard does not model. They expect a larger response to a
            rate rise on the current base and{" "}
            <ExternalLink href="https://www.nuffieldfoundation.org/wp-content/uploads/2023/03/Taxes-at-the-top-Understanding-what-high-earners-pay-and-options-for-reform.pdf#page=20">
              advise against equalising rates without those reforms
            </ExternalLink>{" "}
            (<em>Taxes at the top</em>, 2026). The upper end of CenTax&apos;s
            range and the official case show how much of the yield rests on the
            assumption.
          </p>
        </div>
      </details>

      <details
        className="section-card method-detail scroll-mt-24"
        id="conversion"
      >
        <summary>Two definitions of elasticity</summary>
        <div>
          <SectionHeading
            title={`How ${e} compares with a retention-rate elasticity`}
            description="The two forms describe the same behaviour at one rate and part ways across a large change."
          />
          <ul className="mt-2 list-disc space-y-2 pl-5 text-sm leading-6 text-slate-600">
            <li>
              <strong>At one rate.</strong> An elasticity e with respect to the
              rate t equals an elasticity of −e × (1 − t) / t with respect to
              the retention rate. So {e} equals CenTax&apos;s{" "}
              {centaxCentral.elasticity.toFixed(1)} only at a rate of about{" "}
              {share(parity)}; at today&apos;s 24% it equals{" "}
              {pointRetention(central.elasticity, 0.24).toFixed(1)}, and at 45%,{" "}
              {pointRetention(central.elasticity, 0.45).toFixed(2)}.
            </li>
            <li>
              <strong>Across this reform.</strong> For a discrete change the
              comparable figure is the retention-rate elasticity that moves
              realised gains by the same factor. Over this reform&apos;s
              changes, {e} behaves like {additional} for gains moving from 24%
              to 45%, {higher} from 24% to 40% and {basic} from 18% to 20%: a
              larger response than CenTax&apos;s central{" "}
              {centaxCentral.elasticity.toFixed(1)} at every rate, and close to
              CenTax&apos;s {unadjusted.elasticity.toFixed(1)} before its
              adjustments at the higher and additional rates, where most of the
              yield arises. On {dataset.shortLabel}, equalisation raises{" "}
              {formatSignedBn(cases[central.id].revenue_2026_bn, 1)} in 2026-27
              at {e}, against{" "}
              {formatSignedBn(cases[centaxCentral.id].revenue_2026_bn, 1)} at
              CenTax&apos;s {centaxCentral.elasticity.toFixed(1)} and{" "}
              {formatSignedBn(cases[unadjusted.id].revenue_2026_bn, 1)} at{" "}
              {unadjusted.elasticity.toFixed(1)}.
            </li>
            <li>
              <strong>Rate rises.</strong> At {e} with respect to the rate, the
              tax on a gain grows with t
              <sup>{(1 + central.elasticity).toFixed(1)}</sup>, so a higher rate
              always raises more, with diminishing returns. A retention-rate
              elasticity e instead implies a revenue-maximising rate of 1 / (1 +
              e): {revenuePeak(centaxCentral.elasticity)} at CenTax&apos;s{" "}
              {centaxCentral.elasticity.toFixed(1)},{" "}
              {revenuePeak(unadjusted.elasticity)} at{" "}
              {unadjusted.elasticity.toFixed(1)} and{" "}
              {revenuePeak(official.elasticity)} at the official{" "}
              {official.elasticity}, which is why HMRC&apos;s ready reckoner
              shows rises from 24% losing revenue.
            </li>
            <li>
              <strong>Rate cuts.</strong> As a rate falls towards zero, the form
              with respect to the rate makes realised gains grow without limit.
              The engine floors each rate at 0.1%, so in the Rate explorer a cut
              from 24% to 0% multiplies the gains it reaches by about{" "}
              {cutToZero(central)} at {e}, against {cutToZero(centaxCentral)} at
              CenTax&apos;s {centaxCentral.elasticity.toFixed(1)}.
            </li>
          </ul>
        </div>
      </details>

      <details
        className="section-card method-detail scroll-mt-24"
        id="elasticity-gap"
      >
        <summary>Why the official case differs</summary>
        <div>
          <SectionHeading
            title="The official elasticity and the central case"
            description="Why HMRC's ready reckoner shows rate rises losing revenue where this dashboard's central case raises it."
          />
          <ul className="mt-2 list-disc space-y-2 pl-5 text-sm leading-6 text-slate-600">
            <li>
              <strong>The official assumption.</strong> HMRC and the OBR use a
              retention-rate elasticity of {official.elasticity} for the main
              CGT rates and {official.badr_elasticity} for gains qualifying for
              Business Asset Disposal Relief (
              <ExternalLink href={`${official.url}#page=3`}>
                OBR, {formatPublished(official.published.slice(0, 7))},{" "}
                {official.locator.toLowerCase()}
              </ExternalLink>
              ; HMRC&apos;s estimate from 1998 to 2018 is 4.0). Over this
              reform&apos;s rise at the higher rate, the central case of {e}{" "}
              behaves like a retention-rate elasticity of {higher}, so the
              official main-rate figure is about{" "}
              {(official.elasticity / Number(higher)).toFixed(1)} times as
              strong. The official case applies both: the engine gives gains
              qualifying for the relief their own elasticity, and both kinds of
              gain respond to the same change in a person&apos;s marginal rate.
            </li>
            <li>
              <strong>Why they differ.</strong> PolicyEngine&apos;s {e} and
              CenTax&apos;s range both rest on US evidence. CenTax start from
              about {unadjusted.elasticity.toFixed(1)} five years after a change
              (
              <ExternalLink href={`${CENTAX_2024_PDF}#page=35`}>
                Agersnap and Zidar, 2021
              </ExternalLink>
              ), and lower it to {centaxCentral.elasticity.toFixed(1)} for two
              reasons (
              <ExternalLink href={`${CENTAX_2024_PDF}#page=37`}>
                pp. 35–36
              </ExternalLink>
              ): their package removes the uplift at death, which the US keeps;
              and equalisation brings income that was presented as gains back
              into income tax, which estimates measured on the CGT base count as
              lost. The US evidence already has emigration largely closed off,
              so no adjustment is made for the charge on departure. HMRC&apos;s
              figure is estimated from UK responses under the current base, and
              the OBR adds income tax back separately (see below).
            </li>
            <li>
              <strong>What it does to a rate rise.</strong> Take a taxpayer
              whose marginal rate on gains rises from 24% to 34%, as in the
              ready reckoner&apos;s largest row. At the central elasticity,
              their realised gains fall by {percent(atCentral.gains)} and the
              revenue those gains raise{" "}
              {atCentral.revenue >= 0 ? "rises" : "falls"} by{" "}
              {percent(atCentral.revenue)}; at CenTax&apos;s{" "}
              {centaxCentral.elasticity.toFixed(1)}, gains fall by{" "}
              {percent(atCentax.gains)} and revenue{" "}
              {atCentax.revenue >= 0 ? "rises" : "falls"} by{" "}
              {percent(atCentax.revenue)}. At the official elasticity, realised
              gains fall by {percent(atOfficial.gains)} and revenue{" "}
              {atOfficial.revenue >= 0 ? "rises" : "falls"} by{" "}
              {percent(atOfficial.revenue)}, the direction HMRC&apos;s row
              shows. The engine applies the same formulas to each person&apos;s
              own simulated marginal rate on gains, so the aggregate effect
              depends on where the dataset&apos;s gains sit.
            </li>
            <li>
              <strong>On this dataset.</strong> Equalisation changes CGT revenue
              in 2026-27 by {formatSignedBn(revenueAt(central.id), 1)} at the
              central elasticity and by{" "}
              {formatSignedBn(cases.official.revenue_2026_bn, 1)} at the
              official one. The Benchmarks tab scores the ready reckoner&apos;s
              rows at both.
            </li>
          </ul>
        </div>
      </details>

      <details
        className="section-card method-detail scroll-mt-24"
        id="income-shifting"
      >
        <summary>Counting income shifting</summary>
        <div>
          <SectionHeading
            title="Income shifting: two approaches"
            description="Why the dashboard offers two sets of figures, what each assumes and where each falls short."
          />
          <p className="text-sm leading-6 text-slate-600">
            When CGT rates rise towards income tax rates, some of the gains
            people stop realising were never really capital gains: they were
            income, such as a company owner&apos;s pay taken as a gain rather
            than as salary or dividends. With the rates equal there is no reason
            to present it as a gain, so it comes back as income and is taxed as
            income. An estimate of the response measured on the CGT base alone
            counts that money as lost. CenTax and the OBR deal with this in
            different ways, so their elasticities are not on the same footing:
          </p>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-slate-600">
            <li>
              <strong>CenTax net it into the elasticity.</strong> They lower
              Agersnap and Zidar&apos;s five-year estimate of about{" "}
              {unadjusted.elasticity.toFixed(1)} to a central{" "}
              {centaxCentral.elasticity.toFixed(1)}, partly for income shifting
              and partly for the uplift at death their package removes, without
              saying how the difference splits between the two. Their figures
              are total revenue across CGT and income tax, without a split (
              <ExternalLink href={`${CENTAX_2024_PDF}#page=37`}>
                Advani, Lonsdale and Summers, 2024, pp. 35–37
              </ExternalLink>
              ). Their range, {centaxRange.lower.toFixed(1)} to{" "}
              {centaxRange.upper.toFixed(1)}, is not adjusted:{" "}
              {centaxRange.upper.toFixed(1)} is the US estimate for larger
              changes without controls, and {centaxRange.lower.toFixed(1)}{" "}
              approaches a Canadian estimate of no lasting response, and CenTax
              say both estimates measure the CGT base only.
            </li>
            <li>
              <strong>The OBR adds income tax back separately.</strong> Its{" "}
              {official.elasticity} covers every behaviour, income shifting
              included, and its costing then treats{" "}
              {Math.round(shifting.share * 1000) / 10}% of the response to the
              narrowing gap between income tax and CGT rates as income no longer
              presented as gains, taxed as income (
              <ExternalLink href={`${shifting.url}#page=3`}>
                OBR, January 2025, p. 3 and Table 1.1
              </ExternalLink>
              ). In its costing of the October 2024 rise, that income tax was
              £1.5bn of the £2.5bn raised in 2029-30, against £4.9bn of CGT lost
              to behaviour (Table 1.3).
            </li>
          </ul>
          <p className="mt-4 text-sm leading-6 text-slate-600">
            PolicyEngine&apos;s {e} is in the same position as the official
            elasticity: the US studies behind it measure realisations on the
            gains base alone, so the fall in realised gains they capture
            includes income that comes back as income. Net of income shifting,
            the OBR&apos;s income tax is added to it as well (
            {formatSignedBn(centralOffset, 1)} in 2026-27, taking the central
            case from {formatSignedBn(cases[central.id].revenue_2026_bn, 1)} to{" "}
            {formatSignedBn(
              cases[central.id].revenue_2026_bn + centralOffset,
              1,
            )}
            ); gross of it, the central case counts CGT alone, as
            PolicyEngine&apos;s own analyses have.
          </p>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            The two approaches put the cases on one footing in opposite
            directions. The switch at the top of the page chooses between them
            for every tab except Baseline.
          </p>

          <h3 className="mt-5 text-base font-semibold text-slate-800">
            {approaches.cgt_only.label}: CGT only
          </h3>
          <ul className="mt-2 list-disc space-y-2 pl-5 text-sm leading-6 text-slate-600">
            <li>
              <strong>What it shows.</strong> Every gain not realised counts as
              lost revenue; the figures are the change in CGT alone.
            </li>
            <li>
              <strong>Cases.</strong> No response; CenTax&apos;s{" "}
              {centaxRange.lower.toFixed(1)}; CenTax&apos;s{" "}
              {unadjusted.elasticity.toFixed(1)} before its adjustments;
              CenTax&apos;s {centaxRange.upper.toFixed(1)}; and
              PolicyEngine&apos;s {e}, the central case, and the official{" "}
              {official.elasticity} ({official.badr_elasticity} for gains
              qualifying for the relief), both with nothing added back.
            </li>
            <li>
              <strong>Assumptions.</strong> {unadjusted.elasticity.toFixed(1)}{" "}
              removes both of CenTax&apos;s adjustments, not only the one for
              income shifting, because CenTax do not say how much each accounts
              for. A reform of rates alone keeps the uplift at death, so the
              second adjustment would not apply to it either. CenTax do not
              publish {unadjusted.elasticity.toFixed(1)} as their estimate for
              any reform: it is their starting point.
            </li>
            <li>
              <strong>Caveats.</strong> It understates total revenue by leaving
              out the income tax and National Insurance on shifted income, which
              both CenTax and the OBR count. HMRC&apos;s ready-reckoner figures
              include income tax effects, so the comparison in Benchmarks is not
              like for like. CenTax&apos;s {centaxRange.lower.toFixed(1)} and{" "}
              {centaxRange.upper.toFixed(1)} are measured on the CGT base, like
              the official case, so nothing is added to them here either.
            </li>
          </ul>

          <h3 className="mt-5 text-base font-semibold text-slate-800">
            {approaches.total_revenue.label}: total revenue
          </h3>
          <ul className="mt-2 list-disc space-y-2 pl-5 text-sm leading-6 text-slate-600">
            <li>
              <strong>What it shows.</strong> CenTax&apos;s central{" "}
              {centaxCentral.elasticity.toFixed(1)}, which already allows for
              shifted income, and the cases measured on the CGT base
              (PolicyEngine&apos;s {e}, CenTax&apos;s{" "}
              {centaxRange.lower.toFixed(1)} and {centaxRange.upper.toFixed(1)}{" "}
              and the official elasticity) with the OBR&apos;s income tax and
              National Insurance on shifted income added back: total revenue
              across CGT, income tax and National Insurance.
            </li>
            <li>
              <strong>Cases.</strong> No response; PolicyEngine&apos;s {e}, the
              central case, plus the addition; CenTax&apos;s{" "}
              {centaxRange.lower.toFixed(1)} plus the addition; CenTax&apos;s{" "}
              {centaxCentral.elasticity.toFixed(1)} as published; CenTax&apos;s{" "}
              {centaxRange.upper.toFixed(1)} plus the addition; and the official{" "}
              {official.elasticity} ({official.badr_elasticity} for gains
              qualifying for the relief) plus the addition. The same addition
              goes to the central and official columns of the ready-reckoner
              rows.
            </li>
            <li>
              <strong>Assumptions.</strong> The income tax and National
              Insurance added back are charged at{" "}
              {(shifting.tax_rate * 100).toFixed(1)}% on{" "}
              {Math.round(shifting.share * 1000) / 10}% of the behavioural fall
              in realised gains outside residential property.{" "}
              {shifting.base_note} {shifting.tax_rate_note} {shifting.obr_check}
            </li>
            <li>
              <strong>Caveats.</strong>
              <ul className="mt-1 list-[circle] space-y-1 pl-5">
                <li>
                  The OBR set its {Math.round(shifting.share * 1000) / 10}%
                  share for its own elasticity. Applying it to
                  PolicyEngine&apos;s {e} assumes the same share of a smaller
                  response is income no longer presented as gains.
                </li>
                <li>
                  CenTax&apos;s {centaxCentral.elasticity.toFixed(1)} also
                  includes their adjustment for the uplift at death, which a
                  reform of rates alone does not remove; by CenTax&apos;s own
                  reasoning the response to this reform would be larger.
                </li>
                <li>
                  The addition applies to the whole response outside residential
                  property. For equalisation that response comes from narrowing
                  the gap with income tax, as the OBR describes; for a schedule
                  in the Rate explorer that sets CGT above income tax rates the
                  assumption does not hold, and the explorer says so.
                </li>
                <li>
                  The income tax and National Insurance are in the revenue
                  figures but not in the distributional charts, which reflect
                  the change in CGT alone.
                </li>
                <li>
                  The official {official.elasticity} was set for the October
                  2024 change; the OBR&apos;s figure for a rise as large as
                  equalisation is not published.
                </li>
                <li>
                  The engine does not model the shifted income itself; this
                  repository adds it to the engine&apos;s results (
                  <ExternalLink href="https://github.com/PolicyEngine/policyengine-uk/issues/1982">
                    policyengine-uk#1982
                  </ExternalLink>
                  ).
                </li>
              </ul>
            </li>
          </ul>

          <h3 className="mt-5 text-base font-semibold text-slate-800">
            Both approaches
          </h3>
          <ul className="mt-2 list-disc space-y-2 pl-5 text-sm leading-6 text-slate-600">
            <li>
              Every case is a medium-term response, applied in full from
              2026-27; neither models the timing of disposals around the change.
            </li>
            <li>
              <strong>On {dataset.shortLabel}.</strong> At PolicyEngine&apos;s{" "}
              {e}, equalisation raises{" "}
              {formatSignedBn(
                cases[central.id].revenue_2026_bn + centralOffset,
                1,
              )}{" "}
              in 2026-27 net of income shifting and{" "}
              {formatSignedBn(cases[central.id].revenue_2026_bn, 1)} gross of
              it. CenTax&apos;s elasticity gives{" "}
              {formatSignedBn(cases.centax_central.revenue_2026_bn, 1)} net of
              income shifting ({centaxCentral.elasticity.toFixed(1)}) and{" "}
              {formatSignedBn(cases.centax_unadjusted.revenue_2026_bn, 1)} gross
              of it ({unadjusted.elasticity.toFixed(1)}). At the official
              elasticity it changes revenue by{" "}
              {formatSignedBn(cases.official.revenue_2026_bn, 1)} counting CGT
              alone, and by{" "}
              {formatSignedBn(
                cases.official.revenue_2026_bn + officialOffset,
                1,
              )}{" "}
              once the OBR&apos;s income tax and National Insurance on shifted
              income ({formatSignedBn(officialOffset, 1)}) are added back.
            </li>
          </ul>
        </div>
      </details>

      <details
        className="section-card method-detail scroll-mt-24"
        id="explorer"
      >
        <summary>How the rate explorer works</summary>
        <div>
          <SectionHeading title="Rate explorer" />
          <ul className="mt-2 list-disc space-y-2 pl-5 text-sm leading-6 text-slate-600">
            <li>
              <strong>Same pipeline, run live.</strong> The Rate explorer tab
              scores a schedule of CGT rates and a treatment of Business Asset
              Disposal Relief you choose on {dataset.shortLabel} for every
              modelled year. It runs the pipeline&apos;s own code (the same
              pinned per-year datasets, cached baseline simulations, behavioural
              response and impact calculations) on a Modal backend, or locally
              through the{" "}
              <span className="font-mono text-xs">uk-cgt-reform-explore</span>{" "}
              command. Nothing is precomputed or interpolated: an explorer run
              at 20% / 40% / 45% with the relief withdrawn builds the Reform
              impacts tab&apos;s own reform and reproduces its figures.
            </li>
            <li>
              <strong>Scope.</strong> The chosen rates reach the main schedule
              and the residential property schedule, which have charged the same
              rates since 30 October 2024. Business Asset Disposal Relief can be
              kept, at a whole-point rate no higher than the additional rate and
              a lifetime limit of £500k, £1m (current law) or £10m (the limit
              until March 2020), or withdrawn. Carried interest has been taxed
              as income since April 2026 and stays outside the explorer.
            </li>
            <li>
              <strong>Behavioural response.</strong> The explorer offers the
              sensitivity table&apos;s cases, PolicyEngine&apos;s {e} by
              default. That elasticity works on the rate itself, so its response
              to a cut grows steeply as a rate nears zero (about{" "}
              {cutToZero(central)} times the gains for a cut from 24% to 0%; see{" "}
              <a
                href="#conversion"
                className="underline decoration-1 underline-offset-2"
              >
                above
              </a>
              ): figures for deep cuts depend heavily on the form of the
              elasticity.
            </li>
            <li>
              <strong>Cache.</strong> Every completed run is stored under a key
              made of the dataset digest, the projection fingerprint, the engine
              and wrapper versions and the reform fingerprint (the rates and the
              elasticity). Anyone who later asks for the same schedule is served
              the stored result at once, and a change to the data or the engine
              can never reuse a stale one.
            </li>
          </ul>
        </div>
      </details>
    </ReadingLayout>
  );
}
