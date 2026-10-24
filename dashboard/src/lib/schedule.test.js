import { describe, expect, test } from "bun:test";
import results from "../../public/data/cgt_equalisation_results.json";
import {
  PRESETS,
  checkForm,
  elasticityShortName,
  formOf,
  formSummary,
  hasReliefControl,
  initialChoice,
  isPrecomputed,
  precomputedSchedule,
  readUrlState,
  scheduleParams,
  validateElasticity,
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
    expect(isPrecomputed(checkForm({ ...form, elasticity: 2.0, customElasticity: null }), precomputed)).toBe(false);
    expect(isPrecomputed(checkForm({ ...form, customElasticity: "2.5" }), precomputed)).toBe(false);
    expect(isPrecomputed(checkForm({ ...form, badrForm: { ...form.badrForm, mode: "withdraw" } }), precomputed)).toBe(false);
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
  test("a plain page load is the landing view, with both forms at their defaults", () => {
    const opened = choice("");
    expect(opened.view).toBe("landing");
    expect(opened.forms.equalise.percents).toEqual({ basic_rate: "20", higher_rate: "40", additional_rate: "45" });
    expect(opened.forms.equalise.badrForm.mode).toBe("keep");
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
    expect(choice("basic=20&higher=40&additional=45&e=1")).toMatchObject({
      policy: "equalise",
      view: "precomputed",
    });
    // From the old tab it keeps Custom open, with the same instant results.
    expect(choice("tab=explorer&basic=20&higher=40&additional=45&e=1")).toMatchObject({
      policy: "custom",
      view: "precomputed",
    });
  });

  test("a pre-relief legacy link to 20/40/45 loads the equalisation preset's relief", () => {
    // e=-0.7 was the marginal-rate form of the central case.
    expect(readUrlState(params("basic=20&higher=40&additional=45&e=-0.7")).badrForm.mode).toBe("keep");
    expect(choice("tab=explorer&basic=20&higher=40&additional=45&e=-0.7").view).toBe("precomputed");
  });

  test("an invalid schedule opens Custom without looking anything up", () => {
    const opened = choice("basic=30&higher=20&additional=45");
    expect(opened.policy).toBe("custom");
    expect(opened.view).toBe("none");
  });
});

describe("checkForm", () => {
  const form = formOf({ basic_rate: 0.18, higher_rate: 0.24, additional_rate: 0.24 }, null);
  const withPercents = (patch) => checkForm({ ...form, percents: { ...form.percents, ...patch } });

  test("names the input each error belongs to", () => {
    expect(withPercents({ higher_rate: "" }).errorField).toBe("higher_rate");
    expect(withPercents({ basic_rate: "30" }).errorField).toBe("basic_rate");
    expect(withPercents({ additional_rate: "20" }).errorField).toBe("additional_rate");
    expect(withPercents({ basic_rate: "18.5" }).errorField).toBe("basic_rate");
    expect(checkForm({ ...form, badrForm: { ...form.badrForm, rate: "30" } }).errorField).toBe("badr_rate");
    expect(checkForm(form).errorField).toBe(null);
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

  test("clears the schedule for the precomputed results, keeping other parameters", () => {
    const query = scheduleParams("tab=methodology&x=1&basic=19&higher=27&additional=31&bw=1&e=1", null);
    expect(query.toString()).toBe("x=1");
  });

  test("round-trips through readUrlState", () => {
    const kept = checkForm(formOf({ basic_rate: 0.2, higher_rate: 0.4, additional_rate: 0.45 }, { withdrawn: false, rate: 0.1, lifetime_limit: 10_000_000 }, 3.6));
    const read = readUrlState(scheduleParams("", kept));
    expect(checkForm(read)).toEqual(kept);
  });
});

describe("a custom elasticity", () => {
  const base = formOf({ basic_rate: 0.18, higher_rate: 0.3, additional_rate: 0.3 }, null);
  const typed = (value) => checkForm({ ...base, customElasticity: value });

  test("accepts any tenth from 0 to 5 and normalises it", () => {
    expect(validateElasticity("2.5")).toEqual({ elasticity: 2.5 });
    expect(validateElasticity("0")).toEqual({ elasticity: 0 });
    expect(validateElasticity("5")).toEqual({ elasticity: 5 });
    expect(validateElasticity("0.30000000000000004")).toEqual({ elasticity: 0.3 });
    expect(typed("2.5")).toMatchObject({ elasticity: 2.5, errorField: null });
    expect(typed("2.5").rates).not.toBe(null);
  });

  test("refuses an empty, out-of-range or off-step value, and blocks the form", () => {
    for (const value of ["", "abc", "-0.1", "5.1", "2.55"]) {
      const check = typed(value);
      expect(check.errorField).toBe("elasticity");
      expect(check.rates).toBe(null);
      expect(check.error).toBeTruthy();
    }
    expect(typed("5.1").error).toContain("between 0 and 5");
    expect(typed("2.55").error).toContain("0.1");
  });

  test("a typed value equal to a case is that case", () => {
    expect(typed("1.0").elasticity).toBe(1);
    expect(elasticityShortName(typed("1.0").elasticity)).toBe("CenTax central");
    expect(elasticityShortName(2.5)).toBe("Elasticity 2.5");
  });

  test("every form opens on the Custom box, holding its elasticity", () => {
    expect(formOf({ basic_rate: 0.2, higher_rate: 0.4, additional_rate: 0.45 }, null, 2.5).customElasticity).toBe("2.5");
    expect(formOf({ basic_rate: 0.2, higher_rate: 0.4, additional_rate: 0.45 }, null, 2.0).customElasticity).toBe("2.0");
  });

  test("round-trips through the URL, and a bad e falls back to the default", () => {
    const check = typed("2.5");
    const query = scheduleParams("", check);
    expect(query.get("e")).toBe("2.5");
    const read = readUrlState(query);
    expect(read.customElasticity).toBe("2.5");
    expect(checkForm(read)).toEqual(check);
    expect(readUrlState(params("basic=18&higher=30&additional=30&e=7")).elasticity).toBe(1);
    expect(readUrlState(params("basic=18&higher=30&additional=30&e=2.55")).customElasticity).toBe(null);
    expect(readUrlState(params("basic=18&higher=30&additional=30&e=2")).customElasticity).toBe(null);
  });

  test("a link with a custom value opens Custom and looks it up live", () => {
    const opened = choice("basic=20&higher=40&additional=45&bw=1&e=2.5");
    expect(opened).toMatchObject({ policy: "custom", view: "live" });
  });
});

describe("the equalise tile has no relief control", () => {
  test("only Custom rates sets the relief", () => {
    expect(hasReliefControl("equalise")).toBe(false);
    expect(hasReliefControl("custom")).toBe(true);
  });

  test("its one-line summary drops the relief", () => {
    const equalise = choice("").forms.equalise;
    expect(formSummary(equalise, { relief: false })).toBe("20% · 40% · 45% · CenTax central");
    expect(formSummary({ ...equalise, customElasticity: "2.5" }, { relief: false })).toBe(
      "20% · 40% · 45% · Elasticity 2.5",
    );
    // Custom rates keeps it.
    const withdrawn = { ...equalise, badrForm: { ...equalise.badrForm, mode: "withdraw" } };
    expect(formSummary(withdrawn)).toBe("20% · 40% · 45% · Relief withdrawn · CenTax central");
  });

  test("its links never carry relief parameters", () => {
    const equalise = choice("").forms.equalise;
    expect(equalise.badrForm.mode).toBe("keep");
    for (const customElasticity of [null, "2.5"]) {
      const query = scheduleParams("", checkForm({ ...equalise, customElasticity }));
      ["bw", "br", "bl"].forEach((key) => expect(query.get(key)).toBeNull());
    }
  });

  test("an old equalise link with bw=1 opens Custom rates with the relief withdrawn", () => {
    for (const e of ["1", "2.5"]) {
      const opened = choice(`basic=20&higher=40&additional=45&bw=1&e=${e}`);
      expect(opened).toMatchObject({ policy: "custom", view: "live" });
      expect(opened.forms.custom.badrForm.mode).toBe("withdraw");
      expect(opened.forms.equalise.badrForm.mode).toBe("keep");
    }
  });
});
