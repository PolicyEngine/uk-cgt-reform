import { describe, expect, test } from "bun:test";
import results from "../../public/data/cgt_equalisation_results.json";
import {
  PRESETS,
  checkForm,
  formOf,
  initialChoice,
  isPrecomputed,
  precomputedSchedule,
  readUrlState,
  scheduleParams,
} from "./schedule";

const precomputed = precomputedSchedule(results);
const params = (query) => new URLSearchParams(query);
const choice = (query) => initialChoice(params(query), precomputed);

describe("the precomputed schedule", () => {
  test("is the Equalise with income tax preset at the default elasticity", () => {
    const preset = PRESETS.find((candidate) => candidate.id === "income_tax");
    const check = checkForm(formOf(preset.rates, preset.badr));
    expect(isPrecomputed(check, precomputed)).toBe(true);
  });

  test("any changed value makes it a live run", () => {
    const form = formOf(precomputed.rates, precomputed.badr, precomputed.elasticity);
    expect(isPrecomputed(checkForm({ ...form, elasticity: 2.0 }), precomputed)).toBe(false);
    expect(isPrecomputed(checkForm({ ...form, badrForm: { ...form.badrForm, mode: "keep" } }), precomputed)).toBe(false);
    expect(
      isPrecomputed(checkForm({ ...form, percents: { ...form.percents, basic_rate: "21" } }), precomputed),
    ).toBe(false);
  });

  test("an invalid form is never precomputed", () => {
    const form = formOf(precomputed.rates, precomputed.badr);
    expect(isPrecomputed(checkForm({ ...form, percents: { ...form.percents, higher_rate: "" } }), precomputed)).toBe(false);
  });
});

describe("initialChoice", () => {
  test("a plain page load opens Equalise with its precomputed results", () => {
    const opened = choice("");
    expect(opened.policy).toBe("equalise");
    expect(opened.view).toBe("precomputed");
    expect(opened.forms.equalise.percents).toEqual({ basic_rate: "20", higher_rate: "40", additional_rate: "45" });
    expect(opened.forms.equalise.badrForm.mode).toBe("withdraw");
    expect(opened.forms.custom.percents).toEqual({ basic_rate: "18", higher_rate: "24", additional_rate: "24" });
  });

  test("an old Rate explorer link with a schedule opens Custom with it, looked up live", () => {
    const opened = choice("tab=explorer&basic=19&higher=27&additional=31&e=1");
    expect(opened.policy).toBe("custom");
    expect(opened.view).toBe("live");
    expect(opened.forms.custom.percents).toEqual({ basic_rate: "19", higher_rate: "27", additional_rate: "31" });
    expect(opened.forms.custom.badrForm.mode).toBe("keep");
  });

  test("a new link with a schedule opens Custom too", () => {
    const opened = choice("basic=18&higher=30&additional=30&br=10&bl=500000&e=0.5");
    expect(opened.policy).toBe("custom");
    expect(opened.forms.custom.badrForm).toEqual({ mode: "keep", rate: "10", limit: 500000 });
    expect(opened.forms.custom.elasticity).toBe(0.5);
  });

  test("an old Rate explorer link with no schedule opens Custom at current law, with no results", () => {
    const opened = choice("tab=explorer");
    expect(opened.policy).toBe("custom");
    expect(opened.view).toBe("none");
  });

  test("a link to the precomputed schedule shows it at once", () => {
    expect(choice("basic=20&higher=40&additional=45&bw=1&e=1")).toMatchObject({
      policy: "equalise",
      view: "precomputed",
    });
    // From the old tab it keeps Custom open, with the same instant results.
    expect(choice("tab=explorer&basic=20&higher=40&additional=45&bw=1&e=1")).toMatchObject({
      policy: "custom",
      view: "precomputed",
    });
  });

  test("a pre-relief legacy link to 20/40/45 still loads the withdrawn relief", () => {
    // e=-0.7 was the marginal-rate form of the central case.
    expect(readUrlState(params("basic=20&higher=40&additional=45&e=-0.7")).badrForm.mode).toBe("withdraw");
    expect(choice("tab=explorer&basic=20&higher=40&additional=45&e=-0.7").view).toBe("precomputed");
  });

  test("an invalid schedule opens Custom without looking anything up", () => {
    const opened = choice("basic=30&higher=20&additional=45");
    expect(opened.policy).toBe("custom");
    expect(opened.view).toBe("none");
  });
});

describe("scheduleParams", () => {
  const check = checkForm(formOf({ basic_rate: 0.19, higher_rate: 0.27, additional_rate: 0.31 }, null, 1.0));

  test("writes the schedule and retires an old tab=explorer", () => {
    const query = scheduleParams("tab=explorer&dataset=x", check);
    expect(query.get("tab")).toBe(null);
    expect(query.get("basic")).toBe("19");
    expect(query.get("additional")).toBe("31");
    expect(query.get("e")).toBe("1");
    // The relief at current law needs no parameters.
    expect(["bw", "br", "bl"].map((key) => query.get(key))).toEqual([null, null, null]);
  });

  test("keeps another tab and clears the schedule for the precomputed results", () => {
    const query = scheduleParams("tab=baseline&basic=19&higher=27&additional=31&bw=1&e=1", null);
    expect(query.toString()).toBe("tab=baseline");
  });

  test("round-trips through readUrlState", () => {
    const kept = checkForm(formOf({ basic_rate: 0.2, higher_rate: 0.4, additional_rate: 0.45 }, { withdrawn: false, rate: 0.1, lifetime_limit: 10_000_000 }, 3.6));
    const read = readUrlState(scheduleParams("", kept));
    expect(checkForm(read)).toEqual(kept);
  });
});
