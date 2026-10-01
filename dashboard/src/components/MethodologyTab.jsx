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
import { formatPublished, formatSignedBn } from "../lib/formatters";
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

const CENTAX_2024_PDF =
  "https://centax.org.uk/wp-content/uploads/2024/10/AdvaniLonsdaleSummers2024_CGTReform.pdf";

export default function MethodologyTab({ data, anchor }) {
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
  const metadata = getMetadata(data);
  const {
    central,
    centax_central: centaxCentral,
    unadjusted,
    official,
    centax_range: centaxRange,
  } = getBenchmarks(data).elasticities;
  const { approach } = data;
  const approaches = Object.fromEntries(getApproachOptions(data).map((a) => [a.id, a]));
  const shifting = getIncomeShifting(data);
  const cases = Object.fromEntries(data.sensitivity_all.map((row) => [row.id, row]));
  const officialOffset = cases.official.income_shifting_offset_2026_bn;
  const revenueAt = (e) =>
    getSensitivity(data).find((row) => row.e_retention === e).revenue_2026_bn;
  // The ready reckoner's largest row: the higher rate from 24% to 34%.
  const atCentral = responseTo(0.24, 0.34, central);
  const atOfficial = responseTo(0.24, 0.34, official);

  return (
    <div className="space-y-6">
      <section className="section-card scroll-mt-24" id="pathway">
        <SectionHeading title="Data and simulation" />
        <ul className="mt-2 list-disc space-y-2 pl-5 text-sm leading-6 text-slate-600">
          <li>
            <strong>The dataset.</strong> {dataset.label}: {dataset.producer}. Pinned input{" "}
            <span className="break-all font-mono text-xs">{dataset.uri}</span> (sha256{" "}
            <span className="font-mono text-xs">{dataset.sha256.slice(0, 12)}…</span>), checked
            before anything runs and used exactly as published with no local reweighting &mdash;
            calibration belongs upstream in the dataset, so whatever the file provides is what is
            simulated here. It is a staged build from{" "}
            <ExternalLink href="https://github.com/PolicyEngine/microcosm">microcosm</ExternalLink>{" "}
            main, not a certified release, and is re-pinned to the published release once that
            exists.
          </li>
          <li>
            <strong>Gains imputation.</strong> {dataset.observation}. Amounts are redrawn from
            HMRC&apos;s Table 3 (size of gain by taxable income) so the top bands that carry most of
            the tax are represented, and the weights reproduce Table 3&apos;s gains by taxable income
            band, which sets the income tax band each gain falls in. Each liable gainer is assigned
            a main asset type from HMRC Tables 7 and 8, with residential property gains written to
            their own column, and gains qualifying for Business Asset Disposal Relief are imputed
            and weighted to HMRC Table 4&apos;s bands, so the relief is charged on its own schedule.
          </li>
          <li>
            <strong>Gainers below the exempt amount.</strong> {dataset.notes} At the base year they
            owe nothing; once the engine uprates gains past the frozen exempt amount they become
            taxpayers. The Baseline tab reports them as entrants by uprating and shows every figure
            with and without them.
          </li>
          <li>
            <strong>Projection.</strong> Each file is one engine year ({metadata.projection.base_year}
            ). The engine copies it forward to 2030 and uprates it year on year from its own
            uprating indices: capital gains and the schedule components follow OBR GDP per
            capita, household weights follow ONS population. Nothing CGT-specific enters the
            projection; the factors actually applied are recorded in{" "}
            <span className="font-mono text-xs">{metadata.projection.audit}</span> and
            fingerprinted into every simulation id (
            <span className="font-mono text-xs">{metadata.projection.fingerprint}</span>).
          </li>
          <li>
            <strong>Schedules.</strong> policyengine-uk {metadata.policyengine_uk_version}{" "}
            charges residential property and Business Asset Disposal Relief gains on their own
            schedules when a dataset records them. The reform takes residential property gains
            to the same income tax rates and withdraws the relief, so qualifying gains (Investors&apos;
            Relief included, which the engine&apos;s input merges with it) take the reformed main
            rates, as in CenTax&apos;s rates-only estimate. Carried interest has been taxed as
            income since 6 April 2026 and is left where it is. On a dataset without those columns
            the extra parameters are inert.
          </li>
          <li>
            <strong>Simulation.</strong> The reform runs through{" "}
            <ExternalLink href="https://github.com/PolicyEngine/policyengine.py">
              policyengine.py
            </ExternalLink>{" "}
            {metadata.policyengine_version}, PolicyEngine&apos;s standard simulation wrapper:
            budget and distributional outputs (income quintiles/quartiles, household type and
            region) are weighted microdf aggregates over the simulation outputs. The 4.x
            wrapper series is used because later releases certify one pinned engine version
            and refuse to import alongside the engine release that carries the schedules.
          </li>
          <li>
            <strong>Behavioural response.</strong> Applied through a policy simulation modifier
            that registers the baseline branch, so the elasticity measures the true change in
            marginal rates; the pipeline verifies the response is active before writing
            results. Every case sets the engine&apos;s retention-rate parameter (
            <span className="font-mono text-xs">{metadata.elasticity_parameter}</span>) and
            leaves its marginal-tax-rate parameter at zero (see below).
          </li>
        </ul>
      </section>

      <section className="section-card scroll-mt-24" id="elasticity">
        <SectionHeading
          title="Behavioural response: CenTax's elasticity, in CenTax's form"
          description="How realised gains respond to the share of each gain a taxpayer keeps."
        />
        <p className="text-sm leading-6 text-slate-600">
          <ExternalLink href={central.url}>Arun Advani and CenTax</ExternalLink> express the
          responsiveness of realised gains as an elasticity with respect to the{" "}
          <em>retention rate</em> (1 − t): how much realisations rise when taxpayers keep a
          larger share of each pound of gain. The model applies that elasticity in the same form.
          For each person,
        </p>
        <p className="my-3 rounded-lg bg-slate-50 p-4 text-center font-mono text-sm">
          realised gains × ((1 − t₁) / (1 − t₀))<sup>e</sup>
        </p>
        <p className="text-sm leading-6 text-slate-600">
          where t₀ and t₁ are the person&apos;s marginal rates on gains under current law and
          under the reform, shared across the main, residential property and Business Asset
          Disposal Relief schedules in proportion to the gains on each. The central case depends
          on the approach to income shifting chosen above (see{" "}
          <a href="#income-shifting" className="underline decoration-1 underline-offset-2">
            Income shifting: two approaches
          </a>
          ): CenTax&apos;s published {centaxCentral.e_retention.toFixed(1)} net of income shifting,
          or {unadjusted.e_retention.toFixed(1)}, CenTax&apos;s figure before its adjustments, gross
          of it. This page shows the {approach.label.toLowerCase()} approach, whose central case is{" "}
          {central.e_retention.toFixed(1)}. The Reform impacts tab&apos;s sensitivity table re-runs
          the analysis with no response, with CenTax&apos;s range ({centaxRange.lower.toFixed(1)} to{" "}
          {centaxRange.upper.toFixed(1)}) and with the official HMRC/OBR {official.e_retention} for
          main-rate gains and {official.badr_e_retention} for gains qualifying for Business Asset
          Disposal Relief.
        </p>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          CenTax estimate their elasticity for a package that also removes the uplift at death
          and charges gains on departure, closing two ways of deferring or avoiding the tax,
          which this dashboard does not model. They expect a larger response to a rate rise on
          the current base and{" "}
          <ExternalLink href="https://www.nuffieldfoundation.org/wp-content/uploads/2023/03/Taxes-at-the-top-Understanding-what-high-earners-pay-and-options-for-reform.pdf#page=20">
            advise against equalising rates without those reforms
          </ExternalLink>{" "}
          (<em>Taxes at the top</em>, 2026). The upper end of CenTax&apos;s range and the
          official case show how much of the yield rests on the assumption.
        </p>
      </section>

      <section className="section-card scroll-mt-24" id="elasticity-gap">
        <SectionHeading
          title="The official elasticity and CenTax's"
          description="Why HMRC's ready reckoner shows rate rises losing revenue where this dashboard's central case raises it."
        />
        <ul className="mt-2 list-disc space-y-2 pl-5 text-sm leading-6 text-slate-600">
          <li>
            <strong>The official assumption.</strong> HMRC and the OBR use a retention-rate
            elasticity of {official.e_retention} for the main CGT rates and{" "}
            {official.badr_e_retention} for gains qualifying for Business Asset Disposal Relief (
            <ExternalLink href={`${official.url}#page=3`}>
              OBR, {formatPublished(official.published.slice(0, 7))},{" "}
              {official.locator.toLowerCase()}
            </ExternalLink>
            ; HMRC&apos;s estimate from 1998 to 2018 is 4.0). The main figure is{" "}
            {(official.e_retention / central.e_retention).toFixed(1)} times this approach&apos;s
            central case of {central.e_retention.toFixed(1)}. The official case applies both: the
            engine gives gains qualifying for the relief their own elasticity, and both kinds of
            gain respond to the same change in a person&apos;s marginal rate.
          </li>
          <li>
            <strong>Why the two differ.</strong> CenTax start from US evidence, about{" "}
            {unadjusted.e_retention.toFixed(1)} five years after a change (
            <ExternalLink href={`${CENTAX_2024_PDF}#page=36`}>Agersnap and Zidar, 2021</ExternalLink>
            ), and lower it to {centaxCentral.e_retention.toFixed(1)} for two reasons (
            <ExternalLink href={`${CENTAX_2024_PDF}#page=37`}>pp. 35–36</ExternalLink>): their package
            removes the uplift at death, which the US keeps; and equalisation brings income that was
            presented as gains back into income tax, which estimates measured on the CGT base count
            as lost. The US evidence already has emigration largely closed off, so no adjustment is
            made for the charge on departure. HMRC&apos;s figure is estimated from UK responses
            under the current base, and the OBR adds income tax back separately (see below).
          </li>
          <li>
            <strong>What it does to a rate rise.</strong> Take a taxpayer whose marginal rate on
            gains rises from 24% to 34%, as in the ready reckoner&apos;s largest row. At the central
            elasticity, their realised gains fall by {percent(atCentral.gains)} and the revenue
            those gains raise {atCentral.revenue >= 0 ? "rises" : "falls"} by{" "}
            {percent(atCentral.revenue)}. At the official elasticity, realised gains fall by{" "}
            {percent(atOfficial.gains)} and revenue {atOfficial.revenue >= 0 ? "rises" : "falls"} by{" "}
            {percent(atOfficial.revenue)}, the direction HMRC&apos;s row shows. The engine applies
            the same formula to each person&apos;s own simulated marginal rate on gains, so the
            aggregate effect depends on where each dataset&apos;s gains sit.
          </li>
          <li>
            <strong>On this dataset.</strong> Equalisation changes CGT revenue in 2026-27 by{" "}
            {formatSignedBn(revenueAt(central.e_retention), 1)} at the central elasticity and by{" "}
            {formatSignedBn(revenueAt(official.e_retention), 1)} at the official one. The
            Benchmarks tab scores the ready reckoner&apos;s rows at both.
          </li>
        </ul>
      </section>

      <section className="section-card scroll-mt-24" id="income-shifting">
        <SectionHeading
          title="Income shifting: two approaches"
          description="Why the dashboard offers two sets of figures, what each assumes and where each falls short."
        />
        <p className="text-sm leading-6 text-slate-600">
          When CGT rates rise towards income tax rates, some of the gains people stop realising were
          never really capital gains: they were income, such as a company owner&apos;s pay taken as
          a gain rather than as salary or dividends. With the rates equal there is no reason to
          present it as a gain, so it comes back as income and is taxed as income. An estimate of
          the response measured on the CGT base alone counts that money as lost. CenTax and the OBR
          deal with this in different ways, so their elasticities are not on the same footing:
        </p>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-slate-600">
          <li>
            <strong>CenTax net it into the elasticity.</strong> They lower Agersnap and Zidar&apos;s
            five-year estimate of about {unadjusted.e_retention.toFixed(1)} to a central{" "}
            {centaxCentral.e_retention.toFixed(1)}, partly for income shifting and partly for the
            uplift at death their package removes, without saying how the difference splits between
            the two. Their figures are total revenue across CGT and income tax, without a split (
            <ExternalLink href={`${CENTAX_2024_PDF}#page=37`}>
              Advani, Lonsdale and Summers, 2024, pp. 35–37
            </ExternalLink>
            ). Their range, {centaxRange.lower.toFixed(1)} to {centaxRange.upper.toFixed(1)}, is not
            adjusted: {centaxRange.upper.toFixed(1)} is the US estimate for larger changes without
            controls, and {centaxRange.lower.toFixed(1)} approaches a Canadian estimate of no lasting
            response.
          </li>
          <li>
            <strong>The OBR adds income tax back separately.</strong> Its{" "}
            {official.e_retention} covers every behaviour, income shifting included, and its
            costing then treats {Math.round(shifting.share * 1000) / 10}% of the response to the
            narrowing gap between income tax and CGT rates as income no longer presented as gains,
            taxed as income (
            <ExternalLink href={`${shifting.url}#page=3`}>OBR, January 2025, p. 3 and Table 1.1</ExternalLink>
            ). In its costing of the October 2024 rise, that income tax was £1.5bn of the £2.5bn
            raised in 2029-30, against £4.9bn of CGT lost to behaviour (Table 1.3).
          </li>
        </ul>
        <p className="mt-4 text-sm leading-6 text-slate-600">
          The two approaches put the cases on one footing in opposite directions. The switch at the
          top of the page chooses between them for every tab except Baseline.
        </p>

        <h3 className="mt-5 text-base font-semibold text-slate-800">
          {approaches.cgt_only.label}: CGT only
        </h3>
        <ul className="mt-2 list-disc space-y-2 pl-5 text-sm leading-6 text-slate-600">
          <li>
            <strong>What it shows.</strong> Every gain not realised counts as lost revenue; the
            figures are the change in CGT alone.
          </li>
          <li>
            <strong>Cases.</strong> No response; CenTax&apos;s {centaxRange.lower.toFixed(1)};
            CenTax&apos;s {unadjusted.e_retention.toFixed(1)} before its adjustments, the central
            case; CenTax&apos;s {centaxRange.upper.toFixed(1)}; and the official{" "}
            {official.e_retention} with nothing added back.
          </li>
          <li>
            <strong>Assumptions.</strong> {unadjusted.e_retention.toFixed(1)} removes both of
            CenTax&apos;s adjustments, not only the one for income shifting, because CenTax do not
            say how much each accounts for. A reform of rates alone keeps the uplift at death, so
            the second adjustment would not apply to it either. CenTax do not publish{" "}
            {unadjusted.e_retention.toFixed(1)} as their estimate for any reform: it is their
            starting point.
          </li>
          <li>
            <strong>Caveats.</strong> It understates total revenue by leaving out the income tax on
            shifted income, which both CenTax and the OBR count. HMRC&apos;s ready-reckoner figures
            include income tax effects, so the comparison on the Benchmarks tab is not like for like.
            CenTax&apos;s {centaxRange.lower.toFixed(1)} and {centaxRange.upper.toFixed(1)} are the
            same unadjusted bounds as in the other approach.
          </li>
        </ul>

        <h3 className="mt-5 text-base font-semibold text-slate-800">
          {approaches.total_revenue.label}: total revenue
        </h3>
        <ul className="mt-2 list-disc space-y-2 pl-5 text-sm leading-6 text-slate-600">
          <li>
            <strong>What it shows.</strong> CenTax&apos;s published elasticities, which already
            allow for shifted income, and the official elasticity with the OBR&apos;s income tax on
            shifted income added back: total revenue across CGT and income tax.
          </li>
          <li>
            <strong>Cases.</strong> No response; CenTax&apos;s {centaxRange.lower.toFixed(1)},{" "}
            {centaxCentral.e_retention.toFixed(1)} (the central case) and{" "}
            {centaxRange.upper.toFixed(1)}; and the official {official.e_retention} plus the income
            tax. The same addition goes to the official columns of the ready-reckoner rows.
          </li>
          <li>
            <strong>Assumptions.</strong> The income tax added back is{" "}
            {Math.round(shifting.share * 1000) / 10}% of the behavioural fall in realised gains, taxed
            at {Math.round(shifting.tax_rate * 100)}%. {shifting.tax_rate_note}{" "}
            {shifting.obr_check}
          </li>
          <li>
            <strong>Caveats.</strong>
            <ul className="mt-1 list-[circle] space-y-1 pl-5">
              <li>
                CenTax&apos;s {centaxCentral.e_retention.toFixed(1)} also includes their adjustment for
                the uplift at death, which a reform of rates alone does not remove; by CenTax&apos;s own
                reasoning the response to this reform would be larger.
              </li>
              <li>
                The addition applies to the whole response. For equalisation the whole response comes
                from narrowing the gap with income tax, as the OBR describes; for a schedule in the
                Rate explorer that sets CGT above income tax rates the assumption does not hold.
              </li>
              <li>
                The income tax is in the revenue figures but not in the distributional charts, which
                reflect the change in CGT alone.
              </li>
              <li>
                Gains that lose Business Asset Disposal Relief take the official{" "}
                {official.e_retention}, where the OBR uses 1.4 for the relief, because the engine has
                one elasticity per run (
                <ExternalLink href="https://github.com/PolicyEngine/policyengine-uk/issues/1979">
                  policyengine-uk#1979
                </ExternalLink>
                ). The {official.e_retention} itself was set for the October 2024 change; the
                OBR&apos;s figure for a rise as large as equalisation is not published.
              </li>
              <li>
                The engine does not model the shifted income itself; this repository adds it to the
                engine&apos;s results (
                <ExternalLink href="https://github.com/PolicyEngine/policyengine-uk/issues/1982">
                  policyengine-uk#1982
                </ExternalLink>
                ).
              </li>
            </ul>
          </li>
        </ul>

        <h3 className="mt-5 text-base font-semibold text-slate-800">Both approaches</h3>
        <ul className="mt-2 list-disc space-y-2 pl-5 text-sm leading-6 text-slate-600">
          <li>
            Every case is a medium-term response, applied in full from 2026-27; neither models the
            timing of disposals around the change.
          </li>
          <li>
            The engine measures each person&apos;s marginal rate on gains with limited precision
            at the largest gains, which moves the behavioural cases slightly (
            <ExternalLink href="https://github.com/PolicyEngine/policyengine-uk/issues/1979">
              policyengine-uk#1979
            </ExternalLink>
            ).
          </li>
          <li>
            <strong>On {dataset.shortLabel}.</strong> Equalisation raises{" "}
            {formatSignedBn(cases.centax_central.revenue_2026_bn, 1)} in 2026-27 net of income
            shifting (CenTax&apos;s {centaxCentral.e_retention.toFixed(1)}) and{" "}
            {formatSignedBn(cases.centax_unadjusted.revenue_2026_bn, 1)} gross of it (
            {unadjusted.e_retention.toFixed(1)}). At the official elasticity it changes revenue by{" "}
            {formatSignedBn(cases.official.revenue_2026_bn, 1)} counting CGT alone, and by{" "}
            {formatSignedBn(cases.official.revenue_2026_bn + officialOffset, 1)} once the
            OBR&apos;s income tax on shifted income ({formatSignedBn(officialOffset, 1)}) is added
            back.
          </li>
        </ul>
      </section>

      <section className="section-card scroll-mt-24" id="explorer">
        <SectionHeading title="Rate explorer" />
        <ul className="mt-2 list-disc space-y-2 pl-5 text-sm leading-6 text-slate-600">
          <li>
            <strong>Same pipeline, run live.</strong> The Rate explorer tab scores a schedule of
            CGT rates and a treatment of Business Asset Disposal Relief you choose on the selected
            dataset for every modelled year. It runs the pipeline&apos;s own code (the same pinned
            per-year datasets, cached baseline simulations, behavioural response and impact
            calculations) on a Modal backend, or locally through the{" "}
            <span className="font-mono text-xs">uk-cgt-reform-explore</span> command. Nothing
            is precomputed or interpolated: an explorer run at 20% / 40% / 45% with the relief
            withdrawn builds the Reform impacts tab&apos;s own reform and reproduces its figures.
          </li>
          <li>
            <strong>Scope.</strong> The chosen rates reach the main schedule and the residential
            property schedule, which have charged the same rates since 30 October 2024. Business
            Asset Disposal Relief can be kept, at a whole-point rate no higher than the additional
            rate and a lifetime limit of £500k, £1m (current law) or £10m (the limit until March
            2020), or withdrawn. Carried interest has been taxed as income since April 2026 and
            stays outside the explorer.
          </li>
          <li>
            <strong>Cache.</strong> Every completed run is stored under a key made of the dataset
            digest, the projection fingerprint, the engine and wrapper versions and the reform
            fingerprint (the rates and the elasticity). Anyone who later asks for the same schedule
            is served the stored result at once, and a change to the data or the engine can never
            reuse a stale one.
          </li>
        </ul>
      </section>
    </div>
  );
}
