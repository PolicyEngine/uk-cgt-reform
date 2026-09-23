"use client";

// Small controls shared by the analysis tabs.

export function Toggle({ options, value, onChange }) {
  return (
    <div className="inline-flex overflow-hidden rounded-md border border-slate-300 text-sm">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={
            option.value === value
              ? "bg-[color:var(--pe-color-primary-600)] px-3 py-1.5 font-semibold text-white"
              : "bg-white px-3 py-1.5 text-slate-600 hover:bg-slate-50"
          }
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function LabelledSelect({ label, options, value, onChange }) {
  return (
    <label className="inline-flex items-center gap-2 text-sm text-slate-600">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-800"
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

export function MetricCard({ label, value, note }) {
  return (
    <div className="metric-card">
      <p className="text-sm font-semibold leading-snug text-slate-700">{label}</p>
      <p className="mt-1 text-3xl font-bold">{value}</p>
      {note && (
        <p className="mt-2 border-t border-slate-100 pt-2 text-xs leading-5 text-slate-500">
          {note}
        </p>
      )}
    </div>
  );
}

export function TipHeader({ label, tip }) {
  return (
    <th>
      {label}{" "}
      <span className="info-tip" tabIndex={0}>
        i<span className="info-tip-bubble">{tip}</span>
      </span>
    </th>
  );
}
