// The one legend every chart uses, placed directly below the plot (above the
// ChartLogo). Centred, text-xs slate, 12px markers.
//
// `items`: [{ label, fill, marker?, opacity?, stroke?, dashed? }] where
// `marker` is "bar" (a rounded square, the default), "dot", "ring" or "diamond";
// `stroke`/`dashed` outline a bar marker (e.g. a dashed derived series).
// `className` adds to the list's classes.
export default function ChartLegend({ items, className = "" }) {
  if (!items?.length) return null;
  return (
    <ul className={`mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-slate-600 ${className}`}>
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-1.5">
          <LegendMarker {...item} />
          {item.label}
        </li>
      ))}
    </ul>
  );
}

function LegendMarker({ marker = "bar", fill, opacity, stroke, dashed }) {
  if (marker === "dot") {
    return <span className="inline-block h-3 w-3 shrink-0 rounded-full" style={{ background: fill, opacity }} />;
  }
  if (marker === "ring") {
    return <span className="inline-block h-3 w-3 shrink-0 rounded-full" style={{ border: `2px solid ${fill}`, opacity }} />;
  }
  if (marker === "diamond") {
    return (
      <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" className="shrink-0">
        <path d="M6 0.5 L11.5 6 L6 11.5 L0.5 6 Z" fill={fill} opacity={opacity} />
      </svg>
    );
  }
  return (
    <span
      className="inline-block h-3 w-3 shrink-0 rounded-sm"
      style={{
        background: fill,
        opacity,
        border: stroke ? `1.5px ${dashed ? "dashed" : "solid"} ${stroke}` : undefined,
      }}
    />
  );
}
