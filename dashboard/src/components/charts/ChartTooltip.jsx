"use client";

import { useState } from "react";
import { colors } from "../../lib/colors";

// The one hover tooltip every chart shares: a small white card with a bold
// title line and a swatch + "label: value" line per series. `ChartTooltip`
// and `TooltipCard` are Recharts content; `HoverTip` is an HTML mark (a dot
// or a bar) that shows its card while hovered or focused. Tooltips are
// driven by React state, never by CSS `group-hover`, so only the hovered
// mark's card is ever on screen.

const CARD = "rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg";
// Marks other than the hovered one fade to this opacity.
export const FADED = 0.55;

// A subtle band behind the hovered category, and the props every Recharts
// <Tooltip> passes, so the card is never clipped by a short row chart and
// sits above the rows below it.
export const TOOLTIP_CURSOR = { fill: colors.gray[100], fillOpacity: 0.7 };
export const TOOLTIP_PROPS = {
  cursor: TOOLTIP_CURSOR,
  isAnimationActive: false,
  allowEscapeViewBox: { x: false, y: true },
  wrapperStyle: { zIndex: 30, outline: "none" },
};

function Line({ label, value, color }) {
  return (
    <span className="mt-0.5 flex items-start gap-1.5 text-slate-600">
      {color ? (
        <span aria-hidden="true" className="mt-[3px] inline-block h-2 w-2 shrink-0 rounded-sm" style={{ background: color }} />
      ) : (
        <span aria-hidden="true" className="inline-block w-2 shrink-0" />
      )}
      <span>
        {label}: <span className="whitespace-nowrap font-semibold tabular-nums text-slate-900">{value}</span>
      </span>
    </span>
  );
}

// The card: an optional bold title, then one line per series, then an
// optional bold footer line. `rows`: [{ label, value, color? }]; `footer`:
// { label, value }. Narrower on phones: Recharts pins a card that fits
// neither side of the cursor to the plot's left edge, so it must fit within
// the plot's width.
export function TooltipCard({ title, rows = [], footer }) {
  return (
    <div className={`${CARD} max-w-[min(260px,58vw)]`}>
      {title ? <span className="block font-semibold text-slate-800">{title}</span> : null}
      {rows.map((row, i) => (
        <Line key={`${row.label}-${i}`} {...row} />
      ))}
      {footer ? (
        <span className="mt-1 flex justify-between gap-3 border-t border-slate-100 pt-1 font-semibold text-slate-900">
          <span>{footer.label}</span>
          <span className="tabular-nums">{footer.value}</span>
        </span>
      ) : null}
    </div>
  );
}

// Recharts content: `title(label, payload)` names the hovered category
// (default: the axis label); `rows(payload)` lists its lines (default: each
// series' name and value, formatted with `format`).
export default function ChartTooltip({ active, payload, label, title, rows, footer, format = String }) {
  if (!active || !payload?.length) return null;
  const lines = rows
    ? rows(payload)
    : payload.map((p) => ({ label: p.name, value: format(p.value), color: p.color ?? p.fill }));
  if (!lines?.length) return null;
  return (
    <TooltipCard
      title={title ? title(label, payload) : label}
      rows={lines}
      footer={footer ? footer(payload) : undefined}
    />
  );
}

// The hovered mark of one chart: `const hover = useHoverState()`, then pass
// `hover` and a unique `id` to each HoverTip in that chart.
export function useHoverState() {
  const [active, setActive] = useState(null);
  return { active, setActive };
}

// Where the card sits over its mark: centred, from the mark's left edge
// ("start") or ending at its right edge ("end"), so a mark near a narrow
// chart's edge keeps its card on screen.
const ALIGN = {
  center: "left-1/2 -translate-x-1/2",
  start: "left-0",
  end: "right-0",
};

// An HTML mark with a hover/focus tooltip: `title` (bold) above a swatch in
// `color` and "`label`: `value`". With `hover` (from useHoverState) and an
// `id`, only one mark per chart shows its card and the rest fade; without
// it the mark keeps its own state. `className` positions the mark (default
// `relative`); `as` picks the tag; `ariaLabel` names it for screen readers.
// `rows` ([{ label, value, color? }]) replaces the single line when a mark
// needs to name more than one value.
export function HoverTip({
  id = "mark",
  hover,
  title,
  label,
  value,
  color,
  rows,
  align = "center",
  className = "relative",
  style,
  ariaLabel,
  as: Tag = "span",
  children,
}) {
  const own = useHoverState();
  const state = hover ?? own;
  const isActive = state.active === id;
  const faded = state.active !== null && !isActive;
  const show = () => state.setActive(id);
  const hide = () => state.setActive((cur) => (cur === id ? null : cur));
  return (
    <Tag
      tabIndex={0}
      aria-label={ariaLabel ?? `${title ? `${title}, ` : ""}${label}: ${value}`}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
      className={`cursor-default focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--pe-color-primary-500)] ${className}`}
      style={{ ...style, opacity: faded ? FADED : 1, zIndex: isActive ? 20 : style?.zIndex }}
    >
      {children}
      {isActive ? (
        <span
          role="tooltip"
          className={`pointer-events-none absolute bottom-full z-20 mb-1.5 w-max max-w-[18rem] ${CARD} ${ALIGN[align] ?? ALIGN.center}`}
        >
          {title ? <span className="block font-semibold text-slate-800">{title}</span> : null}
          {(rows ?? [{ label, value, color }]).map((row, i) => (
            <Line key={`${row.label}-${i}`} {...row} />
          ))}
        </span>
      ) : null}
    </Tag>
  );
}
