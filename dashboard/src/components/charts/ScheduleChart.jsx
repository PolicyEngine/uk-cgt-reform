"use client";

import { colors } from "../../lib/colors";
import { formatBn } from "../../lib/formatters";
import ChartLogo from "../ChartLogo";
import { HoverTip, useHoverState } from "./ChartTooltip";

// Room past the longest bar for its value label.
const HEADROOM = 1.3;

// Gains recorded on each separately charged schedule, one horizontal bar per
// schedule with its value; a schedule the dataset does not record reads as a
// line of text in place of a bar.
//
// Props:
//   rows: [{ key, label, gainsBn }] — gains in £bn; 0, null or missing means
//     the dataset does not record the schedule.
//   datasetLabel: the dataset's short name, for the "not recorded" text.
export default function ScheduleChart({ rows, datasetLabel = "this dataset" }) {
  const recorded = (r) => Number.isFinite(Number(r.gainsBn)) && Number(r.gainsBn) > 0;
  const hover = useHoverState();
  const max = Math.max(0, ...rows.filter(recorded).map((r) => Number(r.gainsBn))) * HEADROOM || 1;
  return (
    <>
      <div role="list" aria-label="Gains recorded on each schedule">
        {rows.map((row) => {
          const has = recorded(row);
          const value = Number(row.gainsBn);
          const summary = has
            ? `${row.label}: ${formatBn(value)}`
            : `${row.label}: not recorded in ${datasetLabel}`;
          return (
            <div role="listitem" aria-label={summary} key={row.key} className="py-2">
              <p className="mb-1 text-sm font-semibold text-slate-800">{row.label}</p>
              {has ? (
                <div className="flex items-center">
                  <HoverTip
                    as="div"
                    align="start"
                    id={row.key}
                    hover={hover}
                    title={row.label}
                    label="Gains recorded"
                    value={formatBn(value)}
                    color={colors.primary[600]}
                    className="relative h-5 shrink-0 rounded-r"
                    style={{ width: `${(100 * value) / max}%`, background: colors.primary[600] }}
                  />
                  <span aria-hidden="true" className="ml-2 whitespace-nowrap text-xs font-semibold tabular-nums text-slate-900">
                    {formatBn(value)}
                  </span>
                </div>
              ) : (
                <p className="inline-block rounded border border-dashed border-slate-300 px-2 py-1 text-xs text-slate-600">
                  Not recorded in {datasetLabel}: charged on the main schedule
                </p>
              )}
            </div>
          );
        })}
      </div>
      <ChartLogo />
    </>
  );
}
