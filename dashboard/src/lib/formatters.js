function getSignedPrefix(value) {
  const amount = Number(value);
  if (amount > 0) {
    return "";
  }
  if (amount < 0) {
    return "\u2212";
  }
  return "";
}

export function formatCurrency(value) {
  return `\u00A3${Math.round(Number(value)).toLocaleString("en-GB")}`;
}

export function formatSignedCurrency(value) {
  const amount = Math.round(Number(value));
  return `${getSignedPrefix(amount)}\u00A3${Math.abs(amount).toLocaleString("en-GB")}`;
}

export function formatBn(value, digits = 2) {
  return `\u00A3${Number(value).toFixed(digits)}bn`;
}

export function formatSignedBn(value, digits = 2) {
  const amount = Number(value);
  return `${getSignedPrefix(amount)}\u00A3${Math.abs(amount).toFixed(digits)}bn`;
}

// An amount in £bn that can be tiny, such as the CGT the entrants by uprating
// pay (tens of thousands of pounds): £bn to two places while that shows a
// figure, then £m, then £k, rather than "£0.00bn".
export function formatSmallBn(value, { signed = false } = {}) {
  const amount = value === null || value === undefined ? NaN : Number(value);
  // A missing value shows as a dash rather than "£NaNk" or "£0".
  if (!Number.isFinite(amount)) return "\u2014";
  const sign = signed ? getSignedPrefix(amount) : amount < 0 ? "\u2212" : "";
  const abs = Math.abs(amount);
  if (abs >= 0.005) return `${sign}\u00A3${abs.toFixed(2)}bn`;
  if (abs >= 0.0005) return `${sign}\u00A3${(abs * 1000).toFixed(1)}m`;
  if (abs === 0) return "\u00A30";
  return `${sign}\u00A3${Math.round(abs * 1e6).toLocaleString("en-GB")}k`;
}

export function formatMn(value) {
  return `\u00A3${Math.round(Number(value)).toLocaleString("en-GB")}m`;
}

export function formatSignedMn(value) {
  const amount = Math.round(Number(value));
  return `${getSignedPrefix(amount)}\u00A3${Math.abs(amount).toLocaleString("en-GB")}m`;
}

export function formatPct(value, digits = 1) {
  return `${Number(value).toFixed(digits)}%`;
}

export function formatSignedPct(value, digits = 1) {
  return `${getSignedPrefix(value)}${formatPct(Math.abs(Number(value)), digits)}`;
}

export function formatCompactCurrency(value) {
  const formatter = new Intl.NumberFormat("en-GB", {
    notation: "compact",
    maximumFractionDigits: 1,
  });

  return `\u00A3${formatter.format(Number(value))}`;
}

export function formatCount(value) {
  const num = Number(value);
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
  const [year, month, day] = isoDate.split("-").map(Number);
  return day ? `${day} ${MONTHS[month - 1]} ${year}` : `${MONTHS[month - 1]} ${year}`;
}
