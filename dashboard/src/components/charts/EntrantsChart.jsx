"use client";

import { colors } from "../../lib/colors";
import { formatBn, formatCount, formatSmallBn } from "../../lib/formatters";
import ChartLogo from "../ChartLogo";

const BEFORE = { label: "Taxpayers before uprating", fill: colors.primary[200] };
const ENTRANTS = { label: "Entrants by uprating", fill: colors.gray[800] };

// The entrants' segment is never narrower than this, so a share of a
// thousandth of a percent still shows as a mark at the end of the bar.
const MIN_SLIVER_PX = 4;

const FORMATS = {
  count: { total: formatCount, part: formatCount },
  bn: { total: (v) => formatBn(v, 2), part: formatSmallBn },
};

// "0.47%", "0.006%", "<0.001%": enough places to show the share's first
// significant figure or two, down to a floor.
export function formatShare(share) {
  if (!Number.isFinite(share)) return "—";
  const pct = share * 100;
  if (pct === 0) return "0%";
  if (pct < 0.001) return "<0.001%";
  if (pct >= 10) return `${pct.toFixed(0)}%`;
  const digits = Math.max(1, Math.min(3, 1 - Math.floor(Math.log10(pct))));
  return `${pct.toFixed(digits)}%`;
}

function Row({ row }) {
  const fmt = FORMATS[row.unit] ?? FORMATS.count;
  const total = Number(row.total);
  const entrants = Number(row.entrants);
  const share = total > 0 ? entrants / total : NaN;
  const before = total - entrants;
  const shareText = formatShare(share);
  const sliverPct = Math.max(0, Math.min(100, share * 100));
  const summary = `${row.label}: ${fmt.total(total)} in all; entrants by uprating ${fmt.part(
    entrants,
  )} (${shareText}); before uprating ${fmt.total(before)}`;
  return (
    <div role="listitem" aria-label={summary} className="border-b border-slate-100 py-3 last:border-b-0">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <p className="text-sm font-semibold text-slate-800">{row.label}</p>
        <p className="text-sm tabular-nums text-slate-700">
          <span className="font-semibold text-slate-900">{fmt.total(total)}</span> in all
        </p>
      </div>
      <div aria-hidden="true" className="mt-1.5 flex h-5 w-full overflow-hidden rounded">
        <div className="h-full flex-1" style={{ background: BEFORE.fill }} />
        <div
          className="h-full"
          style={{
            background: ENTRANTS.fill,
            width: `${sliverPct}%`,
            minWidth: entrants > 0 ? MIN_SLIVER_PX : 0,
          }}
        />
      </div>
      {/* The callout hangs from the sliver at the bar's right-hand end. */}
      <div aria-hidden="true" className="flex flex-col items-end">
        <span className="mr-[1px] block h-2 w-px" style={{ background: colors.gray[500] }} />
        <p className="text-right text-xs leading-5 text-slate-600">
          Entrants{" "}
          <span className="font-semibold tabular-nums text-slate-900">{fmt.part(entrants)}</span>{" "}
          <span className="tabular-nums">({shareText})</span>
          <span className="text-slate-400"> · </span>
          before uprating <span className="tabular-nums">{fmt.total(before)}</span>
        </p>
      </div>
    </div>
  );
}

// Each quantity as one 100% bar, split into taxpayers before uprating and
// the entrants by uprating, with the entrants' share called out.
//
// Props:
//   rows: [{ key, label, unit: "count" | "bn", total, entrants }]
//     `total` covers all CGT taxpayers; `entrants` is the entrants' part of it
//     (people for "count", £bn for "bn").
export default function EntrantsChart({ rows }) {
  return (
    <>
      <ul className="mb-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
        {[BEFORE, ENTRANTS].map((s) => (
          <li key={s.label} className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded-sm" style={{ background: s.fill }} />
            {s.label}
          </li>
        ))}
      </ul>
      <div role="list" aria-label="Entrants by uprating as a share of each total">
        {rows.map((row) => (
          <Row key={row.key} row={row} />
        ))}
      </div>
      <p className="mt-1 text-xs leading-5 text-slate-500">
        The entrants&apos; segment is drawn at least {MIN_SLIVER_PX}px wide so that it stays visible;
        the label gives its true share.
      </p>
      <ChartLogo />
    </>
  );
}
