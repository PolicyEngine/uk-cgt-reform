# UK capital gains tax reform

Data pipeline and dashboard estimating the budgetary and distributional
impact of reforms to UK capital gains tax rates from 2026-27, using the
standard [policyengine.py](https://github.com/PolicyEngine/policyengine.py)
stack (the `policyengine` package wrapping the PolicyEngine UK model). They
score two things:

- **Equalising CGT rates with income tax rates** (the "Burnham" reform), the
  reform debated in the Labour leadership contest, associated with Andy
  Burnham and backed by allies including Louise Haigh and Wes Streeting. The
  pipeline scores it and commits the results, which the dashboard's Reform
  impacts tab shows.
- **Any schedule of main CGT rates** a reader chooses, scored live by the
  dashboard's Rate explorer tab through the same code, dataset, engine and
  projection (see [Rate explorer](#rate-explorer)).

The repository was called `uk-equalising-cgt` until the rate explorer took
its scope beyond equalisation; GitHub redirects the old URL, and the
dashboard redirects its former path `/uk/equalising-cgt` (and the bare
deployment domain) to `/uk/cgt-reform`, query string included.

The pipeline runs the equalisation reform on one registered dataset, used
exactly as published with no local reweighting:

- **Key:** `microcosm_uk_2024_25`.
- **Dataset:** Microcosm UK 2024-25, the national release
  `microcosm-uk-2024-25-national` built by
  [microcosm](https://github.com/PolicyEngine/microcosm) and published on
  4 October 2026 (cut `microcosm-uk-2024-25-national-20261002T230158Z-5c6b3f68`,
  build `uk-frs-calibration-attempt-20261002T230158Z-5c6b3f68` on microcosm
  `64c460b6`, from [microcosm#1089](https://github.com/PolicyEngine/microcosm/pull/1089),
  with policyengine-uk 2.100.0). It is a certified release: its 31 spine, 7
  calibration-seam and 20 release-cut gates passed.
- **Pinned input:** `hf://policyengine/populace-uk-private/microcosm_uk_2024_25.h5@0d633297…`,
  the file on the dataset repo's main branch at the commit that published it,
  sha256 `aa31bdf6…`. The release's immutable cut holds the same file.

The dataset carries the capital gains asset-type and relief breakdown that
policyengine-uk 2.99.0 charges on separate schedules: residential property
gains (`capital_gains_residential_property`) and gains qualifying for
Business Asset Disposal Relief or Investors' Relief (`capital_gains_badr`).
It records no carried interest. It replaces the two datasets the dashboard
ran on before (the Enhanced FRS 2024-25 from policyengine-uk-data 1.57.3 and
the staged Microcosm UK build on
[microcosm#979](https://github.com/PolicyEngine/microcosm/pull/979)), and the
dashboard's Dataset comparison tab goes with them.

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

policyengine-uk 2.99.0 charges residential property gains, carried interest
and gains qualifying for Business Asset Disposal Relief on their own
schedules when a dataset records them, and a reform that touches only the
three main rates no longer reaches them. Equalising CGT with income tax means
every gain, whatever the asset, so the reform also sets the residential
property and carried interest schedules to 20/40/45% and withdraws the BADR
lifetime limit (relief gains fall to the main schedule), the recipe the
engine's changelog gives for taxing every gain at income tax rates. The
dataset records residential property and relief gains but no carried
interest, so only the carried-interest setting is inert here.

## Results (2026-27 unless stated)

Engine policyengine-uk 2.104.0, wrapper policyengine.py 4.22.3, projection
fingerprint `e76b2e927c55`.

| | Microcosm UK 2024-25 | External benchmark |
|---|---:|---|
| CGT taxpayers (gains above the exempt amount) | 558k | HMRC Table 1: 382k (2023-24), 551k (2024-25, provisional) |
| of which entrants by uprating (see below) | 3.1k | none: HMRC counts only taxpayers with a liability |
| CGT taxpayers excluding entrants | 555k | HMRC Table 1: 382k (2023-24), 551k (2024-25) |
| Taxable gains | £129.5bn | HMRC Table 1: £66.6bn (2023-24), £119.3bn (2024-25) |
| Baseline CGT liability | £29.3bn | HMRC Table 1: £12.1bn (2023-24), £22.5bn (2024-25); OBR receipts £20.8bn (2026-27), £25.5bn (2027-28) |
| Residential property gains on their own schedule | £13.3bn | HMRC Table 8a (2024-25): £12.9bn including trusts, about £12.2bn for individuals; 205k taxpayers |
| Gains qualifying for BADR or Investors' Relief, on the BADR schedule | £20.2bn | HMRC Table 4 (2024-25, provisional, individuals): £18.4bn, 61k claimants |
| Share of gains from gains of £1m or more | 66% | HMRC Table 2: 61% (2023-24), 65% (2024-25) |
| Taxpayers with gains over £500k | 35.3k | HMRC Table 2: 19k (2023-24), 33k (2024-25) |
| Largest single gain | £495m | none: HMRC's top band is £5m and over (2k taxpayers, £23.6bn in 2023-24; 3k, £48.5bn in 2024-25) |
| Static yield (e = 0) | +£26.2bn | JRF (2026): about £13bn, static, equalisation alone (see [Benchmarks](#benchmarks)) |
| Uplift from equalising at 2019/20 rules (static) | +130% | CenTax (2024), Table 3: +139% on 2019/20 data |
| Yield, CenTax lower (e = −0.35) | +£14.7bn | none |
| **Yield, central (e = −0.7)** | **+£5.6bn** | none for equalisation alone; CenTax's £14.3bn (2025-26) and £11.3bn (2026-27) add an investment allowance and base broadening |
| Yield, official HMRC/OBR elasticity (retention 3.6) | −£12.6bn | none |
| Five-year total, 2026-27 to 2030-31 | +£30.3bn | none |
| Top income quintile, net income change | −6.0% (−£8,744/household) | none |
| Lowest income quintile, net income change | −0.09% (−£19) | none |

Benchmarks are outturns for the tax year stated (HMRC Capital Gains Tax
statistics, 2026 release, Tables 1, 2, 4 and 8) or other institutions'
estimates of the same reform (described in [Benchmarks](#benchmarks)); only
the OBR receipts and JRF describe a projected year. The sensitivity rows are
changes in CGT revenue; the central row is the change in the government
balance. Uprating HMRC's provisional 2024-25 gains (£119.3bn) to 2026 by the
engine's gains factor (1.074) and its population factor for the weights
(1.011) gives £129.6bn; the dataset carries £129.5bn excluding entrants.

Because the dataset records gains qualifying for Business Asset Disposal
Relief, the reform's withdrawal of the relief (its lifetime limit goes to
zero, so those gains fall to the main schedule at the reformed rates) is
part of every figure above. The Rate explorer keeps the relief at current
law, so its run at 20% / 40% / 45% differs from these figures by the relief's
withdrawal (see [Rate explorer](#rate-explorer)).

Baseline CGT liability by year, against the OBR's March 2026 receipts path
(receipts lag the liability by about a year, so the 2027-28 receipts figure
is the closest published counterpart of the 2026-27 liability):

| | 2026-27 | 2027-28 | 2028-29 | 2029-30 | 2030-31 |
|---|---:|---:|---:|---:|---:|
| Baseline CGT liability | £29.3bn | £30.4bn | £31.5bn | £32.6bn | £33.8bn |
| OBR CGT receipts (EFO March 2026, Table 3.7) | £20.8bn | £25.5bn | £28.9bn | £32.0bn | £34.9bn |

Two things shape the numbers before the reform is applied:

1. **Entrants by uprating.** The annual exempt amount is frozen at £3,000
   while the engine uprates gains with GDP per capita (×1.074 by 2026), so a
   person whose base-year gains sit just below £3,000 crosses the exempt
   amount in the projection and counts as a CGT taxpayer with a few hundred
   pounds of taxable gain. On this dataset that group is 3.1k people holding
   £0.01bn of gains, and the release fences it: its `uk_cgt_projection_entrants`
   gate bounds the stock of crossers by 2030 (7.4k) by HMRC's count of
   taxpayers in the £3,000 to £5,999 band (73k in 2024-25). The pipeline
   edits nothing and still reports the group
   (`validation.entrants_by_uprating`, `budget[].cgt_change_from_entrants_bn`)
   so it can be netted out.
2. **Vintage of the capital gains calibration.** The dataset calibrates to
   HMRC's 2024-25 provisional totals (551,000 taxpayers, £119.3bn of gains,
   £22.5bn of liability). 2024-25 gains are 79% above 2023-24 because the
   rate rises announced in October 2024 brought disposals forward, and a base
   calibrated to that year and then uprated with GDP per capita carries the
   one-off into every projected year: the 2026-27 liability sits about 15%
   above the OBR-implied path. Issue #2's CGT-specific projection (work items
   2-4) is where that timing effect belongs.

The dataset reproduces the top of HMRC's distribution (35.3k taxpayers with
gains over £500k against HMRC's 33k in 2024-25), as its calibration to
HMRC's 2024-25 size-of-gain bands implies, and its regional pattern
concentrates the cost in London and the South East, where HMRC's Table 5
places the taxpayers.

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
  repo's static uplift is 90%, including the withdrawal of Business Asset
  Disposal Relief; applied to the same OBR receipts that is £18.6bn in
  2026-27 and £27.0bn in 2029-30 (deflated with the OBR's CPI path).
- **CenTax (2024), rates only at 2019/20 rules.** CenTax's static uplift from
  equalising alone is +139% on 2019/20 data (Table 3). Applying the same
  rules to this repo's 2026-27 data (main rates 10/20, residential and
  carried interest 18/28, BADR at 10% with a £1m lifetime limit, an exempt
  amount of £12,000; `reform.centax_1920_reforms`) and equalising gives
  +130%. Investors' Relief, which CenTax's Table 3 also abolishes, has no
  engine parameter; the dataset records gains qualifying for either relief
  together on the BADR schedule, so the BADR settings reach both.
  By region (Table 8), the dataset's shares of baseline CGT track CenTax's
  (London 28.3% against 27.0%, South East 20.9% against 21.6%). CenTax's
  uplift is lowest in London (+123%) and higher elsewhere (+137% to +163%);
  on the dataset London's is +128% and the other regions range from +117% to
  +144%.
- **CenTax's package estimates** (Tables 5 and 6 of the 2024 report, the
  August 2025 technical note and "Taxes at the top", September 2026) add an
  investment allowance, the removal of the death uplift and a charge on
  departure, so they are listed as context, not compared.
- **HMRC's ready reckoner (June 2025).** Five rows (higher rate +1, +5 and
  +10 points; lower rate +1 and +5 points) are scored through the rate
  explorer's code at the central and the official elasticity, comparing
  HMRC's receipts in 2027-28 and 2028-29 with this repo's liabilities a year
  earlier. For +10 points on the higher rate HMRC shows −£2,060m and
  −£3,565m; at the official elasticity the dataset gives −£4,784m and
  −£5,002m, while at the central elasticity it gains (+£2,104m on 2026-27
  liabilities). Lower rate +10 points, the BADR rows and the exempt-amount
  row are not scored (the block records why). HMRC deferred its 2026 edition on 6 July
  2026 pending a review of key assumptions, so the rows are provisional.
- **The official elasticity.** HMRC and the OBR use a retention-rate
  elasticity of 3.6 for the main rates ([OBR, January 2025](https://obr.uk/docs/dlm_uploads/CGT-supplementary-release-Jan-2025.pdf),
  para 1.9). Applied in that convention, equalisation changes 2026-27 CGT
  revenue by −£12.6bn, against +£5.6bn at the central case.

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
policyengine-uk 2.89.2 rather than the pinned engine, and raises. Without the token the
manifest is unavailable and the wrapper falls back to its bundled
certification (basis `unverified_data_release_manifest_unavailable`) and
runs against the installed engine. Every committed result was produced that
way, so `simulations.import_wrapper` performs the first import with the
variable removed and restores it straight after (downloads read it at call
time); the basis is recorded in the explorer's `metadata.wrapper_certification`
and in the Modal Volume's `manifest.json`.

### Behavioural response (aligned with Arun Advani / CenTax)

Advani, Lonsdale & Summers (CenTax, Oct 2024, *Reforming Capital Gains Tax*)
use a central medium-term elasticity of **1.0 with respect to the retention
rate (1 − t)**, range 0.5–2.0. This pipeline reports the marginal-tax-rate
convention: converting (`e_mtr = e_retention × t / (1 − t)`) gives ≈ −0.67 to
−0.82 at the reformed 40–45% top rates, and we use **−0.7** as the central
case (also PolicyEngine's Autumn Budget 2024 value). Sensitivity runs cover
0.0 / −0.35 / −0.7 and the official HMRC/OBR assumption, a retention-rate
elasticity of 3.6 (OBR, January 2025, para 1.9), keyed as −2.52 (3.6 times
the central case) but applied in the retention convention it is stated in:
the engine's MTR form scales realised gains by (t₁/t₀)^e, which at −2.52
makes every rate rise lose revenue, while the retention form,
((1 − t₁)/(1 − t₀))^3.6, reproduces the pattern of HMRC's ready reckoner
(`reform.RETENTION_NATIVE`). Every sensitivity row, explorer option and
explorer response records the engine parameter it set, the convention
(`applied_as`) and the value applied (`reform.elasticity_convention`). Caveat: Advani's elasticity assumes accompanying
base broadening we do not model, so behavioural loss may be understated for
a rate-only reform.

policyengine-uk now carries both conventions:
`gov.simulation.capital_gains_responses.elasticity` is the retention-rate
elasticity (positive) and, since 2.98.0, `...mtr_elasticity` the
marginal-tax-rate elasticity (negative); they may not both be set. The
pipeline sets `mtr_elasticity` and leaves `elasticity` at zero, except for
the official case, which sets `elasticity` to 3.6 and leaves
`mtr_elasticity` at zero. Setting −0.7
on the retention parameter, as this repo did before the engine's change,
raises realisations instead of lowering them (static +£10.7bn, "−0.7"
+£16.7bn on the Enhanced FRS the repo then used); the pipeline's assertion that the static and
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

- `data/cgt_equalisation_results.json`, the file the dashboard reads:
  metadata (wrapper and model versions, the dataset's pin, digest, producer
  and observation vintage, the reform including its schedule settings, the
  projection fingerprint, the entrant ceilings), an explicitly empty
  `calibration` block (no local reweighting), baseline validation vs
  HMRC/Advani including the entrants and the schedule components, budget
  impact by year with the entrants' contribution, distributional impacts,
  the elasticity sensitivity, and a `benchmarks` block (see
  [Benchmarks](#benchmarks)).
- `data/cgt_uprating_audit.json`: the projection audit below, with the
  per-year baseline block filled for the dataset.

### Projection of the gains base (issue #2)

The published file is a single engine year (`time_period` 2024, on an FRS
2024-25 spine). `pe.uk.ensure_datasets` hands it to the engine, which
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

The dashboard's **Rate explorer** tab scores any schedule of main CGT rates
(basic / higher / additional, applied to the main schedule and to the
residential property schedule) on the dataset for 2026-27 to 2030-31,
through the pipeline's own code path: the pinned per-year datasets, the
cached baseline simulations, the `Policy.simulation_modifier`
reform with the behavioural response, and `impacts.budget_impact` /
`impacts.income_change_groups`. Nothing is precomputed or interpolated: an
explorer run of one of HMRC's ready-reckoner rows reproduces the committed
`benchmarks.ready_reckoner` figures exactly (the pipeline scores them
through this code), and 18/24/24 gives zero change.

Scope: carried interest and Business Asset Disposal Relief stay at current
law (`reform.EXPLORER_SCOPE`, `reform.cgt_rate_reform`). The dataset records
no carried interest, so that choice is inert, but it records £20.2bn of gains
qualifying for the relief in 2026-27, and the equalisation reform withdraws
the relief. An explorer run at 20/40/45 therefore differs from the Reform
impacts tab: at the central elasticity it gives +£3.7bn in 2026-27 and
+£19.8bn over five years, against the tab's +£5.6bn and +£30.3bn. Issue #9
(section 2) covers making the relief an explorer lever.

### Locally

```bash
uk-cgt-reform-explore --basic 0.18 --higher 0.30 --additional 0.30
uk-cgt-reform-explore --basic 0.20 --higher 0.40 --additional 0.45 --json       # full result on stdout
uk-cgt-reform-explore --options                                                 # bounds, presets, ready-reckoner rows, dataset
```

Rates are fractions in whole percentage points (0.30, not 0.305), ordered
basic ≤ higher ≤ additional: the additional rate exists only so a reform can
charge more above £125,140 of income and gains.
Runs use `data/policyengine_datasets` (run the pipeline once first so the
per-year files and baselines exist) and never write a simulation output
file: reform simulations run in memory. Measured on an M5 Pro: about 40 s
for the five years (9–11 s for the first year, which includes one-off
loading, then 6–8 s per year).

### Result cache (every run)

Every completed run is written to `data/explore_results/<key>.json`
(gitignored) and, on Modal, to the Volume's `explore_results/` and a
`modal.Dict` in front of it. The key is
`<dataset key>__<dataset digest>__<projection fingerprint>__<policyengine-uk version>__<policyengine version>__<policyengine-core version>__<code fingerprint>__<reform fingerprint>`;
the reform fingerprint digests the rates and the elasticity, and the code
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
modal run backend/warm.py                                  # the registered dataset
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
uk-cgt-reform-build                       # the registered dataset
uk-cgt-reform-build --audit-only          # the projection audit alone
```

Requires a Hugging Face token with access to PolicyEngine's private repos,
exported as `HF_TOKEN` (the variable `huggingface_hub` reads for the pinned
downloads). Do not also export `HUGGING_FACE_TOKEN` while running on the pinned
engine: policyengine.py 4.22.3 uses that variable to fetch the data package's
current release manifest at import, and that manifest does not certify the
pinned engine, so the import raises ("Data release manifest is not certified
for the runtime model version 2.104.0"). Without it the wrapper records its bundled default
dataset as `unverified_data_release_manifest_unavailable`, which does not
touch these runs: the dataset here is pinned explicitly by revision and
digest. `pyproject.toml` pins policyengine-uk to 2.104.0. The dataset was
built and certified with 2.100.0; 2.104.0 adds the precise marginal rate on
large gains ([policyengine-uk#1980](https://github.com/PolicyEngine/policyengine-uk/pull/1980)),
which the behavioural response reads. Each release can move the projection
fingerprint, so changing the pin is a deliberate re-pin that regenerates the
results. A run needs the per-year builds, nineteen stored simulations
(baseline, central and static reform for every year, two more sensitivity
cases, and the CenTax counterfactual pair) and twenty in-memory
ready-reckoner runs; from scratch it took about seven minutes on an M5 Pro
(peak memory 3.7 GB). Copy `data/cgt_equalisation_results.json` into
`dashboard/public/data/` for the dashboard, which bundles it at build time,
and regenerate `explore_options.json` with
`uk-cgt-reform-explore --options > dashboard/public/data/explore_options.json`
when the explorer's options or the dataset change.

```bash
pytest        # pure-logic tests only, no simulation (pipeline and rate explorer)
ruff check .
```
