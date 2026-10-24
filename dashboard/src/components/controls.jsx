"use client";

import { splitFiscalYears } from "../lib/formatters";

// The dashboard's design system: one card, one field, one segmented
// control, one pill, one tooltip, one primary and one text button. Every tab
// draws its boxes and controls from here rather than repeating classes.

// Field: every number input and select. Width is the caller's.
export const FIELD =
  "h-11 rounded-lg border bg-white px-3 text-base font-semibold text-slate-900 shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-[color:var(--pe-color-primary-500)] focus:ring-offset-1 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";
export const fieldBorder = (invalid = false) =>
  invalid
    ? "border-red-500"
    : "border-slate-300 hover:border-slate-400 focus:border-[color:var(--pe-color-primary-600)]";

// Buttons: the one primary action (Calculate) and the text button
// (Restore defaults, Choose this reform).
export const PRIMARY_BUTTON =
  "rounded-lg bg-[color:var(--pe-color-primary-600)] px-8 py-3 text-base font-semibold text-white shadow-sm transition hover:bg-[color:var(--pe-color-primary-700)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--pe-color-primary-500)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";
export const TEXT_BUTTON =
  "inline font-semibold text-[color:var(--pe-color-primary-700)] underline decoration-1 underline-offset-2 hover:opacity-80";

// Helper text under a field or in a card.
export const HINT = "text-xs leading-5 text-slate-500";

// Card: "section" is a top-level box (the chooser, the parameter panel, each
// results section, every tab's sections); "inset" is a card inside one
// (rate cards, option tiles, metric cards). `selected` marks a chosen inset.
const INSET = "rounded-xl border p-4 transition-colors";
export function cardClass(variant = "section", selected = false) {
  if (variant === "section") return "section-card";
  return `${INSET} ${
    selected
      ? "border-[color:var(--pe-color-primary-600)] bg-[color:var(--pe-color-primary-50)]"
      : "border-slate-200 bg-slate-50/60"
  }`;
}
export function Card({ as: Tag = "section", variant = "section", selected = false, className = "", children, ...rest }) {
  return (
    <Tag className={`${cardClass(variant, selected)} ${className}`} {...rest}>
      {children}
    </Tag>
  );
}

// A card in a two-column pair whose five rows (title, pills, description,
// chart, notes; the heading is a `paired` SectionHeading) are shared with
// its neighbour, so both line up on desktop.
export const PAIRED_CARD =
  "flex min-w-0 flex-col lg:row-span-5 lg:grid lg:grid-cols-[minmax(0,1fr)] lg:grid-rows-subgrid lg:gap-y-0";

// The title inside an inset card, optionally a field's label, with its tooltip.
export function CardTitle({ children, htmlFor, id, tip, tipLabel }) {
  const Tag = htmlFor ? "label" : "h3";
  return (
    <div className="mb-2 flex items-center gap-2">
      <Tag htmlFor={htmlFor} id={id} className="text-sm font-semibold text-slate-800">
        {children}
      </Tag>
      {tip ? <InfoTip label={tipLabel ?? `About ${String(children).toLowerCase()}`}>{tip}</InfoTip> : null}
    </div>
  );
}

// A small label for a field inside a card.
export function FieldLabel({ htmlFor, children }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-xs font-semibold text-slate-600">
      {children}
    </label>
  );
}

// Pill: change chips, speed badges and tags.
const PILL_TONES = {
  teal: "bg-[color:var(--pe-color-primary-100)] text-[color:var(--pe-color-primary-800)]",
  amber: "bg-amber-100 text-amber-900",
  slate: "bg-slate-100 text-slate-700",
};
export function Pill({ tone = "slate", children }) {
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${PILL_TONES[tone]}`}>{children}</span>;
}

// The "?" tooltip, opened by hover or keyboard focus.
export function InfoTip({ children, label }) {
  return (
    <span className="info-tip" tabIndex={0} role="note" aria-label={label}>
      ?<span className="info-tip-bubble">{children}</span>
    </span>
  );
}

// Segmented control: the relief's Keep / Withdraw and the charts' views.
// The selected segment is solid teal.
export function Toggle({ options, value, onChange, label, fullWidth = false }) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={`${fullWidth ? "grid w-full" : "inline-grid"} gap-1 rounded-lg border border-slate-300 bg-white p-1`}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={`rounded-md px-4 py-1.5 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--pe-color-primary-500)] ${
              selected
                ? "bg-[color:var(--pe-color-primary-600)] text-white"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

// `valueColor`: the big number's colour, tying the card to its chart (a
// palette colour, never a good/bad signal). Each card carries a thin teal
// accent along its top.
export function MetricCard({ label, value, note, tip, valueColor }) {
  return (
    <Card
      as="div"
      variant="inset"
      className="flex flex-col border-t-4 border-t-[color:var(--pe-color-primary-500)]"
    >
      {/* A two-line slot for the label, so values line up across a row. */}
      <div className="flex items-start gap-2 md:min-h-[2.5rem]">
        <p className="text-sm font-semibold leading-snug text-slate-700">{label}</p>
        {tip ? <InfoTip label={`About ${label.toLowerCase()}`}>{tip}</InfoTip> : null}
      </div>
      <p
        className={`mt-1 text-3xl font-bold tabular-nums ${valueColor ? "" : "text-slate-900"}`}
        style={valueColor ? { color: valueColor } : undefined}
      >
        {value}
      </p>
      {note ? <p className={`mt-2 ${HINT}`}>{note}</p> : null}
    </Card>
  );
}

export function TipHeader({ label, tip, className = "" }) {
  return (
    <th className={className}>
      {label} <InfoTip label={`About ${label.toLowerCase()}`}>{tip}</InfoTip>
    </th>
  );
}

// Longer explanations for a section, collapsed under its content, as bullets.
export function Notes({ children, className = "" }) {
  return (
    <details className={`group mt-4 border-t border-slate-200 pt-3 ${className}`}>
      <summary className="cursor-pointer select-none text-sm font-semibold text-slate-600 marker:text-[color:var(--pe-color-primary-600)]">
        Notes
      </summary>
      {/* Each paragraph reads as a bullet; a list passed in keeps its own. */}
      <div className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-6 text-slate-600 [&>p]:list-item [&>ul]:-ml-5">
        {children}
      </div>
    </details>
  );
}

// Text with each fiscal year ("2027-28") kept on one line.
export function NoBreakYears({ text }) {
  return splitFiscalYears(text).map((part, i) =>
    part.year ? (
      <span key={i} className="whitespace-nowrap">
        {part.text}
      </span>
    ) : (
      part.text
    ),
  );
}

// An external source, opened in a new tab.
export const MICROCOSM_URL = "https://github.com/PolicyEngine/microcosm";

// The dataset's short name with "Microcosm" linked to its builder.
export function DatasetName({ label, possessive = false }) {
  const tail = possessive ? "'s" : "";
  if (!label?.startsWith("Microcosm")) return `${label}${tail}`;
  return (
    <>
      <SourceLink href={MICROCOSM_URL}>Microcosm</SourceLink>
      <NoBreakYears text={`${label.slice("Microcosm".length)}${tail}`} />
    </>
  );
}

export function SourceLink({ href, children }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="font-normal text-[color:var(--pe-color-primary-600)] underline decoration-1 underline-offset-2 hover:opacity-80"
    >
      {children}
    </a>
  );
}

// A source label from the data, with one word linked: the first publisher
// named in it (so "Advani, Lonsdale & Summers (2024), CenTax" links "CenTax"),
// or its first word if it names none. The rest of the label is plain text.
const PUBLISHERS = ["CenTax", "OBR", "HMRC", "IFS", "ONS", "JRF", "Rowntree", "CPS", "NBER"];
export function splitSourceLabel(label = "") {
  let best = null;
  for (const name of PUBLISHERS) {
    const match = new RegExp(`\\b${name}\\b`).exec(label);
    if (match && (best === null || match.index < best.index)) best = match;
  }
  if (best === null) best = /[\p{L}\p{N}]+/u.exec(label);
  if (best === null) return { before: "", word: label, after: "" };
  return {
    before: label.slice(0, best.index),
    word: best[0],
    after: label.slice(best.index + best[0].length),
  };
}

export function SourceLabel({ href, label }) {
  const { before, word, after } = splitSourceLabel(label);
  return (
    <>
      {before}
      <SourceLink href={href}>{word}</SourceLink>
      {after}
    </>
  );
}

// A link to another tab (and optionally one of its sections) inside a sentence.
export function TabLink({ onNavigate, tab, section, children }) {
  return (
    <button
      type="button"
      onClick={() => onNavigate?.(tab, section)}
      className="inline text-left font-semibold text-[color:var(--pe-color-primary-600)] underline decoration-1 underline-offset-2 hover:opacity-80"
    >
      {children}
    </button>
  );
}

// Wraps a wide table so it scrolls sideways on a narrow screen instead of
// widening the page.
export function TableScroll({ className = "", children }) {
  return <div className={`table-scroll overflow-x-auto ${className}`}>{children}</div>;
}

// A compact chart control under a section title: one teal-tinted pill
// reading "Year 2027-28", with a chevron. `options` are { value, label };
// `ariaLabel` names the select when the visible `label` is shortened.
// Several sit in the heading's action slot, in one left-aligned row.
export function PillSelect({ label, ariaLabel, options, value, onChange }) {
  return (
    <label className="relative inline-flex h-8 max-w-full shrink-0 cursor-pointer items-center whitespace-nowrap rounded-full border border-[color:var(--pe-color-primary-200)] bg-[color:var(--pe-color-primary-50)] pl-2.5 pr-6 text-sm transition-colors hover:border-[color:var(--pe-color-primary-400)] focus-within:ring-2 focus-within:ring-[color:var(--pe-color-primary-500)]">
      <span className="mr-1.5 text-[11px] font-medium text-slate-500">{label}</span>
      <select
        aria-label={ariaLabel ?? label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-w-0 max-w-full cursor-pointer appearance-none truncate bg-transparent font-semibold tabular-nums text-[color:var(--pe-color-primary-800)] focus:outline-none"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <svg
        aria-hidden="true"
        viewBox="0 0 12 12"
        className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-[color:var(--pe-color-primary-700)]"
      >
        <path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </label>
  );
}

// The year picker: a PillSelect labelled "Year". `years` are fiscal labels
// or { value, label }.
export function YearPill({ years, value, onChange }) {
  return (
    <PillSelect
      label="Year"
      options={years.map((year) => ({ value: year.value ?? year, label: year.label ?? year }))}
      value={value}
      onChange={onChange}
    />
  );
}
