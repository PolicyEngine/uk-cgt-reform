const MINUS = "\u2212";
const DASH = "\u2014";

// A missing or non-numeric value (null, undefined, "", NaN) reads as NaN, so
// a formatter shows a dash rather than "£NaNbn" or "£0". The dash is for
// optional fields; the accessors in dataHelpers throw on a missing required one.
function toNumber(value) {
  if (value === null || value === undefined || value === "") return NaN;
  return Number(value);
}

// Round half away from zero, so −0.5 and 0.5 round to the same magnitude
// (Math.round sends −0.5 to −0 and 0.5 to 1).
function roundHalfAway(value) {
  return Math.sign(value) * Math.round(Math.abs(value));
}

// The sign of a value as it will be shown: rounding comes first, so a value
// that rounds to zero carries no sign ("£0.0bn", never "−£0.0bn").
function signOf(rounded) {
  if (Number(rounded) > 0) return "";
  if (Number(rounded) < 0) return MINUS;
  return "";
}

export function formatCurrency(value) {
  const amount = toNumber(value);
  if (!Number.isFinite(amount)) return DASH;
  const rounded = roundHalfAway(amount);
  return `${signOf(rounded)}\u00A3${Math.abs(rounded).toLocaleString("en-GB")}`;
}

export function formatSignedCurrency(value) {
  return formatCurrency(value);
}

// £bn with a true minus sign before the pound sign: "−£0.50bn", "£1.20bn".
export function formatSignedBn(value, digits = 2) {
  const amount = toNumber(value);
  if (!Number.isFinite(amount)) return DASH;
  const rounded = amount.toFixed(digits);
  return `${signOf(rounded)}\u00A3${Math.abs(Number(rounded)).toFixed(digits)}bn`;
}

// Levels (baseline revenue, gains) are positive; a negative one still shows
// as "−£0.50bn", not "£-0.50bn".
export function formatBn(value, digits = 2) {
  return formatSignedBn(value, digits);
}

// An amount in £bn that can be tiny, such as the CGT the entrants by uprating
// pay (tens of thousands of pounds): £bn to two places while that shows a
// figure, then £m, then £k, then whole pounds, rather than "£0.00bn".
export function formatSmallBn(value) {
  const amount = toNumber(value);
  if (!Number.isFinite(amount)) return DASH;
  if (Math.abs(amount) >= 0.005) return formatSignedBn(amount, 2);
  // Work in pounds from here, so each step's threshold and rounding agree.
  const pounds = amount * 1e9;
  if (Math.abs(pounds) >= 5e5) {
    const rounded = (pounds / 1e6).toFixed(1);
    return `${signOf(rounded)}\u00A3${Math.abs(Number(rounded)).toFixed(1)}m`;
  }
  const thousands = roundHalfAway(pounds / 1e3);
  if (thousands !== 0) {
    return `${signOf(thousands)}\u00A3${Math.abs(thousands).toLocaleString("en-GB")}k`;
  }
  // Below £500: whole pounds.
  return formatCurrency(pounds);
}

export function formatMn(value) {
  const amount = toNumber(value);
  if (!Number.isFinite(amount)) return DASH;
  const rounded = roundHalfAway(amount);
  return `${signOf(rounded)}\u00A3${Math.abs(rounded).toLocaleString("en-GB")}m`;
}

export function formatSignedMn(value) {
  return formatMn(value);
}

export function formatPct(value, digits = 1) {
  const amount = toNumber(value);
  if (!Number.isFinite(amount)) return DASH;
  const rounded = amount.toFixed(digits);
  return `${signOf(rounded)}${Math.abs(Number(rounded)).toFixed(digits)}%`;
}

export function formatSignedPct(value, digits = 1) {
  return formatPct(value, digits);
}

export function formatCount(value) {
  const num = toNumber(value);
  if (!Number.isFinite(num)) return DASH;
  if (num >= 950_000) {
    return `${(num / 1e6).toFixed(1)}m`;
  }
  if (num >= 1e5) {
    return `${Math.round(num / 1e3).toLocaleString("en-GB")}k`;
  }
  if (num >= 1e3) {
    return `${(num / 1e3).toFixed(1)}k`;
  }
  // Survey-weighted counts are fractional; never show decimals of a person.
  return Math.round(num).toLocaleString("en-GB");
}

// How a behavioural case reached the engine: every case is an elasticity of
// realised gains with respect to the retention rate (1 − t), applied as stated.
export function formatElasticity({ applied_value: appliedValue, badr_elasticity: badr }) {
  // The static case applies no elasticity at all.
  if (Number(appliedValue) === 0 && (badr === undefined || Number(badr) === 0)) return "none";
  const main = `retention ${Number(appliedValue).toFixed(1)}`;
  // The official case gives gains qualifying for the relief their own 1.4.
  return badr === undefined || badr === appliedValue
    ? main
    : `${main}; ${Number(badr).toFixed(1)} for BADR gains`;
}

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

// A source's publication date ("2026-06-29", "2024-10" or "2026") as prose.
export function formatPublished(isoDate) {
  if (typeof isoDate !== "string" || !isoDate) return DASH;
  const [year, month, day] = isoDate.split("-").map(Number);
  if (!Number.isInteger(year)) return DASH;
  const monthName = MONTHS[month - 1];
  if (!monthName) return String(year);
  return day ? `${day} ${monthName} ${year}` : `${monthName} ${year}`;
}

// Splits text into plain parts and fiscal-year labels ("2027-28"), so a
// title can keep each year on one line (a browser may break after its hyphen).
export function splitFiscalYears(text) {
  return String(text)
    .split(/(\b\d{4}-\d{2}\b)/)
    .filter((part) => part !== "")
    .map((part) => ({ text: part, year: /^\d{4}-\d{2}$/.test(part) }));
}

// The three elasticities HMRC's table of small rate changes is scored at, in
// one wording everywhere: "at the official 3.6 (1.4 for the relief), at 3.0
// and at CenTax's central 1.0".
export function reckonerElasticities(official, central, third = 3) {
  return `at the official ${official.e_retention.toFixed(1)} (${official.badr_e_retention.toFixed(1)} for the relief), at ${third.toFixed(1)} and at CenTax's central ${central.e_retention.toFixed(1)}`;
}

// A signed change in percentage points, in words: "+2 points", "−1 point",
// "0 points".
export function formatSignedPoints(value, digits = 0) {
  const text = Math.abs(value).toFixed(digits);
  const sign = Number(text) === 0 ? "" : value > 0 ? "+" : "\u2212";
  return `${sign}${text} ${Number(text) === 1 ? "point" : "points"}`;
}
