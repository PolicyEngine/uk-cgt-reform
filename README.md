# Equalising capital gains tax with income tax (the "Burnham" reform)

Data pipeline estimating the budgetary and distributional impact of
**equalising UK CGT rates with income tax rates** — the reform debated in the
Labour leadership contest, associated with Andy Burnham and backed by allies
including Louise Haigh and Wes Streeting — using the standard
[policyengine.py](https://github.com/PolicyEngine/policyengine.py) stack
(the `policyengine` package wrapping the PolicyEngine UK model).

The pipeline runs the same reform on two registered datasets, each used
exactly as published with no local reweighting, and writes the results side
by side:

| Key | Role | Dataset | Pinned input |
|---|---|---|---|
| `enhanced_frs_2024_25` | incumbent | Enhanced FRS 2024-25, [policyengine-uk-data](https://github.com/PolicyEngine/policyengine-uk-data) 1.57.3 | `hf://policyengine/policyengine-uk-data/enhanced_frs_2024_25.h5@1.57.3`, sha256 `ef34c1ae…` |
| `microcosm_uk_2024_25_979` | candidate | Microcosm UK 2024-25, the national line built by [microcosm](https://github.com/PolicyEngine/microcosm)'s consolidated build path on main plus [microcosm#979](https://github.com/PolicyEngine/microcosm/pull/979) (`staged/uk-frs-calibration-attempt-20260923T134002Z-c1be1c9f`, a staging candidate whose seven calibration-seam gates passed, not a certified release; it supersedes the v20 spine assessment, whose sub-exempt gainers sat at exactly £3,000) | `hf://policyengine/populace-uk-private/staged/uk-frs-calibration-attempt-20260923T134002Z-c1be1c9f/microcosm_uk_2024_25.h5@f6df65b1…`, sha256 `c5f107ab…` |

The candidate carries the capital gains asset-type breakdown
(`capital_gains_residential_property`) that policyengine-uk 2.99.0 charges on
its own schedule. The dashboard shows the candidate first and lets the reader
switch to the incumbent; its Dataset comparison tab lays both out together.
The candidate is the default because it is the dataset this comparison exists
to evaluate and the only one carrying the schedules the reform charges; the
21 September hesitation (the sub-exempt entrants artefact) was removed
upstream by [microcosm#970](https://github.com/PolicyEngine/microcosm/issues/970).
The candidate is re-pinned when
[microcosm#979](https://github.com/PolicyEngine/microcosm/pull/979) lands on
main, replacing this PR-head build with one from main, and again when a
certified national release exists; the production default is confirmed when
this branch merges.

**Note on decile impacts vs revenue:** household net-income losses in the decile
tables include both the extra tax paid and the gains taxpayers choose not to
realise under the behavioural response, so they are roughly an order of
magnitude larger than the net revenue raised. This is a mechanical property of
modelling the response as a reduction in realised gains, not a bug.

## Reform (from 2026-27)

| Band | Baseline CGT rate | Reformed rate (= income tax) |
|---|---|---|
| Basic | 18% | **20%** |
| Higher | 24% | **40%** |
| Additional | 24% | **45%** |

Annual exempt amount unchanged at £3,000. Fiscal years 2026-27 through
2030-31.

policyengine-uk 2.99.0 charges residential property gains, carried interest
and gains qualifying for Business Asset Disposal Relief on their own
schedules when a dataset records them, and a reform that touches only the
three main rates no longer reaches them. Equalising CGT with income tax means
every gain, whatever the asset, so the reform also sets the residential
property and carried interest schedules to 20/40/45% and withdraws the BADR
lifetime limit (relief gains fall to the main schedule), the recipe the
engine's changelog gives for taxing every gain at income tax rates. Neither
dataset records BADR or carried interest gains and the incumbent records no
residential property gains, so on the incumbent these parameters are inert
and its results are unchanged by them.

## Results side by side (2026-27 unless stated)

Same engine (policyengine-uk 2.99.1), wrapper (policyengine.py 4.22.3),
projection (fingerprint `1b0cd0dff144`) and reform on each dataset.

| | Enhanced FRS 2024-25 (incumbent) | Microcosm UK #979 (candidate) | External benchmark |
|---|---:|---:|---|
| CGT taxpayers (gains above the exempt amount) | 597k | 578k | HMRC Table 1: 382k (2023-24), 551k (2024-25, provisional) |
| of which entrants by uprating (see below) | 12k | 22.6k | none: HMRC counts only taxpayers with a liability |
| CGT taxpayers excluding entrants | 586k | 556k | HMRC Table 1: 382k (2023-24), 551k (2024-25) |
| Taxable gains | £57.9bn | £127.9bn | HMRC Table 1: £66.6bn (2023-24), £119.3bn (2024-25) |
| Taxable gains excluding entrants | £57.8bn | £127.8bn | HMRC Table 1: £66.6bn (2023-24), £119.3bn (2024-25) |
| Baseline CGT liability | £13.2bn | £30.0bn | HMRC Table 1: £12.1bn (2023-24), £22.5bn (2024-25); OBR receipts £20.8bn (2026-27), £25.5bn (2027-28) |
| Residential property gains on their own schedule | none recorded | £13.4bn | HMRC Table 8a (2024-25): £12.9bn including trusts, about £12.2bn for individuals; 205k taxpayers |
| Share of gains from gains of £1m or more | 67% | 67% | HMRC Table 2: 61% (2023-24), 65% (2024-25) |
| Taxpayers with gains over £500k | 17.9k | 35.5k | HMRC Table 2: 19k (2023-24), 33k (2024-25) |
| Largest single gain | £12.2m | £185m | none: HMRC's top band is £5m and over (2k taxpayers, £23.6bn in 2023-24; 3k, £48.5bn in 2024-25) |
| Static yield (e = 0) | +£10.7bn | +£24.7bn | Advani & Summers (2020), static, GDP-uprated: £16.7bn |
| Yield, CenTax lower (e = −0.35) | +£5.9bn | +£13.8bn | none |
| **Yield, central (e = −0.7)** | **+£2.2bn** | **+£5.1bn** | CenTax (2024): £14.0bn central, £9.7bn worst case, both with base broadening; HMRC ready reckoner: −£2bn by year 3 for +10pp on the higher rates alone |
| Five-year total, 2026-27 to 2030-31 | +£11.7bn | +£27.7bn | none |
| Top income quintile, net income change | −2.8% (−£3,328/household) | −6.0% (−£8,269/household) | none |
| Lowest income quintile, net income change | −0.04% (−£7) | −0.01% (−£2) | none |

Benchmarks are outturns for the tax year stated (HMRC Capital Gains Tax
statistics, 2026 release, Tables 1, 2 and 8) or other institutions'
estimates of a similar reform; only the OBR receipts describe a projected
year. HMRC's 2026 release revised 2023-24 to 382,000 taxpayers and £66.6bn
of gains; the incumbent's calibration targets came from the 2025 release
(378,000 and £65.9bn). Uprating each dataset's own HMRC vintage to 2026 by
the engine's 1.074 factor gives £71.5bn on the 2023-24 basis and £128.1bn on
the 2024-25 basis: the candidate excluding entrants lands on its figure
(£127.8bn), the incumbent falls 19% short of its (£57.9bn).

Baseline CGT liability by year, against the OBR's March 2026 receipts path
(receipts lag the liability by about a year, so the 2027-28 receipts figure
is the closest published counterpart of the 2026-27 liability):

| | 2026-27 | 2027-28 | 2028-29 | 2029-30 | 2030-31 |
|---|---:|---:|---:|---:|---:|
| Incumbent baseline CGT liability | £13.2bn | £13.7bn | £14.2bn | £14.7bn | £15.2bn |
| Candidate baseline CGT liability | £30.0bn | £31.1bn | £32.2bn | £33.4bn | £34.6bn |
| OBR CGT receipts (EFO March 2026, Table 3.7) | £20.8bn | £25.5bn | £28.9bn | £32.0bn | £34.9bn |

Two things separate the datasets before the reform is applied:

1. **Entrants by uprating.** The annual exempt amount is frozen at £3,000
   while the engine uprates gains with GDP per capita (×1.074 by 2026), so a
   person whose base-year gains sit just below £3,000 crosses the exempt
   amount in the projection and counts as a CGT taxpayer with a few hundred
   pounds of taxable gain. On the current candidate that group is 22.6k
   people holding £0.07bn of gains and paying £0.001bn of CGT, and the
   candidate's own build fences it: microcosm#979's `uk_cgt_projection_entrants`
   gate bounds the stock of crossers by 2030 (68.5k on this build) by HMRC's
   count of taxpayers in the £3,000 to £5,999 band (73k in 2024-25). The
   previous candidate, spine assessment v20, built every gainer beyond HMRC's
   taxpayer count with gains capped at exactly £3,000 (microcosm's
   `cgt_imputation` stage, approximation 4), so 10.8 million people entered
   in 2026 holding £35bn of nominal gains and paying £0.46bn, and every count
   in its results was dominated by the group; microcosm#970 replaced the cap
   with amounts drawn from the Advani-Summers within-band distribution below
   the exempt amount and anchored the clone incidence to the liable mass. The
   pipeline edits nothing and still reports the group
   (`validation.entrants_by_uprating`, `budget[].cgt_change_from_entrants_bn`)
   so it can be netted out; PR #3's 21 September comment records the v20
   results for comparison.
2. **Vintage of the capital gains calibration.** The incumbent calibrates
   its gains to HMRC's 2023-24 statistics as published in 2025 (378,000
   taxpayers, £65.9bn of gains; since revised to 382,000 and £66.6bn); the
   candidate redraws amounts from HMRC Table 3 for 2024-25 and calibrates to
   the 2024-25 provisional totals (551,000 taxpayers, £119.3bn of gains,
   £22.5bn of liability). 2024-25 gains are 79% above 2023-24
   because the rate rises announced in October 2024 brought disposals
   forward, and a base calibrated to that year and then uprated with GDP per
   capita carries the one-off into every projected year: the candidate's
   2026-27 liability sits about a fifth above the OBR-implied path, the
   incumbent's about half below it. Issue #2's CGT-specific projection (work
   items 2-4) is where that timing effect belongs.

The candidate carries more of the top of the distribution (35.5k taxpayers
with gains over £500k against 17.9k, a largest gain of £185m against
£12.2m), as its calibration to HMRC's 2024-25 size-of-gain bands implies;
its regional pattern concentrates the cost in London and the South East,
where HMRC's Table 5 places the taxpayers, while the incumbent's regional
averages are noisier (Wales carries its largest average loss).

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
last release), which warns on the mismatch but runs against the installed
engine. `pyproject.toml` carries the pins.

### Behavioural response (aligned with Arun Advani / CenTax)

Advani, Lonsdale & Summers (CenTax, Oct 2024, *Reforming Capital Gains Tax*)
use a central medium-term elasticity of **1.0 with respect to the retention
rate (1 − t)**, range 0.5–2.0. This pipeline reports the marginal-tax-rate
convention: converting (`e_mtr = e_retention × t / (1 − t)`) gives ≈ −0.67 to
−0.82 at the reformed 40–45% top rates, and we use **−0.7** as the central
case (also PolicyEngine's Autumn Budget 2024 value). Sensitivity runs cover
0.0 / −0.35 / −0.7. Caveat: Advani's elasticity assumes accompanying base
broadening we do not model, so behavioural loss may be understated for a
rate-only reform.

policyengine-uk now carries both conventions:
`gov.simulation.capital_gains_responses.elasticity` is the retention-rate
elasticity (positive) and, since 2.98.0, `...mtr_elasticity` the
marginal-tax-rate elasticity (negative); they may not both be set. The
pipeline sets `mtr_elasticity` and leaves `elasticity` at zero. Setting −0.7
on the retention parameter, as this repo did before the engine's change,
raises realisations instead of lowering them (static +£10.7bn, "−0.7"
+£16.7bn on the incumbent); the pipeline's assertion that the static and
central runs differ in the right direction is what caught it.

### Reforms via `Policy.simulation_modifier` (load-bearing)

policyengine.py applies a plain-dict reform as post-construction parameter
updates on an unreformed `policyengine_uk.Microsimulation` and never
registers the baseline branch, so the CGT behavioural elasticity is
**silently zero** through that path (verified: e=0 and e=−0.7 produce
identical revenue). The pipeline instead builds each reform as a
policyengine.py `Policy` whose first-class `simulation_modifier` hook
registers the baseline branch (`sim.branches["baseline"] = sim.baseline`,
whose clone keeps its own unreformed parameter tree) before applying the
same parameter updates. Each Simulation covers a single year, so the old
multi-year "restore the neutralised response variable" workaround is no
longer needed. The pipeline asserts that the static (e=0) and central
(e=−0.7) runs differ before writing any results.

### Outputs

- `data/cgt_equalisation_results_<dataset>.json`, one per registered
  dataset: metadata (wrapper and model versions, the dataset's pin, digest,
  producer and observation vintage, the reform including its schedule
  settings, the projection fingerprint, the entrant ceilings), an explicitly
  empty `calibration` block (no local reweighting), baseline validation vs
  HMRC/Advani including the entrants and the schedule components, budget
  impact by year with the entrants' contribution, distributional impacts,
  the elasticity sensitivity, and a comparison with CenTax (£14.0bn central
  / £9.7bn worst-case), Advani & Summers 2020 static (£16.7bn), the HMRC
  ready reckoner (−£2bn) and the OBR baseline (£21.8bn in 2025-26, EFO March
  2026).
- `data/cgt_equalisation_results.json`: the dashboard's primary file, the
  default dataset's results (the candidate).
- `data/dataset_comparison.json`: every dataset's validation, budget,
  sensitivity and first-year distributional rows keyed by dataset, for the
  dashboard's Dataset comparison tab.
- `data/cgt_uprating_audit.json`: the projection audit below, with the
  per-year baseline block filled per dataset.

### Projection of the gains base (issue #2)

Each published file is a single engine year (`time_period` 2024, the FRS
2024-25 observation). `pe.uk.ensure_datasets` hands it to the engine, which
copies the year forward to 2030 and uprates it year on year from the
engine's `data/uprating_indices.yaml`: `capital_gains`,
`capital_gains_before_response` and the schedule components follow OBR GDP
per capita, `household_weight` follows ONS population growth. Nothing
CGT-specific enters the projection.

`uk_equalising_cgt.uprating_audit` records what is actually applied,
reading the installed engine's index map and growth parameters:

| | 2026 | 2027 | 2028 | 2029 | 2030 | source |
|---|---:|---:|---:|---:|---:|---|
| gains (GDP per capita) | 1.074 | 1.109 | 1.143 | 1.177 | 1.214 | OBR EFO March 2026, Table A.1 |
| weights (population) | 1.011 | 1.015 | 1.019 | 1.023 | 1.028 | OBR long-term economic determinants, March 2025 EFO (ONS 2022-based projections); see below |
| CPI (sensitivity, not applied) | 1.058 | 1.079 | 1.100 | 1.123 | 1.145 | OBR EFO March 2026, Table A.1 |

Cumulative factors from the 2024 base on policyengine-uk 2.99.1; the
committed `data/cgt_uprating_audit.json` carries the year-on-year rates,
the parameter references, the OBR March 2026 CGT receipts path (unbridged:
receipts are not gains and lag them), the entrant ceilings (the base-year
exempt amount carried forward by the gains factor) and, per dataset, the
per-year baseline gains, taxpayer counts, liability and entrants.
`uk-equalising-cgt-build --audit-only` rewrites the factor table and carries
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

## Run

```bash
pip install -e ".[simulation,dev]"
uk-equalising-cgt-build                       # every registered dataset
uk-equalising-cgt-build --dataset microcosm_uk_2024_25_979   # one dataset
uk-equalising-cgt-build --audit-only          # the projection audit alone
```

Requires a Hugging Face token with access to PolicyEngine's private repos,
exported as `HF_TOKEN` (the variable `huggingface_hub` reads for the pinned
downloads). Do not also export `HUGGING_FACE_TOKEN` while running on the pinned
engine: policyengine.py 4.22.3 uses that variable to fetch the data package's
current release manifest at import, and since 23 September 2026 that manifest
certifies only newer policyengine-uk releases, so the import refuses 2.99.1.
Without it the wrapper records its bundled default dataset as
`unverified_data_release_manifest_unavailable`, which does not touch these
runs: every dataset here is pinned explicitly by revision and digest.
`pyproject.toml` bounds policyengine-uk below 2.100 because 2.100.x moves the
projection fingerprint; raising the bound is a deliberate re-pin that
regenerates every results file. A full
run takes about ten minutes for both datasets
(per-year dataset builds plus thirteen scored simulations each; re-runs
reuse policyengine.py's output cache). Copy the four results files from
`data/` into `dashboard/public/data/` for the dashboard, which bundles
them at build time.

```bash
pytest        # pure-logic tests only, no simulation
ruff check .
```
