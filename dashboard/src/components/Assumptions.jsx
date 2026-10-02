"use client";

import {
  scenarioLabel,
  approachLabel,
  scenarioConvention,
} from "../lib/presentation";
import { Toggle } from "./controls";

export function AssumptionSummary({ data, onExplain }) {
  const central = data.sensitivity.find(
    (row) => row.id === data.approach.central_id,
  );
  return (
    <div className="assumption-summary">
      <span>
        <span className="status-dot" />
        {scenarioLabel(central)} central case
      </span>
      <span>{approachLabel(data.approach)}</span>
      {onExplain && (
        <button onClick={onExplain} className="text-link">
          Assumptions ↗
        </button>
      )}
    </div>
  );
}

export default function Assumptions({ data, onChange, onExplain }) {
  const central = data.sensitivity.find(
    (row) => row.id === data.approach.central_id,
  );
  return (
    <details className="assumptions-panel">
      <summary>
        <span>Assumptions</span>
        <span className="font-normal">
          {scenarioLabel(central)} · {approachLabel(data.approach)}
        </span>
      </summary>
      <div className="space-y-3 pt-4">
        <p className="text-sm text-slate-600">
          Central case: {scenarioConvention(central)}. Compare the other cases
          on the overview.
        </p>
        <Toggle
          options={data.approaches.approaches.map((option) => ({
            value: option.id,
            label: approachLabel(option),
          }))}
          value={data.approach.id}
          onChange={onChange}
        />
        <p className="text-sm text-slate-600">
          Including income shifting counts the income tax and National Insurance
          added back for cases measured on gains alone. The household charts do
          not include this addition.
        </p>
        <button className="text-link" onClick={onExplain}>
          How the approaches differ →
        </button>
      </div>
    </details>
  );
}
