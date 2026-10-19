const MINUS = "\u2212";
const DASH = "\u2014";

// A missing or non-numeric value (null, undefined, "", NaN) reads as NaN, so
// every formatter can show a dash rather than "£NaNbn" or "£0".
function toNumber(value) {
  if (value === null || value === undefined || value === "") return NaN;
  return Number(value);
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
  const rounded = Math.round(amount);
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
  const abs = Math.abs(amount);
  if (abs >= 0.005) return formatSignedBn(amount, 2);
  if (abs >= 0.0005) {
    const rounded = (amount * 1000).toFixed(1);
    return `${signOf(rounded)}\u00A3${Math.abs(Number(rounded)).toFixed(1)}m`;
  }
  if (abs >= 0.0000005) {
    const rounded = Math.round(amount * 1e6);
    return `${signOf(rounded)}\u00A3${Math.abs(rounded).toLocaleString("en-GB")}k`;
  }
  // Below £500: whole pounds.
  return formatCurrency(amount * 1e9);
}

export function formatMn(value) {
  const amount = toNumber(value);
  if (!Number.isFinite(amount)) return DASH;
  const rounded = Math.round(amount);
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

export function formatCompactCurrency(value) {
  const amount = toNumber(value);
  if (!Number.isFinite(amount)) return DASH;
  const formatter = new Intl.NumberFormat("en-GB", {
    notation: "compact",
    maximumFractionDigits: 1,
  });

  return `${signOf(Math.round(amount))}\u00A3${formatter.format(Math.abs(amount))}`;
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

// A source's publication date ("2026-06-29" or "2024-10") as prose.
export function formatPublished(isoDate) {
  if (typeof isoDate !== "string" || !isoDate) return DASH;
  const [year, month, day] = isoDate.split("-").map(Number);
  return day ? `${day} ${MONTHS[month - 1]} ${year}` : `${MONTHS[month - 1]} ${year}`;
}
