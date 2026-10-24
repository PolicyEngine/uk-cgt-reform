// A CGT rate schedule as the Reform tab's policy forms hold it: the three
// main rates as percentage strings, a treatment of Business Asset Disposal
// Relief and a behavioural elasticity. Validation, presets and the shareable
// URL live here, apart from the components, so they can be tested.
import options from "../../public/data/explore_options.json";
import { describeBadr } from "./dataHelpers";
import { formatPct } from "./formatters";

// The request options come from the pipeline (uk-cgt-reform-explore
// --options), bundled at build time so the controls never wait on a network.
export const BANDS = [
  {
    key: "basic_rate",
    param: "basic",
    label: "Basic rate",
    note: "Gains that fall within the basic rate band once counted on top of the taxpayer's income.",
  },
  {
    key: "higher_rate",
    param: "higher",
    label: "Higher rate",
    note: "Gains above the basic rate band, up to the additional rate threshold.",
  },
  {
    key: "additional_rate",
    param: "additional",
    label: "Additional rate",
    note: "Gains above £125,140 once counted on top of the taxpayer's income. Current law has no separate rate here: set it equal to the higher rate for a single rate above the basic band.",
  },
];
export const PCT_MIN = options.rate_bounds[0] * 100;
export const PCT_MAX = options.rate_bounds[1] * 100;
export const STEP_PCT = (options.rate_step ?? 0.01) * 100;
export const PRESETS = options.presets;
export const ELASTICITIES = options.elasticity_options;
export const DEFAULT_ELASTICITY = options.default_elasticity;
export const CURRENT_LAW = PRESETS.find((preset) => preset.id === "current_law");
// HMRC's ready-reckoner rows (June 2025): schedules a reader can load, with
// HMRC's own post-behavioural receipts to set beside the run.
export const READY_RECKONER = options.ready_reckoner;

// Business Asset Disposal Relief: kept at a rate and lifetime limit, or
// withdrawn. The form holds the rate as a percentage string, like the bands.
export const BADR_CURRENT_LAW = options.badr.current_law;
export const BADR_LIMITS = options.badr.lifetime_limits;

// Links shared before the retention form keyed each case by a marginal-tax-rate
// value; they map to the case they named, as the backend does.
const LEGACY_MTR_ELASTICITIES = new Map([
  [-0.35, 0.5],
  [-0.7, 1.0],
  [-2.52, 3.6],
]);
export const sameElasticity = (a, b) => Math.abs(a - b) < 1e-9;
export const elasticityOption = (e) =>
  ELASTICITIES.find((option) => sameElasticity(option.e_retention, e)) ?? null;

// Any retention elasticity in these bounds, in tenths, can be typed instead
// of a case (the Custom choice). A typed value equal to a case is that case.
export const ELASTICITY_MIN = options.elasticity_bounds?.[0] ?? 0;
export const ELASTICITY_MAX = options.elasticity_bounds?.[1] ?? 5;
export const ELASTICITY_STEP = options.elasticity_step ?? 0.1;
const roundTenth = (value) => Math.round(value * 10) / 10;

export function validateElasticity(raw) {
  const value = Number(raw);
  const range = `between ${ELASTICITY_MIN} and ${ELASTICITY_MAX}`;
  if (raw === "" || raw === null || raw === undefined || !Number.isFinite(value)) {
    return { error: `Enter an elasticity ${range}.` };
  }
  if (value < ELASTICITY_MIN - 1e-9 || value > ELASTICITY_MAX + 1e-9) {
    return { error: `The elasticity must be ${range}.` };
  }
  if (Math.abs(value / ELASTICITY_STEP - Math.round(value / ELASTICITY_STEP)) > 1e-6) {
    return { error: `The elasticity steps by ${ELASTICITY_STEP}; ${value} is not a multiple of it.` };
  }
  return { elasticity: roundTenth(Math.round(value / ELASTICITY_STEP) * ELASTICITY_STEP) };
}

// The elasticity a form holds: a case's value, or the typed one when the
// Custom choice is on (`customElasticity` a string; null for a case).
export function formElasticity(form) {
  if (form.customElasticity === null || form.customElasticity === undefined) {
    return { elasticity: form.elasticity };
  }
  return validateElasticity(form.customElasticity);
}

// A short name for an elasticity: the case's ("CenTax central"), or
// "Elasticity 2.5" for any other value.
export function elasticityShortName(e) {
  const option = elasticityOption(e);
  return option ? option.label.replace(/\s*\(.*\)$/, "") : `Elasticity ${e}`;
}

export const toPercent = (fraction) => Math.round(fraction * 10000) / 100;
const toFraction = (percent) => Math.round(Number(percent) * 100) / 10000;
export const percentsOf = (rates) =>
  Object.fromEntries(BANDS.map((band) => [band.key, String(toPercent(rates[band.key]))]));
export const sameRates = (a, b) => BANDS.every((band) => Math.abs(a[band.key] - b[band.key]) < 1e-9);
export const sameBadr = (a, b) =>
  a.withdrawn === b.withdrawn &&
  (a.withdrawn || (Math.abs(a.rate - b.rate) < 1e-9 && a.lifetime_limit === b.lifetime_limit));
export const badrFormOf = (badr) =>
  badr.withdrawn
    ? { mode: "withdraw", rate: String(toPercent(BADR_CURRENT_LAW.rate)), limit: BADR_CURRENT_LAW.lifetime_limit }
    : { mode: "keep", rate: String(toPercent(badr.rate)), limit: badr.lifetime_limit };

// A form loaded with a schedule: rates and relief as stored, and the
// elasticity in the Custom box, which every form opens on; picking a case
// from the select replaces it.
export const formOf = (rates, badr, elasticity = DEFAULT_ELASTICITY) => ({
  percents: percentsOf(rates),
  badrForm: badrFormOf(badr ?? BADR_CURRENT_LAW),
  elasticity,
  customElasticity: Number(elasticity).toFixed(1),
});

// The schedule the precomputed results file scored, read from the file
// itself (not the preset list), so the instant results always answer for
// the schedule they were computed on.
export function precomputedSchedule(data) {
  return {
    rates: data.metadata.reform,
    badr: data.metadata.reform_schedules.badr,
    elasticity: data.metadata.elasticity,
  };
}

export function validatePercents(percents) {
  const numbers = {};
  for (const band of BANDS) {
    const raw = percents[band.key];
    const value = Number(raw);
    if (raw === "" || raw === null || raw === undefined || !Number.isFinite(value)) {
      return { error: `Enter a ${band.label.toLowerCase()} between ${PCT_MIN}% and ${PCT_MAX}%.`, field: band.key };
    }
    if (value < PCT_MIN || value > PCT_MAX) {
      return { error: `The ${band.label.toLowerCase()} must be between ${PCT_MIN}% and ${PCT_MAX}%.`, field: band.key };
    }
    if (Math.abs(value / STEP_PCT - Math.round(value / STEP_PCT)) > 1e-6) {
      return {
        error: `Rates are whole percentage points; ${value}% for the ${band.label.toLowerCase()} is not.`,
        field: band.key,
      };
    }
    numbers[band.key] = value;
  }
  if (numbers.basic_rate > numbers.higher_rate) {
    return { error: "The basic rate may not exceed the higher rate.", field: "basic_rate" };
  }
  if (numbers.additional_rate < numbers.higher_rate) {
    return {
      error:
        "The additional rate must be at least the higher rate. Set them equal for a single rate above the basic rate band, as in current law.",
      field: "additional_rate",
    };
  }
  return { rates: Object.fromEntries(BANDS.map((band) => [band.key, toFraction(numbers[band.key])])) };
}

export function validateBadr(form, rates) {
  if (form.mode === "withdraw") return { badr: { withdrawn: true, rate: null, lifetime_limit: null } };
  const value = Number(form.rate);
  if (form.rate === "" || !Number.isFinite(value) || value < 0) {
    return { error: "Enter a rate for Business Asset Disposal Relief, or withdraw the relief.", field: "badr_rate" };
  }
  if (Math.abs(value / STEP_PCT - Math.round(value / STEP_PCT)) > 1e-6) {
    return { error: `The relief's rate is a whole percentage point; ${value}% is not.`, field: "badr_rate" };
  }
  if (rates && value / 100 > rates.additional_rate + 1e-9) {
    return {
      error:
        "The relief's rate may not exceed the additional rate: the relief would then raise the tax on qualifying gains.",
      field: "badr_rate",
    };
  }
  return { badr: { withdrawn: false, rate: toFraction(value), lifetime_limit: Number(form.limit) } };
}

// A whole form checked: `rates` and `badr` are set only when the rates, the
// relief and the elasticity are all valid; `errorField` names the input an
// error belongs to (a band key, "badr_rate" or "elasticity").
export function checkForm(form) {
  const rateCheck = validatePercents(form.percents);
  const badrCheck = validateBadr(form.badrForm, rateCheck.rates);
  const elasticityCheck = formElasticity(form);
  const valid = Boolean(rateCheck.rates && badrCheck.badr && elasticityCheck.error === undefined);
  return {
    rates: valid ? rateCheck.rates : null,
    badr: valid ? badrCheck.badr : null,
    elasticity: elasticityCheck.elasticity ?? null,
    error: rateCheck.error ?? badrCheck.error ?? elasticityCheck.error,
    errorField: rateCheck.field ?? badrCheck.field ?? (elasticityCheck.error ? "elasticity" : null),
    // The model charges the relief's rate on every qualifying gain. Above the
    // basic rate, a taxpayer with qualifying gains in the basic rate band
    // would not claim the relief, which the model does not capture.
    reliefAboveBasic:
      valid && !badrCheck.badr.withdrawn ? badrCheck.badr.rate > rateCheck.rates.basic_rate + 1e-9 : false,
  };
}

// Whether a checked form is the schedule the precomputed results scored.
export function isPrecomputed(check, precomputed) {
  return Boolean(
    check.rates &&
      sameRates(check.rates, precomputed.rates) &&
      sameBadr(check.badr, precomputed.badr) &&
      sameElasticity(check.elasticity, precomputed.elasticity),
  );
}

// The preset a checked form matches, or "custom".
export function presetFor(check) {
  if (!check.rates) return "custom";
  return (
    PRESETS.find((candidate) => sameRates(candidate.rates, check.rates) && sameBadr(candidate.badr, check.badr))
      ?.id ?? "custom"
  );
}

// HMRC's rows each carry rates and a treatment of the relief (its BADR rows
// move the relief's rate; the rest leave it at current law).
export function readyReckonerRowFor(rates, badr) {
  return READY_RECKONER.rows.find(
    (row) => sameRates(row.rates, rates) && sameBadr(row.badr ?? BADR_CURRENT_LAW, badr),
  );
}

// A shared link's schedule: the three rates (`basic`, `higher`, `additional`,
// in percent), the relief and `e`. Null when the link carries no full
// schedule. Old links opened the Rate explorer tab (`tab=explorer`); they
// carry the same parameters and read the same way.
export function readUrlState(searchParams) {
  const values = BANDS.map((band) => searchParams.get(band.param));
  if (values.some((value) => value === null || value === "")) return null;
  const percents = Object.fromEntries(BANDS.map((band, i) => [band.key, values[i]]));
  // An absent or empty `e` means the default; Number(null) would be 0, the static case.
  const rawE = searchParams.get("e");
  const parsed = rawE === null || rawE.trim() === "" ? NaN : Number(rawE);
  const legacy = [...LEGACY_MTR_ELASTICITIES].find(([mtr]) => sameElasticity(mtr, parsed));
  const e = legacy ? legacy[1] : parsed;
  // A case, or a valid custom value; anything else falls back to the default.
  const custom = validateElasticity(e).elasticity;
  const elasticity = elasticityOption(e) ? e : (custom ?? DEFAULT_ELASTICITY);
  const customElasticity = elasticityOption(elasticity) ? null : String(elasticity);
  // The relief: `bw=1` withdraws it; `br` (percent) and `bl` (£) keep it at
  // other than current law; neither means current law.
  const badrForm = badrFormOf(BADR_CURRENT_LAW);
  if (searchParams.get("bw") === "1") badrForm.mode = "withdraw";
  if (searchParams.get("br")) badrForm.rate = searchParams.get("br");
  const limit = Number(searchParams.get("bl"));
  if (BADR_LIMITS.includes(limit)) badrForm.limit = limit;
  // A link from before the relief lever carries a marginal-rate elasticity
  // and no relief fields. Its 20% / 40% / 45% loads with the "Equalise with
  // income tax" preset's treatment of the relief, so it scores the
  // equalisation reform.
  const equalisation = PRESETS.find((preset) => preset.id === "income_tax");
  const relieflessLegacyLink =
    legacy && ["bw", "br", "bl"].every((key) => searchParams.get(key) === null);
  const equalisationRates = BANDS.every(
    (band) => Number(percents[band.key]) === toPercent(equalisation.rates[band.key]),
  );
  if (relieflessLegacyLink && equalisationRates && equalisation.badr.withdrawn) badrForm.mode = "withdraw";
  return { percents, elasticity, customElasticity, badrForm };
}

// Whether a policy's form has the relief control. "Equalise with income tax"
// keeps the relief at current law, as the headline reform does, so its form
// sets only the rates and the behavioural response, and its links never carry
// relief parameters; Custom rates can keep, change or withdraw it.
export function hasReliefControl(policy) {
  return policy !== "equalise";
}

// A form in one line: "20% · 40% · 45% · Relief withdrawn · CenTax central"
// (or "Elasticity 2.5" for a typed value). Without the relief control the
// relief part is dropped: "20% · 40% · 45% · CenTax central".
export function formSummary(form, { relief = true } = {}) {
  const check = checkForm(form);
  if (!check.rates) return "";
  const rates = BANDS.map((band) => formatPct(check.rates[band.key] * 100, 0)).join(" · ");
  const reliefPart = !relief
    ? null
    : check.badr.withdrawn
      ? "Relief withdrawn"
      : `Relief ${describeBadr(check.badr)}`;
  return [rates, reliefPart, elasticityShortName(check.elasticity)].filter(Boolean).join(" · ");
}

// What a page load opens: which policy a link selects, each policy's form,
// and the view: "precomputed" (a link to the precomputed schedule), "live"
// (another valid schedule, looked up in the cache), "none" (a link that
// selects Custom rates with nothing to show) or "landing" (a plain load,
// nothing selected). A link with a schedule, or to the old Rate explorer
// tab, selects Custom rates with that schedule (current law when it has
// none); a link whose schedule is the precomputed one selects Equalise with
// income tax unless it came from the old tab.
export function initialChoice(searchParams, precomputed) {
  const fromUrl = readUrlState(searchParams);
  const equalise = formOf(precomputed.rates, precomputed.badr, precomputed.elasticity);
  const custom = fromUrl ?? formOf(CURRENT_LAW.rates, CURRENT_LAW.badr);
  const explorerLink = searchParams.get("tab") === "explorer";
  const forms = { equalise, custom };
  if (fromUrl && isPrecomputed(checkForm(fromUrl), precomputed)) {
    return { policy: explorerLink ? "custom" : "equalise", forms, view: "precomputed" };
  }
  if (fromUrl) return { policy: "custom", forms, view: checkForm(fromUrl).rates ? "live" : "none" };
  if (explorerLink) return { policy: "custom", forms, view: "none" };
  return { policy: "equalise", forms, view: "landing" };
}

// The query string for a schedule run live, on top of the page's other
// parameters; `null` clears the schedule (the precomputed results need none).
export function scheduleParams(current, schedule) {
  const params = new URLSearchParams(current);
  // Only the Reform tab writes a schedule, and it is the default tab, so the
  // URL needs no `tab`: an old link's `tab=explorer` is retired, and a `tab`
  // the page has not yet removed after navigating here cannot come back.
  params.delete("tab");
  [...BANDS.map((band) => band.param), "bw", "br", "bl", "e"].forEach((key) => params.delete(key));
  if (!schedule) return params;
  const { rates, badr, elasticity } = schedule;
  BANDS.forEach((band) => params.set(band.param, String(toPercent(rates[band.key]))));
  if (badr.withdrawn) params.set("bw", "1");
  else if (!sameBadr(badr, BADR_CURRENT_LAW)) {
    params.set("br", String(toPercent(badr.rate)));
    params.set("bl", String(badr.lifetime_limit));
  }
  params.set("e", String(elasticity));
  return params;
}
