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

// How a behavioural case reached the engine: an MTR elasticity, or (the
// official HMRC/OBR case) a retention-rate elasticity, keyed by its MTR value.
export function formatElasticity({ applied_as: appliedAs, applied_value: appliedValue, e_mtr: eMtr }) {
  const mtr = `${getSignedPrefix(eMtr)}${Math.abs(Number(eMtr)).toFixed(2)}`;
  return appliedAs === "retention" ? `retention ${appliedValue} (≈ MTR ${mtr})` : `MTR ${mtr}`;
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
