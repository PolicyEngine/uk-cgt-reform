"use client";

import { useState } from "react";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@policyengine/ui-kit/primitives";
import { ReadingLayout } from "./ReadingGuide";
import { SourceLink } from "./controls";

const CENTAX =
  "https://centax.org.uk/wp-content/uploads/2024/10/AdvaniLonsdaleSummers2024_CGTReform.pdf";
const SECTIONS = [
  { id: "current-rates", label: "Today's rules" },
  { id: "tax-base", label: "Where revenue is lost" },
  { id: "reform-scope", label: "What we model" },
];
const PATHS = [
  {
    id: "death",
    label: "Hold until death",
    category: "A gain can escape CGT",
    title: "The original gain is wiped from the CGT calculation",
    steps: [
      "An asset rises in value",
      "Its owner dies holding it",
      "The inheritor's cost resets",
    ],
    explanation:
      "Assets generally pass at their market value on death. The inheritor pays CGT on later growth when they sell, but the gain built up before death falls outside CGT. Inheritance Tax is a separate tax and may still apply.",
    proposal:
      "CenTax proposes carrying the original cost over to the inheritor, with a credit for Inheritance Tax already paid when the asset is eventually sold.",
    source:
      "https://www.gov.uk/government/publications/death-personal-representatives-and-legatees-hs282-self-assessment-helpsheet/hs282-death-personal-representatives-and-legatees-2026",
    sourceLabel: "HMRC: assets inherited on death",
    page: 4,
  },
  {
    id: "migration",
    label: "Move abroad",
    category: "A gain can leave the UK tax base",
    title: "UK gains can be realised after leaving the UK",
    steps: [
      "A gain builds up in the UK",
      "The owner becomes non-resident",
      "They sell while abroad",
    ],
    explanation:
      "Non-residents can fall outside UK CGT on assets such as shares. Exceptions matter: UK land and property remain in scope, and temporary non-residence rules can tax some gains on return. Moving abroad does not automatically make every gain tax-free.",
    proposal:
      "CenTax proposes taxing accrued gains on departure and rebasing assets on arrival. Revenue can be lost through emigration even when the move is not motivated by tax.",
    source: "https://www.gov.uk/capital-gains-tax/what-you-pay-it-on",
    sourceLabel: "HMRC: non-residents and taxable assets",
    page: 4,
  },
  {
    id: "deferral",
    label: "Defer a sale",
    category: "Tax is delayed",
    title: "A rise in value usually is not taxed until disposal",
    steps: [
      "An asset rises in value",
      "The owner keeps the asset",
      "CGT waits for disposal",
    ],
    explanation:
      "Holding an asset delays CGT and leaves the owner with the money in the meantime. Delay is different from permanent exemption: death or emigration can turn a deferred gain into one that escapes UK CGT.",
    proposal:
      "CenTax distinguishes the benefit of paying tax later from the structural gaps at death and departure. Changing rates alone leaves those gaps in place.",
    source: `${CENTAX}#page=20`,
    sourceLabel: "CenTax: deferral incentives, pp. 19–20",
    page: 69,
  },
  {
    id: "shifting",
    label: "Take income as gains",
    category: "Revenue moves between taxes",
    title: "Lower rates on gains encourage income to be presented as gains",
    steps: [
      "Someone earns income",
      "They structure it as a gain",
      "It faces a different tax rate",
    ],
    explanation:
      "A company owner may receive returns through capital gains instead of salary. As CGT and income tax rates converge, some of that income can return to the income tax base. A fall in CGT receipts need not be an equal fall in total tax receipts.",
    proposal:
      "The dashboard's income-shifting approaches determine how income tax and National Insurance enter the revenue estimate. The addition is not allocated to household results.",
    source:
      "https://obr.uk/docs/dlm_uploads/CGT-supplementary-release-Jan-2025.pdf#page=3",
    sourceLabel: "OBR: income shifting, January 2025",
    page: 5,
  },
];

export default function CgtGuideTab({ onNavigate }) {
  const [path, setPath] = useState("death");
  return (
    <ReadingLayout sections={SECTIONS}>
      <section id="current-rates" className="story-section">
        <p className="eyebrow">The starting point · 2026–27</p>
        <h2>How CGT works under current law</h2>
        <p className="section-intro">
          CGT taxes the gain when an asset is disposed of, rather than the full
          amount received.
        </p>
        <div className="rule-grid">
          <div>
            <span className="step-number">1</span>
            <h3>Work out the gain</h3>
            <p>
              Deduct the purchase cost and allowable costs from the disposal
              value. Losses and reliefs can reduce the taxable amount.
            </p>
          </div>
          <div>
            <span className="step-number">2</span>
            <h3>Apply the allowance</h3>
            <strong className="rule-number">£3,000</strong>
            <p>The annual tax-free amount for individuals.</p>
          </div>
          <div>
            <span className="step-number">3</span>
            <h3>Apply the rates</h3>
            <strong className="rule-number">
              18% <span>/</span> 24%
            </strong>
            <p>
              Gains use any remaining basic-rate band at 18%; amounts above it
              face 24%.
            </p>
          </div>
        </div>
        <div className="insight-note">
          <strong>Income fills the band first.</strong> Even a basic-rate income
          taxpayer can pay 24% on part of a gain. Current CGT has no separate
          additional rate.
        </div>
        <p className="source-note">
          <SourceLink href="https://www.gov.uk/capital-gains-tax/rates">
            HMRC: rates and the income-band calculation
          </SourceLink>{" "}
          ·{" "}
          <SourceLink href="https://www.gov.uk/capital-gains-tax/allowances">
            Annual allowance
          </SourceLink>
        </p>
        <details className="disclosure">
          <summary>Reliefs, homes and other exceptions</summary>
          <div>
            <p>
              Business Asset Disposal Relief charges 18% on eligible gains from
              6 April 2026, subject to a £1 million lifetime limit and
              qualifying conditions.{" "}
              <SourceLink href="https://www.gov.uk/business-asset-disposal-relief">
                HMRC: Business Asset Disposal Relief
              </SourceLink>
            </p>
            <p>
              A main home usually qualifies for relief; investments in ISAs are
              outside CGT. Other residential property can be taxable.{" "}
              <SourceLink href="https://www.gov.uk/capital-gains-tax/what-you-pay-it-on">
                HMRC: what you pay CGT on
              </SourceLink>
            </p>
            <p>
              Carried interest moved to the income tax framework, including
              National Insurance, from 6 April 2026.{" "}
              <SourceLink href="https://www.gov.uk/capital-gains-tax/rates">
                HMRC: carried interest
              </SourceLink>
            </p>
          </div>
        </details>
      </section>

      <section id="tax-base" className="story-section">
        <p className="eyebrow">Beyond the tax rate</p>
        <h2>Where revenue can be lost or delayed</h2>
        <p className="section-intro">
          These features exist at today's rates. Advani, Lonsdale and Summers
          distinguish changes to the rate from changes to which gains are taxed.
        </p>
        <Tabs value={path} onValueChange={setPath} className="path-explainer">
          <TabsList
            aria-label="Routes through the CGT system"
            className="path-tabs"
            variant="line"
          >
            {PATHS.map((item) => (
              <TabsTrigger key={item.id} value={item.id}>
                {item.label}
              </TabsTrigger>
            ))}
          </TabsList>
          {PATHS.map((item) => (
            <TabsContent key={item.id} value={item.id} className="path-content">
              <span className="context-tag">{item.category}</span>
              <h3>{item.title}</h3>
              <ol className="mechanism-path">
                {item.steps.map((step, index) => (
                  <li key={step}>
                    <span>{index + 1}</span>
                    {step}
                  </li>
                ))}
              </ol>
              <p>{item.explanation}</p>
              <div className="insight-note">{item.proposal}</div>
              <p className="source-note">
                <SourceLink href={item.source}>{item.sourceLabel}</SourceLink> ·{" "}
                <SourceLink href={`${CENTAX}#page=${item.page}`}>
                  CenTax explanation
                </SourceLink>
              </p>
            </TabsContent>
          ))}
        </Tabs>
      </section>

      <section id="reform-scope" className="story-section">
        <p className="eyebrow">Reading this analysis</p>
        <h2>Rates reform and tax-base reform are different</h2>
        <p className="section-intro">
          This dashboard changes CGT rates and Business Asset Disposal Relief.
          It does not cost the full CenTax package.
        </p>
        <div className="scope-grid">
          <div className="scope-card">
            <span className="context-tag">Modelled here</span>
            <h3>Rates and the business relief</h3>
            <p>
              The headline reform sets rates to 20%, 40% and 45% and withdraws
              the relief. The explorer lets you change those choices.
            </p>
            <button
              className="text-link"
              onClick={() => onNavigate("explorer")}
            >
              Explore a reform →
            </button>
          </div>
          <div className="scope-card">
            <span className="context-tag neutral">Outside this reform</span>
            <h3>Changes to the tax base</h3>
            <p>
              Removing the uplift at death, a departure charge, an investment
              allowance and changes to loss relief belong to the wider CenTax
              package.
            </p>
            <SourceLink href={`${CENTAX}#page=3`}>
              Read the proposed package ↗
            </SourceLink>
          </div>
        </div>
        <div className="insight-note">
          <strong>The behavioural response is an aggregate assumption.</strong>{" "}
          It changes realised gains. The model does not separately simulate or
          estimate the revenue lost through each route above.
        </div>
        <button
          className="text-link mt-4"
          onClick={() => onNavigate("methodology", "elasticity")}
        >
          How behavioural assumptions enter the estimate →
        </button>
      </section>
    </ReadingLayout>
  );
}
