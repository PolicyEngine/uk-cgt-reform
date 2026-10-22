"use client";

import { colors } from "../../lib/colors";

// The one hover tooltip style every chart shares: a small dark rounded card.
// `ChartTooltip` is Recharts tooltip content; `HoverTip` wraps an HTML mark
// (a dot or a bar) so hovering or focusing it shows its label above it.

const CARD = "rounded-md bg-slate-900 px-2.5 py-1.5 text-xs leading-snug text-white shadow";

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

// The card itself: an optional title, then one line per series with its
// swatch, label and value, then an optional bold footer line.
// `rows`: [{ label, value, color? }]; `footer`: { label, value }.
// Narrower on phones: Recharts pins a card that fits neither side of the
// cursor to the plot's left edge, so it must fit within the plot's width.
export function TooltipCard({ title, rows = [], footer }) {
  return (
    <div className={`${CARD} max-w-[min(260px,58vw)]`}>
      {title ? <p className="font-semibold">{title}</p> : null}
      {rows.map((row, i) => (
        <p key={`${row.label}-${i}`} className="mt-0.5 flex items-start gap-2">
          {row.color ? (
            <span
              aria-hidden="true"
              className="mt-[3px] inline-block h-2 w-2 shrink-0 rounded-sm"
              style={{ background: row.color }}
            />
          ) : null}
          <span className="flex-1 text-slate-200">{row.label}</span>
          <span className="whitespace-nowrap font-semibold tabular-nums">{row.value}</span>
        </p>
      ))}
      {footer ? (
        <p className="mt-1 flex justify-between gap-3 border-t border-slate-700 pt-1 font-semibold">
          <span>{footer.label}</span>
          <span className="tabular-nums">{footer.value}</span>
        </p>
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

// An HTML mark that shows `label` above itself on hover or keyboard focus.
// The named group (`group/tip`) keeps an outer `group` (a <details> card,
// say) from opening every tooltip inside it at once. `align` pins the
// bubble's centre, left edge ("start") or right edge ("end") to the mark,
// so a mark near a narrow chart's edge keeps its bubble on screen; long
// labels wrap. `className` positions the mark (default `relative`).
const ALIGN = {
  center: "left-1/2 -translate-x-1/2",
  start: "left-0",
  end: "right-0",
};

export function HoverTip({ label, children, align = "center", className = "relative", style, as: Tag = "span" }) {
  return (
    <Tag tabIndex={0} className={`group/tip cursor-default focus:outline-none ${className}`} style={style}>
      {children}
      <span
        role="tooltip"
        className={`pointer-events-none absolute bottom-full z-10 mb-2 hidden w-max max-w-[18rem] rounded-md bg-slate-900 px-2 py-1 text-xs leading-snug text-white shadow group-hover/tip:block group-focus/tip:block ${ALIGN[align] ?? ALIGN.center}`}
      >
        {label}
      </span>
    </Tag>
  );
}
