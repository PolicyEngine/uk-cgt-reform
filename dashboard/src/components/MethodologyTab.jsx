"use client";

import { useEffect } from "react";
import { getBenchmarks, getDatasetInfo, getMetadata } from "../lib/dataHelpers";
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
  const metadata = getMetadata(data);
  const { central, official } = getBenchmarks(data).elasticities;
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
            simulated here. The build comes from{" "}
            <ExternalLink href="https://github.com/PolicyEngine/microcosm">microcosm</ExternalLink>
            . {dataset.columns}
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
            <strong>Gainers below the exempt amount.</strong> At the base year they owe nothing;
            once the engine uprates gains past the frozen exempt amount they become taxpayers.{" "}
            {dataset.notes} The Baseline tab reports them as entrants by uprating and shows every
            figure with and without them.
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
          {obrGaps.length ? (
            <li>
              <strong>The projection against the OBR&apos;s forecast.</strong> Every year on this
              dashboard uses the engine&apos;s own projection. The engine&apos;s baseline CGT
              liability differs from the OBR&apos;s forecast of CGT receipts (
              {obrComparison.obr_receipts_source}) by{" "}
              {obrGaps.map((row) => `${signedGap(row.gap)} in ${row.year}`).join(", ")}. The two
              measure different things: receipts arrive about a year after the liability they
              settle, and the engine grows each year&apos;s gains from the {baseYearLabel} base year
              by OBR GDP per capita, where the OBR forecasts receipts year by year.
            </li>
          ) : null}
          <li>
            <strong>Schedules.</strong> policyengine-uk {metadata.policyengine_uk_version}{" "}
            charges residential property and Business Asset Disposal Relief gains on their own
            schedules when a dataset records them. The reform takes residential property gains
            to the same income tax rates and withdraws the relief, so qualifying gains (Investors&apos;
            Relief included, which the engine&apos;s input merges with it) take the reformed main
            rates, as in CenTax&apos;s rates-only estimate. Carried interest has been taxed as
            income since 6 April 2026, outside CGT, so the reform and custom rates leave it
            where it is. On a dataset without those columns the extra parameters are inert.
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
            <span className="break-all font-mono text-xs">{metadata.elasticity_parameter}</span>) and
            leaves its marginal-tax-rate parameter at zero (see below).
          </li>
        </ul>
      </section>

      <section className="section-card scroll-mt-24" id="elasticity">
        <SectionHeading
          title="Behavioural response: CenTax's elasticity, in CenTax's convention"
          description="How realised gains respond to the share of each gain a taxpayer keeps."
        />
        <p className="text-sm leading-6 text-slate-600">
          <ExternalLink href={central.url}>Arun Advani and CenTax</ExternalLink> apply one
          aggregate elasticity to the CGT base as a whole, with respect to the{" "}
          <em>retention rate</em> (1 − t), the share of gains a taxpayer keeps after tax (pp.{" "}
          <ExternalLink href={centaxPage(33)}>32</ExternalLink> and{" "}
          <ExternalLink href={centaxPage(38)}>37</ExternalLink>). The model takes their
          convention but not their calculation: it applies the elasticity as a power to each
          person&apos;s marginal retention rate. A person&apos;s marginal rate differs from an
          aggregate rate, and away from 1.0, as at the sensitivity table&apos;s
          0.5 and 2.0, the power differs from a linear reading of the elasticity. For each person,
        </p>
        <p className="my-3 rounded-lg bg-slate-50 p-4 text-center font-mono text-sm">
          realised gains × ((1 − t₁) / (1 − t₀))<sup>e</sup>
        </p>
        <p className="text-sm leading-6 text-slate-600">
          where t₀ and t₁ are the person&apos;s marginal rates on gains under current law and
          under the reform, shared across the main, residential property and Business Asset
          Disposal Relief schedules in proportion to the gains on each. The central case is
          CenTax&apos;s {central.e_retention.toFixed(1)}, which they call &ldquo;our central
          elasticity estimate&rdquo; (
          <ExternalLink href={central.url}>Advani, Lonsdale and Summers, 2024, p. 37</ExternalLink>
          ). PolicyEngine UK adopts CenTax&apos;s central value as its default (policyengine-uk
          2.134.0,{" "}
          <ExternalLink href="https://github.com/PolicyEngine/policyengine-uk/pull/2419">
            PR #2419
          </ExternalLink>
          ), and this dashboard sets the elasticity directly in every case. It is an assumption
          for a package that also reforms the base, not an estimate for this rates-only reform,
          so{" "}
          <TabLink onNavigate={onNavigate} tab="reform" section="sensitivity">
            the Reform tab&apos;s sensitivity table for equalisation
          </TabLink>{" "}
          shows CenTax&apos;s range and the
          official HMRC/OBR elasticity described below beside it, with a case of no response.
        </p>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          CenTax&apos;s package removes the uplift at death and charges gains on departure,
          closing two ways of deferring or avoiding the tax; this dashboard models neither. They
          expect a larger response to a rate rise on the current base and{" "}
          <ExternalLink href="https://www.nuffieldfoundation.org/wp-content/uploads/2023/03/Taxes-at-the-top-Understanding-what-high-earners-pay-and-options-for-reform.pdf#page=20">
            advise against equalising rates without those reforms
          </ExternalLink>{" "}
          (Advani, Hughson and Summers, <em>Taxes at the top</em>, CenTax, September 2026, p.
          17).
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
            {official.badr_e_retention} for gains qualifying for Business Asset Disposal Relief
            (OBR, {formatPublished(official.published.slice(0, 7))},{" "}
            <ExternalLink href={`${official.url}#page=3`}>para 1.9</ExternalLink> and{" "}
            <ExternalLink href={`${official.url}#page=5`}>Table 1.1</ExternalLink>; HMRC&apos;s estimate
            from 1998 to 2018 is 4.0,{" "}
            <ExternalLink href={`${official.url}#page=3`}>para 1.10</ExternalLink>). The main figure is{" "}
            {(official.e_retention / central.e_retention).toFixed(1)} times CenTax&apos;s central
            case. The official case applies both: the engine gives gains qualifying for the relief
            their own elasticity, and both kinds of gain respond to the same change in a
            person&apos;s marginal rate.
          </li>
          <li>
            <strong>Why the two differ.</strong> CenTax start from US evidence, about 1.5 five
            years after a change (Agersnap and Zidar, 2021), and lower it to{" "}
            {central.e_retention.toFixed(1)} for two reasons: their package removes the uplift at
            death, which the US keeps; and equalisation brings income that was presented as gains
            back into income tax, which estimates measured on the CGT base count as lost. CenTax make
            no adjustment for the charge on departure, on the grounds that the US evidence already
            reflects little scope to avoid the tax by emigrating. HMRC&apos;s figure is estimated from UK responses under the
            current base.
          </li>
          <li>
            <strong>What it does to a rate rise.</strong> Take a taxpayer whose marginal rate on
            gains rises from 24% to 34%, as in the ready reckoner&apos;s largest row. At the central
            elasticity, their realised gains fall by {percent(atCentral.gains)} and the revenue
            those gains raise {atCentral.revenue >= 0 ? "rises" : "falls"} by{" "}
            {percent(atCentral.revenue)}. At the official elasticity, realised gains fall by{" "}
            {percent(atOfficial.gains)} and revenue {atOfficial.revenue >= 0 ? "rises" : "falls"} by{" "}
            {percent(atOfficial.revenue)}, the direction HMRC&apos;s row shows. On a dataset, the
            aggregate effect depends on where its taxpayers&apos; marginal rates on gains sit.
          </li>
          <li>
            <strong>On this dataset.</strong>{" "}
            <TabLink onNavigate={onNavigate} tab="reform" section="sensitivity">
              The Reform tab&apos;s sensitivity table
            </TabLink>{" "}
            gives
            the reform&apos;s first-year change in CGT revenue at each elasticity, and the
            Benchmarks tab scores the ready reckoner&apos;s rows at the central and the official
            one.
          </li>
        </ul>
      </section>

      <section className="section-card scroll-mt-24" id="explorer">
        <SectionHeading title="Custom rates, run live" />
        <ul className="mt-2 list-disc space-y-2 pl-5 text-sm leading-6 text-slate-600">
          <li>
            <strong>Same pipeline, run live.</strong> The Reform tab&apos;s Custom rates option
            scores a schedule of CGT rates and a treatment of Business Asset Disposal Relief you
            choose on {dataset.shortLabel} for every modelled year. It runs the pipeline&apos;s own
            code (the same pinned per-year datasets, cached baseline simulations, behavioural
            response and impact calculations) on a Modal backend, or locally through the{" "}
            <span className="font-mono text-xs">uk-cgt-reform-explore</span> command. Nothing
            is precomputed or interpolated. Run live, equalisation with the relief withdrawn
            builds the pipeline&apos;s own reform and reproduces its figures, so the tab shows the
            precomputed results for that schedule at once and runs any other schedule live,
            including equalisation with a value changed.
          </li>
          <li>
            <strong>Scope.</strong> The chosen rates reach the main schedule and the residential
            property schedule, which have charged the same rates since 30 October 2024. Business
            Asset Disposal Relief can be kept, at a whole-point rate no higher than the additional
            rate and a lifetime limit of £500k, £1m (current law) or £10m (the limit until March
            2020), or withdrawn.
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
