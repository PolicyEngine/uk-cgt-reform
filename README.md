# UK capital gains tax reform

Data pipeline and dashboard estimating the budgetary and distributional
impact of reforms to UK capital gains tax rates from 2026-27, using the
standard [policyengine.py](https://github.com/PolicyEngine/policyengine.py)
stack (the `policyengine` package wrapping the PolicyEngine UK model). They
score two things:

- **Equalising CGT rates with income tax rates.** Wes Streeting proposed the
  rate change in May 2026
  ([Bloomberg](https://www.bloomberg.com/news/articles/2026-05-21/streeting-backs-hiking-uk-capital-gains-levy-to-match-income-tax)),
  alongside closing loopholes and an exemption for "genuine entrepreneurs"
  ([Tax Justice UK](https://taxjustice.uk/blog/what-would-bunham-mean-for-britain/));
  CenTax costs it within a wider package that also reforms the CGT base (see
  [Benchmarks](#benchmarks)). This repo models the rate change. The pipeline
  scores it and commits the results, which the dashboard's Reform impacts tab
  shows.
- **Any schedule of main CGT rates** a reader chooses, scored live by the
  dashboard's Rate explorer tab through the same code, dataset, engine and
  projection (see [Rate explorer](#rate-explorer)).

The repository was called `uk-equalising-cgt` until the rate explorer took
its scope beyond equalisation; GitHub redirects the old URL, and the
dashboard redirects its former path `/uk/equalising-cgt` (and the bare
deployment domain) to `/uk/cgt-reform`, query string included.

The pipeline runs on one dataset, used exactly as published with no local
reweighting:

| Key | Dataset | Pinned input |
|---|---|---|
| `microcosm_uk_2024_25_c5a1cba8` | Microcosm UK 2024-25, the national line built by [microcosm](https://github.com/PolicyEngine/microcosm)'s consolidated build path from main at c5a1cba8, the merge of [microcosm#1045](https://github.com/PolicyEngine/microcosm/pull/1045) (`staged/uk-frs-calibration-attempt-20260930T155755Z-f8182725`, built with policyengine-uk 2.100.0; a staging build whose seven calibration-seam gates passed, not a certified release) | `hf://policyengine/populace-uk-private/staged/uk-frs-calibration-attempt-20260930T155755Z-f8182725/microcosm_uk_2024_25.h5@1b295f37…`, sha256 `c64f916d…` |

The dataset carries the capital gains asset-type breakdown
(`capital_gains_residential_property`) and the gains qualifying for Business
Asset Disposal Relief or Investors' Relief (`capital_gains_badr`), which
policyengine-uk charges on their own schedules. Its capital gains come from
the build of [microcosm#1045](https://github.com/PolicyEngine/microcosm/pull/1045):
amounts redrawn from HMRC Table 3 with weights that reproduce Table 3's gains
by taxable income band, the relief imputed from HMRC Table 4, and gain
carriers conditioned on wealth. It replaced the microcosm#979 PR-head build
on 30 September 2026 and is re-pinned to the published Microcosm UK release
once that exists. Earlier versions of this repo also ran the Enhanced FRS
2024-25 and laid the two side by side; the comparison is retired now the
analysis uses Microcosm alone.

**Note on decile impacts vs revenue:** household net-income losses in the decile
tables include both the extra tax paid and the gains taxpayers choose not to
realise under the behavioural response, so they are roughly an order of
magnitude larger than the net revenue raised. This is a mechanical property of
modelling the response as a reduction in realised gains, not a bug.

## The equalisation reform (from 2026-27)

| Band | Baseline CGT rate | Reformed rate (= income tax) |
|---|---|---|
| Basic | 18% | **20%** |
| Higher | 24% | **40%** |
| Additional | 24% | **45%** |

Annual exempt amount unchanged at £3,000. Fiscal years 2026-27 through
2030-31.

The reformed rates are the income tax rates on earnings, 20/40/45%, held
through 2030-31. From April 2027 savings and property income face 22/42/47%
(the property rates in England, Wales and Northern Ireland), and Scottish
taxpayers' earnings face Scotland's own bands; the reform follows neither.

policyengine-uk 2.99.0 charges residential property gains, carried interest
and gains qualifying for Business Asset Disposal Relief on their own
schedules when a dataset records them, and a reform that touches only the
three main rates no longer reaches them. The reform also takes residential
property gains to 20/40/45% and withdraws Business Asset Disposal Relief
(the engine's lifetime limit goes to zero, so qualifying gains, Investors'
Relief included, fall to the main schedule), as CenTax's rates-only estimate
does. Carried interest has been taxed as income since 6 April 2026 (the
engine keeps a 32% CGT stand-in), so equalising CGT with income tax leaves
it alone. On a dataset without these columns the parameters are inert.

The results split the reform's 2026-27 yield by schedule
(`schedule_split`, static and central): the main rates first, then the
residential property schedule (which is equalisation with the relief kept,
the reading closest to Wes Streeting's proposed exemption for genuine
entrepreneurs), then the relief withdrawn. The Rate explorer scores any rate
and lifetime limit for the relief, or withdraws it, for every year.

## Results (2026-27 unless stated)

Engine policyengine-uk 2.104.0, wrapper policyengine.py 4.22.3, projection
fingerprint `e76b2e927c55`.

| | Microcosm UK 2024-25 | External benchmark |
|---|---:|---|
| CGT taxpayers (gains above the exempt amount) | 559k | HMRC Table 1: 382k (2023-24), 551k (2024-25, provisional) |
| of which entrants by uprating (see below) | 2.8k | none: HMRC counts only taxpayers with a liability |
| CGT taxpayers excluding entrants | 556k | HMRC Table 1: 382k (2023-24), 551k (2024-25) |
| Taxable gains | £129.4bn | HMRC Table 1: £66.6bn (2023-24), £119.3bn (2024-25) |
| Taxable gains excluding entrants | £129.4bn | HMRC Table 1: £66.6bn (2023-24), £119.3bn (2024-25) |
| Baseline CGT liability | £29.2bn | HMRC Table 1: £12.1bn (2023-24), £22.5bn (2024-25); OBR receipts £20.8bn (2026-27), £25.5bn (2027-28) |
| Residential property gains on their own schedule | £13.3bn | HMRC Table 8a (2024-25): £12.9bn including trusts, about £12.2bn for individuals; 205k taxpayers |
| Gains qualifying for Business Asset Disposal Relief (and Investors' Relief) | £20.3bn, 62k people | HMRC Table 4 (individuals, BADR and Investors' Relief): 42k people and £11.0bn (2023-24), 61k and £18.4bn (2024-25) |
| Share of gains from gains of £1m or more | 66% | HMRC Table 2: 61% (2023-24), 65% (2024-25) |
| Taxpayers with gains over £500k | 35.8k | HMRC Table 2: 19k (2023-24), 33k (2024-25) |
| Largest single gain | £561m | none: HMRC's top band is £5m and over (2k taxpayers, £23.6bn in 2023-24; 3k, £48.5bn in 2024-25) |
| Static yield (e = 0) | +£26.2bn | JRF (2026): about £13bn, static, equalisation alone (see [Benchmarks](#benchmarks)) |
| of which the relief withdrawn (static) | +£5.0bn | none |
| Uplift from equalising at 2019/20 rules (static) | +130% | CenTax (2024), Table 3: +139% on 2019/20 data |
| Yield, CenTax lower (retention 0.5) | +£17.7bn | none |
| **Yield, CenTax central (retention 1.0)** | **+£10.5bn** | none for equalisation alone; CenTax's £14.3bn (2025-26), £11.3bn (2026-27) and £19.7bn (2029-30) add an investment allowance and base broadening |
| of which the relief withdrawn (central) | +£2.8bn | none |
| Yield, CenTax upper (retention 2.0) | −£0.8bn | none |
| Yield, official HMRC/OBR elasticities (retention 3.6; 1.4 for gains qualifying for BADR) | −£9.6bn | none |
| Five-year total, 2026-27 to 2030-31 | +£56.8bn | none |
| Top income quintile, net income change | −5.3% (−£7,707/household) | none |
| Lowest income quintile, net income change | −0.07% (−£14) | none |

Benchmarks are outturns for the tax year stated (HMRC Capital Gains Tax
statistics, 2026 release, Tables 1, 2 and 8) or other institutions'
estimates of the same reform (described in [Benchmarks](#benchmarks)); only
the OBR receipts and JRF describe a projected year. The sensitivity rows are
changes in CGT revenue; the central row is the change in the government
balance. Uprating HMRC's 2024-25 gains to 2026 by the engine's 1.074 factor
gives £128.1bn, and the dataset excluding entrants lands 1% above it
(£129.4bn). Its relief-qualifying gains (£20.3bn, 61.7k people) sit about 2%
above HMRC's 2024-25 Table 4 figure uprated the same way (£19.8bn), and its
claimant count on the 61k HMRC reports.

Baseline CGT liability by year, against the OBR's March 2026 receipts path
(receipts lag the liability by about a year, so the 2027-28 receipts figure
is the closest published counterpart of the 2026-27 liability):

| | 2026-27 | 2027-28 | 2028-29 | 2029-30 | 2030-31 |
|---|---:|---:|---:|---:|---:|
| Baseline CGT liability | £29.2bn | £30.3bn | £31.4bn | £32.6bn | £33.8bn |
| OBR CGT receipts (EFO March 2026, Table 3.7) | £20.8bn | £25.5bn | £28.9bn | £32.0bn | £34.9bn |

Two features of the baseline matter before the reform is applied:

1. **Entrants by uprating.** The annual exempt amount is frozen at £3,000
   while the engine uprates gains with GDP per capita (×1.074 by 2026), so a
   person whose base-year gains sit just below £3,000 crosses the exempt
   amount in the projection and counts as a CGT taxpayer with a few hundred
   pounds of taxable gain. On this build that group is 2.8k people holding
   £0.009bn of gains and paying under £0.001bn of CGT, and the build itself
   fences it: microcosm's `uk_cgt_projection_entrants` gate (from
   microcosm#979) bounds the stock of crossers by 2030 (6.7k on this build,
   68.5k on the microcosm#979 build it replaced) by HMRC's count of
   taxpayers in the £3,000 to £5,999 band (73k in 2024-25). An earlier
   build, spine assessment v20, built every gainer beyond HMRC's taxpayer
   count with gains capped at exactly £3,000 (microcosm's `cgt_imputation`
   stage, approximation 4), so 10.8 million people entered in 2026 holding
   £35bn of nominal gains and paying £0.46bn; microcosm#970 replaced the cap
   with amounts drawn from the Advani-Summers within-band distribution below
   the exempt amount and anchored the clone incidence to the liable mass. The
   pipeline edits nothing and still reports the group
   (`validation.entrants_by_uprating`, `budget[].cgt_change_from_entrants_bn`)
   so it can be netted out.
2. **Vintage of the capital gains calibration.** The build redraws amounts
   from HMRC Table 3 for 2024-25 and calibrates to the 2024-25 provisional
   totals (551,000 taxpayers, £119.3bn of gains, £22.5bn of liability).
   2024-25 gains are 79% above 2023-24 because the rate rises announced in
   October 2024 brought disposals forward, and a base calibrated to that year
   and then uprated with GDP per capita carries the one-off into every
   projected year: the 2026-27 liability sits about 15% above the
   OBR-implied path. Issue #2's CGT-specific projection (work items 2-4) is
   where that timing effect belongs.

The dataset carries the top of the distribution that HMRC's 2024-25
size-of-gain bands imply (35.8k taxpayers with gains over £500k against
HMRC's 33k, a largest gain of £561m), and its regional pattern concentrates
the cost in London and the South East, where HMRC's Table 5 places the
taxpayers.

## Benchmarks

The dashboard's Benchmarks tab and the results file's `benchmarks` block
set this repo's figures beside published estimates of the same reform or
the same kind of rate change (issue #7). `comparison.py` holds every
external figure with its source, locator, scope, year and basis.

- **JRF (2026), static equalisation.** [Rebuilding living standards and
  economic security](https://www.jrf.org.uk/income-savings-and-debt/rebuilding-living-standards-and-economic-security)
  puts equalisation at about £13bn in 2026/27 and £17bn in 2029/30 (2026/27
  prices), applying HMRC's CGT statistics by income band to the OBR's March
  2026 receipts projection: an implied uplift of about 60% in 2026-27. This
  repo's static uplift is 90% (about a fifth of the static yield comes from
  withdrawing Business Asset Disposal Relief); applied to the same OBR
  receipts that is £18.7bn in 2026-27 and £27.1bn in 2029-30 (deflated with
  the OBR's CPI path).
- **CenTax (2024), rates only at 2019/20 rules.** CenTax's static uplift from
  equalising alone is +139% on 2019/20 data (Table 3). Applying the same
  rules to this repo's 2026-27 data (main rates 10/20, residential and
  carried interest 18/28, BADR at 10% with a £1m lifetime limit, an exempt
  amount of £12,000; `reform.centax_1920_reforms`) and equalising gives
  +130%. Investors' Relief, which CenTax's Table 3 also abolishes, shares the
  engine's BADR input and is withdrawn with it.
  By region (Table 8), this repo's shares of baseline CGT track CenTax's
  (London 27.5% against 27.0%, South East 21.6% against 21.6%). CenTax's
  uplift is lowest in London (+123%) and higher elsewhere (+137% to +163%);
  here London's is +135% and the other regions range from +111% (East
  Midlands) to +141% (Yorkshire and the Humber).
- **CenTax's package estimates** (Tables 5 and 6 of the 2024 report, the
  August 2025 technical note and "Taxes at the top", September 2026) add an
  investment allowance, the removal of the death uplift and a charge on
  departure, so they are listed as context, not compared.
- **HMRC's ready reckoner (June 2025).** Seven rows (higher rate +1, +5 and
  +10 points; lower rate +1 and +5 points; the Business Asset Disposal Relief
  rate +1 and +5 points) are scored through the rate explorer's code at the
  central and the official elasticity, comparing HMRC's receipts in 2027-28
  and 2028-29 with this repo's liabilities a year earlier. The official case
  applies 3.6 to main-rate gains and 1.4 to gains qualifying for the relief,
  in every row. For the relief at 19% HMRC shows +£135m
  and +£180m and this repo gives +£158m and +£161m at the official
  elasticity; at 23%, +£635m and +£840m against +£751m and +£767m. For +10
  points on the higher rate HMRC shows −£2,060m and −£3,565m; at the official
  elasticity this repo gives −£4,445m and −£4,616m, while at the central
  elasticity the change raises +£5,333m on 2026-27 liabilities. The relief
  rows move only claimants whose gains all qualify: every claimant with
  main-rate gains as well has already passed the £1m lifetime limit, so their
  next pound of qualifying gain is taxed at the main rates.
  Lower rate +10 points and the exempt-amount row are not scored (the block
  records why). HMRC deferred its 2026 edition on 6 July 2026 pending a
  review of key assumptions, so the rows are provisional.
- **The largest gains.** Until policyengine-uk 2.104.0 the engine measured
  each person's marginal rate on gains from a £1,000 rise in single
  precision. At gains in the hundreds of millions that misread the rate by up
  to about 3 points (PolicyEngine/policyengine-uk#1979). One £561m gain made
  the higher rate +1 point row read −£533m and −£173m in consecutive years at
  the official elasticity. The engine now steps by 0.1% of the gain above £1m
  and divides by the step it stored (PolicyEngine/policyengine-uk#1980). The
  row reads −£245m and −£253m, and the central estimate for equalisation rose
  by £0.2bn.
- **The official elasticity.** HMRC and the OBR use a retention-rate
  elasticity of 3.6 for the main rates ([OBR, January 2025](https://obr.uk/docs/dlm_uploads/CGT-supplementary-release-Jan-2025.pdf),
  para 1.9), and 1.4 for gains qualifying for BADR. Applied in that
  convention, equalisation changes 2026-27 CGT revenue by −£9.6bn, against
  +£10.5bn at the central case. Applying 3.6 to every gain instead would
  give −£12.6bn: the relief's own elasticity is worth £2.9bn here.

Left out by decision: the Office of Tax Simplification's 2020 static figure
(2018-19 rules) and a validation run of the Autumn Budget 2024 rate rise.

## Method

### The policyengine.py pathway

- `pe.uk.ensure_datasets(datasets=[<pinned hf:// URI>], years=[2026..2030])`
  materialises one per-year dataset file per simulated year. Before the
  wrapper builds anything the pipeline downloads the pinned source file and
  checks its sha256 against the registry in `simulations.py`.
- Simulations run on those files **unmodified**. All calibration and
  weighting belongs upstream in the dataset producer, not in an analysis
  repo, so this pipeline does no local reweighting and edits no inputs.
- Each (dataset, scenario, year) is one `policyengine.Simulation`, with
  deterministic ids so policyengine.py's output-dataset cache skips
  completed runs. Per-year files and cached outputs live in a folder keyed
  by the dataset digest and the projection fingerprint, and reform ids
  carry a digest of the reform definition, so a dataset, engine or reform
  change cannot reuse a stale output.
- Distributional outputs group the change in household net income by
  weighted baseline-income quintile and quartile, by household type and by
  region (the engine's `region` enum, present in every UK dataset).
  Aggregates are computed from the simulations' output datasets with
  **native microdf weighted operations** (`MicroSeries.sum/mean/median/count`,
  weighted `groupby`) — no manual weight arithmetic.

### Wrapper version (load-bearing)

policyengine.py 5.0.3 onwards certifies the UK bundle against one pinned
policyengine-uk (2.90.2 in 6.0.0) and refuses to import with any other
version installed. The asset-type CGT schedules need policyengine-uk 2.99.0
or later, so the pipeline pins the wrapper to the 4.x series (4.22.3 is the
last release). `pyproject.toml` carries the pins.

4.22.3 is only lenient when it cannot see the data-release manifest. With
`HUGGING_FACE_TOKEN` set it fetches the live manifest from Hugging Face on
first import, finds the bundled populace-uk-2023 data certified for
policyengine-uk 2.89.2 rather than the pinned release, and raises. Without the token the
manifest is unavailable and the wrapper falls back to its bundled
certification (basis `unverified_data_release_manifest_unavailable`) and
runs against the installed engine. Every committed result was produced that
way, so `simulations.import_wrapper` performs the first import with the
variable removed and restores it straight after (downloads read it at call
time); the basis is recorded in the explorer's `metadata.wrapper_certification`
and in the Modal Volume's `manifest.json`.

### Behavioural response (CenTax's elasticities, in CenTax's form)

Advani, Lonsdale & Summers (CenTax, October 2024, *Reforming Capital Gains
Tax*) estimate how realised gains respond to the **retention rate** (1 − t),
the share of a marginal pound of gain the taxpayer keeps: a central
medium-term elasticity of **1.0**, range 0.5–2.0, anchored on Agersnap &
Zidar (2021) and Lavecchia & Tazhitdinova (2024). The official HMRC/OBR
assumption is stated in the same convention: 3.6 for the main rates and 1.4
for BADR (OBR, January 2025, para 1.9). policyengine-uk's
`gov.simulation.capital_gains_responses.elasticity` applies an elasticity in
exactly that form, scaling each person's realised gains by
((1 − t₁)/(1 − t₀))^e, with t the person's marginal rate on gains (shared
across the main, residential and BADR schedules in proportion to the gains on
each). Every case sets that parameter and leaves `...mtr_elasticity` at zero;
the sensitivity runs cover 0 (static), CenTax's 0.5, 1.0, 1.5 (before its
adjustments, below) and 2.0, and the official 3.6. Every sensitivity row,
explorer option and explorer response records the engine parameter it set,
the convention (`applied_as`), the value applied and the elasticity gains
qualifying for the relief respond at (`reform.elasticity_convention`).

The official case applies both of the OBR's figures. Since policyengine-uk
2.104.0 (PolicyEngine/policyengine-uk#1980), gains qualifying for Business
Asset Disposal Relief can respond at their own elasticity
(`...separate_badr_elasticity` on, `...badr_elasticity` 1.4) while the rest of
a person's gains respond at the main 3.6. Both respond to the same change in
the person's share-weighted marginal rate, so only the elasticity differs.
Qualifying gains keep 1.4 under a reform that withdraws the relief. CenTax
state one elasticity for every gain, so their cases leave the switch off.

Until this change the pipeline converted CenTax's 1.0 into a
marginal-tax-rate elasticity of −0.7 (`e_mtr = −e_retention × t/(1 − t)` at
the reformed 40–45% rates) and applied it in the engine's MTR form,
(t₁/t₀)^e. The conversion holds only for small changes. Across this reform's
jumps −0.7 behaves like a retention elasticity of about 1.4 (24% to 45%), 1.5
(24% to 40%) and 3.0 (18% to 20%): for one taxpayer's gains moving from 24% to
45% it raised the tax on them by 21% where CenTax's convention gives 36%. The
central yield was correspondingly understated.

Caveat: CenTax's elasticity belongs to a package that also removes the uplift
at death and charges gains on departure, closing two ways of deferring or
avoiding the tax, which this repo does not model. CenTax expect a larger
response to a rate rise on the current base and advise against equalising
rates without the base reforms (*Taxes at the top*, September 2026, p.17);
the upper end of the range and the official case show how much of the yield
rests on the assumption.

### Income shifting: two approaches

When CGT rates rise towards income tax rates, some of the gains people stop
realising were income presented as gains, such as a company owner's pay
taken as a gain rather than as salary or dividends. With the rates equal it
comes back as income and is taxed as income. An elasticity measured on the
CGT base alone counts that money as lost, and the two sources treat it
differently:

- **CenTax net it into the elasticity.** They lower Agersnap & Zidar's
  five-year estimate of about 1.5 to a central 1.0 for two reasons: their
  package removes the uplift at death, which the US keeps, and equalisation
  brings shifted income back into income tax (Advani, Lonsdale & Summers 2024,
  pp. 35–36). They do not say how the 0.5 splits between the two, and they
  report total revenue across CGT and income tax without a split (p. 37).
  Their range is not adjusted: 2.0 is the US estimate for larger changes
  without controls, 0.5 approaches the Canadian estimate of no lasting
  response.
- **The OBR adds income tax back separately.** Its 3.6 covers every
  behaviour, income shifting included. Its costing of the October 2024 rise
  then treats 12.5% of the response to the narrowing gap between income tax
  and CGT rates as income no longer presented as gains (OBR, January 2025,
  p. 3 and Table 1.1). In that costing the income tax was £1.5bn of the
  £2.5bn raised in 2029-30, against £4.9bn of CGT lost to behaviour (Table
  1.3).

The results carry both approaches (`comparison.APPROACHES`), and the
dashboard's "Income shifting" switch chooses between them on every tab except
Baseline:

- **Gross of income shifting (CGT only).** Every gain not realised counts as
  lost revenue. Cases: static, CenTax's 0.5, CenTax's 1.5 before its
  adjustments (the central case), 2.0, and the official case (3.6; 1.4 for
  gains qualifying for the relief) with nothing added back.
  - *Assumptions:* 1.5 removes both of CenTax's adjustments, because CenTax
    don't say how much each accounts for. A rates-only reform keeps the
    uplift at death, so the second would not apply to it either. CenTax
    don't publish 1.5 as an estimate for any reform; it is their starting
    point.
  - *Caveats:* it understates total revenue by leaving out income tax that
    both sources count. HMRC's ready-reckoner figures include income tax
    effects, so that comparison is not like for like.
- **Net of income shifting (total revenue).** CenTax as published (0.5, 1.0
  central, 2.0), and the official case (3.6; 1.4 for gains qualifying for
  the relief) plus the income tax on shifted income
  (`impacts.income_shifting_offset`). That is 12.5% of the behavioural fall
  in realised gains, taxed at 45% (`reform.INCOME_SHIFTING_SHARE`,
  `INCOME_SHIFTING_TAX_RATE`). The ready-reckoner rows' official columns
  get the same addition.
  - *Assumptions:* the OBR doesn't say which income the shifted amount
    becomes or at what rate. 45% is the additional rate on earnings.
    Stacked on each person's other income, the rate on the shifted income
    averages 42.4% on the staged Microcosm build (2026-27, official
    case), so 45% overstates the addition by about 6%. Dividends at
    39.35% would give about an eighth less; salary with National Insurance
    (about 54% of the employer's cost) about a fifth more. Applied to the
    OBR's own costing (£4.9bn of CGT lost on gains taxed at 22–24%), the
    method gives about £1.2bn against the OBR's £1.5bn.
  - *Caveats:*
    - CenTax's 1.0 also includes their adjustment for the uplift at death,
      which a rates-only reform doesn't remove. By CenTax's reasoning the
      response to this reform is larger.
    - The addition applies to the whole response. That holds for
      equalisation, where the whole response comes from narrowing the gap,
      but not for explorer schedules with CGT above income tax rates.
    - The addition is in the revenue figures, not the distributional ones.
    - The engine doesn't model the shifted income itself; this repo adds it
      to the engine's results (PolicyEngine/policyengine-uk#1982).

Both approaches apply a medium-term response in full from 2026-27. The
explorer runs any case and reports `budget[].income_shifting_offset_bn`. The
dashboard adds it only to the official case under the approach net of income
shifting.

### Reforms via `Policy.simulation_modifier` (load-bearing)

policyengine.py applies a plain-dict reform as post-construction parameter
updates on an unreformed `policyengine_uk.Microsimulation` and never
registers the baseline branch, so the CGT behavioural elasticity is
**silently zero** through that path (verified: e=0 and a nonzero elasticity produce
identical revenue). The pipeline instead builds each reform as a
policyengine.py `Policy` whose first-class `simulation_modifier` hook
registers the baseline branch (`sim.branches["baseline"] = sim.baseline`,
whose clone keeps its own unreformed parameter tree) before applying the
same parameter updates. Each Simulation covers a single year, so the old
multi-year "restore the neutralised response variable" workaround is no
longer needed. The pipeline asserts that the static (e=0) and central
(retention e=1.0) runs differ before writing any results.

### Outputs

- `data/cgt_equalisation_results.json`, the file the dashboard bundles:
  metadata (wrapper and model versions, the dataset's pin, digest,
  producer and observation vintage, the reform including its schedule
  settings, the projection fingerprint, the entrant ceilings), an explicitly
  empty `calibration` block (no local reweighting), baseline validation vs
  HMRC/Advani including the entrants, the schedule components and the BADR
  claimants, budget
  impact by year with the entrants' contribution, distributional impacts,
  the elasticity sensitivity, the 2026-27 yield split by schedule
  (`schedule_split`: main rates, residential property, the relief withdrawn;
  static and central), and a `benchmarks` block (see
  [Benchmarks](#benchmarks)).
- `data/cgt_uprating_audit.json`: the projection audit below, with the
  per-year baseline block filled from the run.

### Projection of the gains base (issue #2)

Each published file is a single engine year (`time_period` 2024, the FRS
2024-25 observation). `pe.uk.ensure_datasets` hands it to the engine, which
copies the year forward to 2030 and uprates it year on year from the
engine's `data/uprating_indices.yaml`: `capital_gains`,
`capital_gains_before_response` and the schedule components follow OBR GDP
per capita, `household_weight` follows ONS population growth. Nothing
CGT-specific enters the projection.

`uk_cgt_reform.uprating_audit` records what is actually applied,
reading the installed engine's index map and growth parameters:

| | 2026 | 2027 | 2028 | 2029 | 2030 | source |
|---|---:|---:|---:|---:|---:|---|
| gains (GDP per capita) | 1.074 | 1.109 | 1.143 | 1.177 | 1.214 | OBR EFO March 2026, Table A.1 |
| weights (population) | 1.011 | 1.015 | 1.019 | 1.023 | 1.028 | OBR long-term economic determinants, March 2025 EFO (ONS 2022-based projections); see below |
| CPI (sensitivity, not applied) | 1.058 | 1.079 | 1.100 | 1.123 | 1.145 | OBR EFO March 2026, Table A.1 |

Cumulative factors from the 2024 base on policyengine-uk 2.104.0; the
committed `data/cgt_uprating_audit.json` carries the year-on-year rates,
the parameter references, the OBR March 2026 CGT receipts path (unbridged:
receipts are not gains and lag them), the entrant ceilings (the base-year
exempt amount carried forward by the gains factor) and the per-year
baseline gains, taxpayer counts, liability and entrants.
`uk-cgt-reform-build --audit-only` rewrites the factor table and carries
the measured baselines forward when the projection fingerprint is unchanged.

The engine's population series names only "ONS Population Projections" with
an unversioned link, so the audit records a reviewed vintage beside it: the
values were set by policyengine-uk PR #1305 (commit `b9efbaf8`) from the OBR's
*Long-term economic determinants - March 2025 Economic and fiscal outlook*
(published 19 June 2025), which adopt the ONS 2022-based national population
projections; the March 2026 EFO refresh left the series unchanged. The audit
stores those rates as the values of record and reports whether the installed
engine still matches them (`reviewed_vintage.engine_matches_values_of_record`),
so an engine bump that moves the population path shows up in the audit rather
than silently in the weights.

The projection is fingerprinted into the results metadata
(`metadata.projection`) and into every simulation id, so a change in the
engine's uprating cannot reuse cached simulation outputs.

## Rate explorer

The dashboard's **Rate explorer** tab scores any schedule of CGT rates
(basic / higher / additional, applied to the main schedule and to the
residential property schedule) with Business Asset Disposal Relief kept, at a
whole-point rate no higher than the additional rate and a lifetime limit of
£500k, £1m or £10m, or withdrawn, on the dataset for 2026-27 to
2030-31, through the pipeline's own code path: the pinned per-year
datasets, the cached baseline simulations, the `Policy.simulation_modifier`
reform with the behavioural response, and `impacts.budget_impact` /
`impacts.income_change_groups`. Nothing is precomputed or interpolated: an
explorer run at 20/40/45 with the relief withdrawn builds the equalisation
reform's own dict (same fingerprint) and reproduces the committed results,
and 18/24/24 with the relief at current law gives zero change.

Scope (`reform.EXPLORER_SCOPE`, `reform.cgt_rate_reform`, `reform.BadrPolicy`):
main and residential rates and the relief. Carried interest has been taxed as
income since April 2026 and stays outside. HMRC's ready-reckoner rows run
with the relief at current law, except the two relief rows, which raise its
rate.

### Locally

```bash
uk-cgt-reform-explore --basic 0.18 --higher 0.30 --additional 0.30
uk-cgt-reform-explore --basic 0.20 --higher 0.40 --additional 0.45 --withdraw-badr --json   # the equalisation reform, full result on stdout
uk-cgt-reform-explore --basic 0.20 --higher 0.40 --additional 0.45 --badr-rate 0.24   # the relief kept at 24%
uk-cgt-reform-explore --options > dashboard/public/data/explore_options.json   # bounds, presets, ready-reckoner rows
```

Rates are fractions in whole percentage points (0.30, not 0.305), ordered
basic ≤ higher ≤ additional: the additional rate exists only so a reform can
charge more above £125,140 of income and gains.
Runs use `data/policyengine_datasets` (run the pipeline once first so the
per-year files and baselines exist) and never write a simulation output
file: reform simulations run in memory. Measured on an M5 Pro: about 40 s
for the five years of one dataset (9–11 s for the first year, which includes
one-off loading, then 6–8 s per year).

### Result cache (every run)

Every completed run is written to `data/explore_results/<key>.json`
(gitignored) and, on Modal, to the Volume's `explore_results/` and a
`modal.Dict` in front of it. The key is
`<dataset key>__<dataset digest>__<projection fingerprint>__<policyengine-uk version>__<policyengine version>__<policyengine-core version>__<code fingerprint>__<reform fingerprint>`;
the reform fingerprint digests the rates, the relief and the elasticity, and the code
fingerprint digests this package's result-shaping modules (`reform`,
`impacts`, `explore`, `simulations`, `pipeline`, `uprating_audit`), so a
code change cannot serve a stale result. Redeploy the workers and the
gateway together after a code change: each keys on the source it carries. A later
request for the same schedule on the same inputs is served from the store
(1.4 s locally, at once on Modal without starting a worker); a new engine,
projection or dataset never hits. Responses carry `metadata.cache`
(`hit`, `key`, `computed_at`). To force a recomputation delete the file
(and, on Modal, the Dict entry); `--no-cache` recomputes locally.

### Dashboard wiring

`dashboard/app/api/explore/route.js` (`POST`) and
`dashboard/app/api/explore/status/route.js` (`GET`) are the tab's only
endpoints. With `CGT_EXPLORER_URL` set they forward to the Modal gateway with
the proxy-auth headers from `CGT_EXPLORER_MODAL_KEY` /
`CGT_EXPLORER_MODAL_SECRET` (server-only variables). Without it, off Vercel,
the `POST` route runs the CLI above through the repo's `.venv` (set `PYTHON`
to use another interpreter). On Vercel without a backend the tab reports that
the backend is not configured. The controls read
`dashboard/public/data/explore_options.json`, written by
`uk-cgt-reform-explore --options`; regenerate it when the presets,
bounds, elasticity options or ready-reckoner rows change. The tab's "HMRC
ready-reckoner row" menu loads those rows, and a run that matches one shows
HMRC's figures beside it.

### Modal backend

`backend/` holds three Modal apps sharing one image
(`backend/requirements.txt` pins the runtime; the pipeline package is added
from `src/`), one Volume (`uk-cgt-reform-data`, laid out like `data/`)
and one Dict (`uk-cgt-reform-results`):

| File | App | Role |
|---|---|---|
| `backend/workers.py` | `uk-cgt-reform-workers` | `run_year` scores one (dataset, year) per container (4 CPU, 16 GiB, scales to zero); `run_reform` fans the five years out in parallel, assembles the result and writes both cache layers |
| `backend/warm.py` | `uk-cgt-reform-warm` | one-off `modal run`: sha256-verified download, per-year datasets, baseline outputs, `manifest.json` (versions, projection fingerprint, exempt amounts, ceilings, baseline rates) |
| `backend/modal_app.py` | `uk-cgt-reform` | gateway: `GET /metadata`; `POST /submit` (a cached schedule is returned at once, otherwise a job is spawned); `GET /status/{job}`; proxy authentication required |

Abuse guards, because every visitor can start workers through the
dashboard's route: custom rates are whole percentage points ordered basic ≤
higher ≤ additional (about 76,000 schedules per dataset and elasticity);
the gateway joins a request to a job already computing the same schedule,
answers 429 when `MAX_IN_FLIGHT` (3) uncached schedules are computing, and
starts at most `DAILY_COMPUTE_BUDGET` (250) new schedules per UTC day (a
count in the `uk-cgt-reform-usage` Dict, about $25 of compute; cached
schedules are always served);
the workers cap at 10 year-containers and 5 orchestrators; the Next route
applies a best-effort per-address limit (20 submissions per 10 minutes per
instance). Two guards live outside this repo: the Vercel Firewall rule "Rate explorer
submissions" (project `uk-cgt-reform`, custom rule: `POST
/uk/cgt-reform/api/explore`, at most 10 requests per 60 s per address,
deny beyond that, which the edge answers with 403; after any change to the
rule or the path, a burst of twelve requests should see the last two
refused), and a spend cap on the Modal
workspace (Settings, Usage limits), which only a workspace admin can set;
the daily budget above is the cap that needs no such access. Manage the rule with `bunx vercel firewall rules list --scope
policy-engine` from `dashboard/`.

Deploy, from the PolicyEngine Modal workspace (`modal` is not a project
dependency; `uv pip install modal` into the venv):

```bash
unset MODAL_TOKEN_ID MODAL_TOKEN_SECRET                    # a stale token deploys to the wrong workspace
modal secret create huggingface HUGGING_FACE_TOKEN="$HF_TOKEN"   # once; use whichever variable your shell exports the token in
modal deploy backend/workers.py
modal run backend/warm.py                                  # the dataset; a few minutes
modal deploy backend/modal_app.py                          # prints the gateway URL
```

After any change under `src/`, deploy `backend/workers.py` and
`backend/modal_app.py` again from the same checkout, one after the other:
each keys the cache on the copy of the source it carries, and a gateway on a
different fingerprint from the workers never finds what they store, so
every request would spawn. Re-run `backend/warm.py` too when the projection
fingerprint or a manifest field changes (`run_year` and the gateway say so).

Create a proxy token for the gateway and, because the PolicyEngine workspace
scopes proxy tokens to environments, allow it into the environment the apps
were deployed to (a scoped token with no environment answers 401 "invalid
credentials for proxy authorization"):

```bash
.venv/bin/modal workspace proxy-tokens create          # prints wk-… and ws-… once
.venv/bin/modal workspace proxy-tokens allow wk-… main
```

Set `CGT_EXPLORER_URL` (the gateway URL the deploy printed),
`CGT_EXPLORER_MODAL_KEY` and `CGT_EXPLORER_MODAL_SECRET` as server-only
Vercel variables, and in `dashboard/.env.local` (gitignored) for a local dev
server that should use the backend.

#### Preview backend for a branch

The production gateway knows only production's dataset and request fields,
so a branch that changes them (a new dataset, engine or request field) cannot
use it from its Vercel preview. Deploy the branch as the preview stage
instead. `CGT_EXPLORER_STAGE=preview` adds `-preview` to every app, Volume
and Dict name (`backend/common.py`), so the preview shares no data, cache or
daily budget with production:

```bash
export CGT_EXPLORER_STAGE=preview
modal deploy backend/workers.py
modal run backend/warm.py
modal deploy backend/modal_app.py   # https://policyengine--uk-cgt-reform-preview-fastapi-app.modal.run
```

The production proxy token works unchanged, because the workspace scopes
proxy tokens to the Modal environment, not to an app. To point that branch's
previews at the preview gateway, add `CGT_EXPLORER_URL` as a Preview variable
scoped to the branch; production and other branches keep the production
gateway, and the gateway's `GET /metadata` reports which stage answered.
After the branch merges:
1. Redeploy production from main with the variable unset, re-warming if the
   projection or the manifest changed.
2. Remove the branch variable.
3. Stop the preview apps (`modal app stop uk-cgt-reform-preview -y`, and the
   same for `uk-cgt-reform-workers-preview`).

Measured on 2026-09-23 through the dashboard's route (Modal `main`, workers
at 4 CPU / 16 GiB, the five years in parallel containers): a schedule
nobody has run took 53 s wall from a cold start and 32 s with warm workers
(each year's container spent 21–29 s simulating); a repeat of the same
schedule returned in 0.5 s from the Dict, and still did after the Dict was
cleared, from the Volume copy. Modal and local CLI results agree to within
5e-7 relative (float differences between platforms). Re-run
`backend/warm.py` after any engine, wrapper or dataset change (`run_year`
refuses to score when the Volume's projection fingerprint differs from the
installed engine's) and after deploying code that adds a manifest field (the
gateway answers 503 naming the re-warm until then).

Qualification after a deploy: `GET /metadata` returns the pinned digests; one
genuine run matches the local CLI on the same tuple; the same schedule
submitted again comes back from `/submit` as `status: "done"` without a job
id, and still does after the Dict entry is deleted (the Volume copy). Before
the tab goes public: a workspace admin has set the Modal spend cap (the
Firewall rule and the daily budget are already in place). A failed job reports only its exception type; the detail
is in the Modal logs for `uk-cgt-reform-workers`.

## Run

```bash
pip install -e ".[simulation,dev]"
uk-cgt-reform-build                       # the results and the uprating audit
uk-cgt-reform-build --audit-only          # the projection audit alone
```

Requires a Hugging Face token with access to PolicyEngine's private repos,
exported as `HF_TOKEN` (the variable `huggingface_hub` reads for the pinned
downloads). Do not also export `HUGGING_FACE_TOKEN` while running on the pinned
engine: policyengine.py 4.22.3 uses that variable to fetch the data package's
current release manifest at import, and since 23 September 2026 that manifest
certifies only newer policyengine-uk releases, so the import refuses the pinned
engine.
Without it the wrapper records its bundled default dataset as
`unverified_data_release_manifest_unavailable`, which does not touch these
runs: the dataset is pinned explicitly by revision and digest.
`pyproject.toml` pins policyengine-uk 2.104.0, the first release with the
precise marginal rate on large gains and the separate BADR elasticity
(PolicyEngine/policyengine-uk#1980). The dataset was built with 2.100.0, the
first release whose local-authority enum carries the April 2023 unitary
authorities it records. Each release can move the projection fingerprint, so
changing the pin is a deliberate re-pin that regenerates the results. A run needs the per-year builds, twenty-four stored simulations (baseline,
central and static reform for every year, three more sensitivity cases, the
CenTax counterfactual pair and four schedule-split steps) and twenty-eight
in-memory ready-reckoner runs; a run with the stored outputs in place spends
most of its time on the ready-reckoner runs. Copy
`data/cgt_equalisation_results.json` into `dashboard/public/data/` for the
dashboard, which bundles it at build time, and regenerate
`explore_options.json` with `uk-cgt-reform-explore --options` when the
explorer's options change.

```bash
pytest        # pure-logic tests only, no simulation (pipeline and rate explorer)
ruff check .
```
