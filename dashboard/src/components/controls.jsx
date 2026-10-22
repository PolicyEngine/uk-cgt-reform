"use client";

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

// A chart control: a small label above a compact select. Several sit side
// by side in a row of equal columns.
export function LabelledSelect({ label, options, value, onChange }) {
  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`${FIELD} ${fieldBorder()} h-10 w-full min-w-0 pr-8 text-sm`}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function YearSelect({ years, value, onChange }) {
  return (
    <LabelledSelect
      label="Year"
      options={years.map((year) => ({ value: year, label: year }))}
      value={value}
      onChange={onChange}
    />
  );
}

export function MetricCard({ label, value, note, tip }) {
  return (
    <Card as="div" variant="inset">
      <div className="flex items-start gap-2">
        <p className="text-sm font-semibold leading-snug text-slate-700">{label}</p>
        {tip ? <InfoTip label={`About ${label.toLowerCase()}`}>{tip}</InfoTip> : null}
      </div>
      <p className="mt-1 text-3xl font-bold tabular-nums text-slate-900">{value}</p>
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

// Longer explanations for a section, collapsed under its content.
export function Notes({ children, className = "" }) {
  return (
    <details className={`group mt-4 border-t border-slate-200 pt-3 ${className}`}>
      <summary className="cursor-pointer select-none text-sm font-semibold text-slate-600 marker:text-[color:var(--pe-color-primary-600)]">
        Notes
      </summary>
      <div className="mt-2 space-y-2 text-sm leading-6 text-slate-600">{children}</div>
    </details>
  );
}

// An external source, opened in a new tab.
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
