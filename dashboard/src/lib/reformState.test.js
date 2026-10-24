import { describe, expect, test } from "bun:test";
import results from "../../public/data/cgt_equalisation_results.json";
import { initialState, isStale, reformReducer } from "./reformState";
import { precomputedSchedule } from "./schedule";

const precomputed = precomputedSchedule(results);
const load = (query) => initialState(new URLSearchParams(query), precomputed);
const apply = (state, ...actions) => actions.reduce(reformReducer, state);

describe("the Reform tab's flow", () => {
  test("a plain load selects nothing and shows nothing", () => {
    expect(load("")).toMatchObject({ policy: null, shown: null, calculated: null });
  });

  test("selecting a tile opens its panel with no results; pressing it again closes it", () => {
    const opened = apply(load(""), { type: "select", policy: "equalise", toggle: true });
    expect(opened).toMatchObject({ policy: "equalise", shown: null });
    expect(apply(opened, { type: "select", policy: "equalise", toggle: true }).policy).toBe(null);
    // Opened from a link, the same policy stays open.
    expect(apply(opened, { type: "select", policy: "equalise" }).policy).toBe("equalise");
  });

  test("Calculate shows results, and switching policy clears them for good", () => {
    let state = apply(load(""), { type: "select", policy: "equalise", toggle: true }, { type: "calculate", shown: "precomputed" });
    expect(state.shown).toBe("precomputed");
    expect(isStale(state)).toBe(false);
    state = apply(state, { type: "select", policy: "custom", toggle: true });
    expect(state.shown).toBe(null);
    state = apply(state, { type: "select", policy: "equalise", toggle: true });
    expect(state.shown).toBe(null);
  });

  test("editing after Calculate marks the results stale; undoing the edit does not", () => {
    let state = apply(load(""), { type: "select", policy: "equalise", toggle: true }, { type: "calculate", shown: "precomputed" });
    const original = state.forms.equalise;
    state = apply(state, { type: "edit", policy: "equalise", form: { ...original, customElasticity: "2" } });
    expect(isStale(state)).toBe(true);
    expect(state.shown).toBe("precomputed");
    // "20.0" is the same schedule as "20".
    state = apply(state, {
      type: "edit",
      policy: "equalise",
      form: { ...original, percents: { ...original.percents, basic_rate: "20.0" } },
    });
    expect(isStale(state)).toBe(false);
  });

  test("an invalid edit after Calculate is stale", () => {
    let state = apply(load(""), { type: "select", policy: "custom", toggle: true }, { type: "calculate", shown: "live" });
    const form = state.forms.custom;
    state = apply(state, { type: "edit", policy: "custom", form: { ...form, percents: { ...form.percents, basic_rate: "" } } });
    expect(isStale(state)).toBe(true);
  });

  test("a shared schedule link selects Custom and shows its live result", () => {
    const state = load("basic=19&higher=27&additional=31&e=1");
    expect(state).toMatchObject({ policy: "custom", shown: "live" });
    expect(isStale(state)).toBe(false);
  });

  test("a link to the precomputed schedule shows it; an old explorer link alone shows nothing", () => {
    expect(load("basic=20&higher=40&additional=45&e=1")).toMatchObject({ policy: "equalise", shown: "precomputed" });
    expect(load("tab=explorer")).toMatchObject({ policy: "custom", shown: null });
  });

  test("a link to equalisation's results restores its values and shows them", () => {
    let state = apply(load(""), { type: "select", policy: "custom", toggle: true });
    state = apply(state, { type: "edit", policy: "equalise", form: { ...state.forms.equalise, elasticity: 0.5 } });
    state = apply(state, { type: "showEqualisation", precomputed });
    expect(state).toMatchObject({ policy: "equalise", shown: "precomputed" });
    expect(state.forms.equalise.elasticity).toBe(precomputed.elasticity);
    expect(isStale(state)).toBe(false);
  });
});

describe("a custom elasticity in the flow", () => {
  test("keys the schedule by its value, so the same number typed or chosen is one schedule", () => {
    let state = apply(load(""), { type: "select", policy: "custom", toggle: true }, { type: "calculate", shown: "live" });
    const form = state.forms.custom;
    state = apply(state, { type: "edit", policy: "custom", form: { ...form, customElasticity: "2.5" } });
    expect(isStale(state)).toBe(true);
    // The central case typed as "1.0" is the schedule calculated.
    state = apply(state, { type: "edit", policy: "custom", form: { ...form, customElasticity: "1.0" } });
    expect(isStale(state)).toBe(false);
  });
});
