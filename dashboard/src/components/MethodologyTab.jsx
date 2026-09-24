"use client";

import { useEffect } from "react";
import { getDatasetInfo, getElasticity, getMetadata } from "../lib/dataHelpers";
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

export default function MethodologyTab({ data }) {
  // Analysis sections can link here with /?tab=methodology#<id>; the tab
  // mounts after navigation, so the browser's native hash scroll has already
  // missed and we replay it.
  useEffect(() => {
    const hash = window.location.hash;
    if (hash) {
      document.getElementById(hash.slice(1))?.scrollIntoView();
    }
  }, []);

  const elasticity = getElasticity(data);
  const dataset = getDatasetInfo(data);
  const metadata = getMetadata(data);
  const isCandidate = dataset.role === "candidate";

  return (
    <div className="space-y-6">
      <section className="section-card scroll-mt-24" id="pathway">
        <SectionHeading title="Data and simulation" />
        <ul className="mt-2 list-disc space-y-2 pl-5 text-sm leading-6 text-slate-600">
          <li>
            <strong>Two datasets, one pipeline.</strong> The pipeline registers an incumbent
            (the Enhanced FRS 2024-25 published by{" "}
            <ExternalLink href="https://github.com/PolicyEngine/policyengine-uk-data">
              policyengine-uk-data
            </ExternalLink>
            ) and a candidate (the Microcosm UK 2024-25 national line staged from{" "}
            <ExternalLink href="https://github.com/PolicyEngine/microcosm">microcosm</ExternalLink>
            ), each pinned to an immutable revision and a sha256 digest that is checked
            before anything runs. The same reform, engine and projection run on both; the
            Dataset comparison tab lays the results side by side.
          </li>
          <li>
            <strong>Selected dataset.</strong> {dataset.label}: {dataset.producer}.{" "}
            Pinned input <span className="break-all font-mono text-xs">{dataset.uri}</span>{" "}
            (sha256 <span className="font-mono text-xs">{dataset.sha256.slice(0, 12)}…</span>
            ), used exactly as published with no local reweighting &mdash; calibration belongs
            upstream in the dataset, so whatever the file provides is what is simulated here.
          </li>
          {isCandidate ? (
            <>
              <li>
                <strong>Gains imputation.</strong> {dataset.observation}. Amounts are redrawn
                from HMRC&apos;s Table 3 (size of gain by taxable income) so the top bands that
                carry most of the tax are represented, and each liable gainer is assigned a
                main asset type from HMRC Tables 7 and 8, with residential property gains
                written to their own column.
              </li>
              <li>
                <strong>Gainers beyond HMRC&apos;s count.</strong> {dataset.notes} At the base
                year they owe nothing; once the engine uprates gains past the frozen exempt
                amount they become taxpayers. The Baseline tab reports them as entrants by
                uprating and shows every figure with and without them.
              </li>
              <li>
                <strong>Why this dataset is the default, and when it moves.</strong> The
                candidate is the dataset this comparison exists to evaluate and the only one
                carrying the schedules the reform charges. It is a staged candidate built from
                microcosm pull request #979, not a certified release: it is re-pinned when that
                pull request lands on main and again when a certified national release exists.
              </li>
            </>
          ) : (
            <>
              <li>
                <strong>Gains imputation.</strong> The FRS barely captures capital gains, so
                the dataset imputes them onto survey households from the{" "}
                <ExternalLink href="https://warwick.ac.uk/fac/soc/economics/research/centres/cage/manage/publications/wp465.2020.pdf">
                  Advani &amp; Summers
                </ExternalLink>{" "}
                distribution of gains by income band, drawn from HMRC administrative records.
              </li>
              <li>
                <strong>Large gains.</strong> HMRC&apos;s size-of-gain distribution (
                <ExternalLink href="https://www.gov.uk/government/statistics/capital-gains-tax-statistics">
                  CGT statistics, Table 2.1a
                </ExternalLink>
                ) is represented directly: households carrying each published size-of-gain
                band&apos;s mean gain are included in the dataset, and the calibrated weights
                are targeted to reproduce each band&apos;s taxpayer count and gains total.
              </li>
              <li>
                <strong>Calibration.</strong> {dataset.observation}. The measured fit is in the
                benchmarks table on the Baseline tab.
              </li>
            </>
          )}
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
            charges residential property, carried interest and Business Asset Disposal Relief
            gains on their own schedules when a dataset records them. Equalising CGT with income
            tax means every gain, so the reform sets those schedules to the same income tax
            rates and withdraws the BADR lifetime limit; on a dataset without those columns the
            extra parameters are inert.
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
            results. The elasticity is set on the engine&apos;s marginal-tax-rate parameter (
            <span className="font-mono text-xs">{metadata.elasticity_parameter}</span>); the
            engine also offers a retention-rate parameter, which this analysis leaves at zero.
          </li>
        </ul>
      </section>

      <section className="section-card scroll-mt-24" id="elasticity">
        <SectionHeading
          title="Behavioural response: the Advani/CenTax elasticity"
          description="How the retention-rate elasticity in the literature maps onto the marginal-tax-rate elasticity the model applies."
        />
        <p className="text-sm leading-6 text-slate-600">
          <ExternalLink href="https://centax.org.uk/wp-content/uploads/2024/10/AdvaniLonsdaleSummers2024_CGTReform.pdf#page=38">
            Arun Advani and CenTax
          </ExternalLink>{" "}
          express the responsiveness of realised gains as an elasticity with respect to the{" "}
          <em>retention rate</em> (1 − t): how much realisations rise when taxpayers keep a
          larger share of each pound of gain. PolicyEngine applies an elasticity with respect
          to the <em>marginal tax rate</em> t. The two are related by
        </p>
        <p className="my-3 rounded-lg bg-slate-50 p-4 text-center font-mono text-sm">
          e<sub>mtr</sub> = −e<sub>retention</sub> × t / (1 − t)
        </p>
        <p className="text-sm leading-6 text-slate-600">
          because a small rise in t is a proportionally larger fall in (1 − t) when t is high.
          At the gains-weighted average marginal rates under the reform, the central
          retention-rate elasticity of {elasticity.retention_rate_elasticity.toFixed(1)}{" "}
          converts to an MTR elasticity of about {elasticity.mtr_elasticity_approx.toFixed(1)},
          which is what the model applies. The reform tab&apos;s sensitivity table re-runs the
          analysis under the static case and the lower end of CenTax&apos;s range.
        </p>
      </section>

      <section className="section-card scroll-mt-24" id="explorer">
        <SectionHeading title="Rate explorer" />
        <ul className="mt-2 list-disc space-y-2 pl-5 text-sm leading-6 text-slate-600">
          <li>
            <strong>Same pipeline, run live.</strong> The Rate explorer tab scores a schedule of
            main CGT rates you choose on the selected dataset for every modelled year. It runs the
            pipeline&apos;s own code (the same pinned per-year datasets, cached baseline
            simulations, behavioural response and impact calculations) on a Modal backend, or
            locally through the{" "}
            <span className="font-mono text-xs">uk-cgt-reform-explore</span> command. Nothing
            is precomputed or interpolated: an explorer run at 20% / 40% / 45% reproduces the
            Reform impacts tab.
          </li>
          <li>
            <strong>Scope.</strong> The chosen rates reach the main schedule and the residential
            property schedule, which the law aligned with the main rates from April 2025. Carried
            interest and Business Asset Disposal Relief stay at current law: neither registered
            dataset records such gains, so their treatment is inert here. The equalisation reform
            on the Reform impacts tab also sets those schedules; the difference is invisible on
            these datasets.
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
