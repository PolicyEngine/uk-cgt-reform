# Equalising capital gains tax with income tax (the "Burnham" reform)

Data pipeline estimating the budgetary and distributional impact of
**equalising UK CGT rates with income tax rates** — the reform debated in the
Labour leadership contest, associated with Andy Burnham and backed by allies
including Louise Haigh and Wes Streeting — using the standard
[policyengine.py](https://github.com/PolicyEngine/policyengine.py) stack
(the `policyengine` package wrapping the PolicyEngine UK model) on the
Enhanced FRS 2024-25 dataset exactly as published by
[policyengine-uk-data](https://github.com/PolicyEngine/policyengine-uk-data),
with no local reweighting.

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

## Method

### The policyengine.py pathway

- `pe.uk.ensure_datasets(datasets=["hf://policyengine/policyengine-uk-data/enhanced_frs_2024_25.h5"], years=[2026..2030])`
  materialises one certified per-year dataset file per simulated year.
- Simulations run on those files **unmodified**. All calibration and
  weighting belongs upstream in `policyengine-uk-data`, not in an analysis
  repo, so this pipeline does no local reweighting.
- Each (scenario, year) pair is one `policyengine.Simulation`, with
  deterministic ids so policyengine.py's output-dataset cache skips
  completed runs.
- Decile impacts and winners/losers use policyengine.py's standard outputs
  (`policyengine.outputs.decile_impact` and `intra_decile_impact`, grouped
  by the model's `household_income_decile`; decile −1 excluded), so tables
  match what PolicyEngine's app machinery reports. The intra-decile bands
  are people-weighted with ±5% relative-change thresholds and a ±0.1%
  no-change band.
- Aggregates the wrapper does not expose directly (budget totals, per-decile
  total change, baseline validation statistics) are computed from the
  simulations' output datasets with **native microdf weighted operations**
  (`MicroSeries.sum/mean/median/count`, weighted `groupby`) — no manual
  weight arithmetic.

### Data caveat: the gains imputation is too broad (load-bearing)

The Enhanced FRS gains imputation is aggregate-unconstrained, and the OBR
CGT calibration target is silently dropped in `policyengine-uk-data` (the
EFO parser reads sheet 3.9; the CGT row moved to 3.8). As a result the
published data spreads capital gains far more widely than HMRC records:
roughly 1.1-1.3m CGT taxpayers in 2026 against HMRC's 378,000 in 2023-24,
with a mean gain well below HMRC's ~£174,000, and no one with a very large
gain (the Pareto tail is missing).

Consequences, stated plainly:

- Because the number of people holding gains is overstated, the **share of
  people affected by the reform is overstated by roughly the same factor**.
  The winners/losers and decile figures are upper bounds on breadth, not
  point estimates.
- **Revenue totals are less affected** than the distributional breakdown,
  since revenue is driven by the gains total and the rate change rather
  than by headcount.
- The missing top tail understates static yield and the top-end
  behavioural response.

The `validation` block of the output JSON reports the measured baseline
statistics, and the dashboard's benchmarks table shows them against HMRC
outturn, so the gap is disclosed rather than hidden.

Upstream fixes are in progress — `policyengine-uk-data` PR #440 (adding
HMRC CGT targets) and PR #443 (restoring the missing Pareto tail in the
gains imputation). This analysis will improve automatically once they land
in a published release.

### Behavioural response (aligned with Arun Advani / CenTax)

PolicyEngine's `gov.simulation.capital_gains_responses.elasticity` is the
elasticity of taxable gains **with respect to the marginal tax rate**.
Advani, Lonsdale & Summers (CenTax, Oct 2024, *Reforming Capital Gains Tax*)
use a central medium-term elasticity of **1.0 with respect to the retention
rate (1 − t)**, range 0.5–2.0. Converting conventions
(`e_mtr = e_retention × t / (1 − t)`), that is ≈ −0.67 to −0.82 at the
reformed 40–45% top rates; we use **−0.7** as the central case (also
PolicyEngine's Autumn Budget 2024 value). Sensitivity runs cover 0.0 /
−0.35 / −0.7 / −1.4 / −2.0. Caveat: Advani's elasticity assumes accompanying
base broadening we do not model, so behavioural loss may be understated for a
rate-only reform.

### Reforms via `Policy.simulation_modifier` (load-bearing)

policyengine.py 4.20.0 applies a plain-dict reform as post-construction
parameter updates on an unreformed `policyengine_uk.Microsimulation` and
never registers the baseline branch, so the CGT behavioural elasticity is
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

`data/cgt_equalisation_results.json`: metadata (wrapper and model
versions), an explicitly empty `calibration` block (no local reweighting),
baseline validation vs HMRC/Advani, budget impact by year, decile
impacts, winners/losers bands, the elasticity sensitivity, and a comparison
with CenTax (£14.0bn central / £9.6bn worst-case), Advani & Summers 2020
static (£16.7bn), the HMRC ready reckoner (−£2bn) and the OBR baseline
(£21.8bn in 2025-26, EFO March 2026).

### Projection of the gains base (issue #2)

The published file is a single engine year (`time_period` 2024, the FRS
2024-25 observation). `pe.uk.ensure_datasets` hands it to the engine, which
copies the year forward to 2030 and uprates it year on year from the
engine's `data/uprating_indices.yaml`: `capital_gains` and
`capital_gains_before_response` follow OBR GDP per capita, `household_weight`
follows ONS population growth. Nothing CGT-specific enters the projection.

`uk_equalising_cgt.uprating_audit` records what is actually applied,
reading the installed engine's index map and growth parameters:

| | 2026 | 2027 | 2028 | 2029 | 2030 | source |
|---|---:|---:|---:|---:|---:|---|
| gains (GDP per capita) | 1.074 | 1.109 | 1.143 | 1.177 | 1.214 | OBR EFO March 2026, Table A.1 |
| weights (population) | 1.011 | 1.015 | 1.019 | 1.023 | 1.028 | ONS population projections |
| CPI (sensitivity, not applied) | 1.058 | 1.079 | 1.100 | 1.123 | 1.145 | OBR EFO March 2026, Table A.1 |

Cumulative factors from the 2024 base on policyengine-uk 2.97.0; the
committed `data/cgt_uprating_audit.json` carries the year-on-year rates,
the parameter references and the OBR March 2026 CGT receipts path
(unbridged: receipts are not gains and lag them). A full pipeline run adds
the per-year baseline gains, taxpayer counts and liability;
`uk-equalising-cgt-build --audit-only` writes the factor table alone.

The projection is fingerprinted into the results metadata
(`metadata.projection`) and into every simulation id, so a change in the
engine's uprating cannot reuse cached simulation outputs.

## Run

```bash
pip install -e ".[simulation,dev]"
uk-equalising-cgt-build              # or: python -m uk_equalising_cgt
```

Requires a `HUGGING_FACE_TOKEN` with access to PolicyEngine's Enhanced FRS
data. The full pipeline takes several minutes (per-year dataset builds plus
one probe plus thirteen scored simulations; re-runs reuse policyengine.py's output cache).

```bash
pytest        # pure-logic tests only, no simulation
ruff check .
```
