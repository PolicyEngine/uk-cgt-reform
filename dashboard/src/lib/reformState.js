// The Reform tab's state, as a reducer so the flow can be tested apart from
// the page: which policy is selected (none on landing), each policy's form,
// which results show, and the schedule they were calculated for. Live runs
// themselves (status, result) stay in useExploration.
import { checkForm, formOf, initialChoice } from "./schedule";

// A schedule's identity: the checked rates, relief and elasticity. Two forms
// that differ only in how a number is typed ("20" and "20.0") are the same.
export function scheduleKey(check) {
  if (!check.rates) return null;
  return JSON.stringify([check.rates, check.badr, check.elasticity]);
}

// The state a page load opens. A plain load selects nothing. A link with a
// schedule (or to the old Rate explorer tab) selects its policy and fills its
// form; one whose schedule is the precomputed one shows those results, and
// any other valid schedule is looked up live (cache only) on mount.
export function initialState(searchParams, precomputed) {
  const choice = initialChoice(searchParams, precomputed);
  const linked = choice.view !== "landing";
  const form = choice.forms[choice.policy];
  return {
    policy: linked ? choice.policy : null,
    forms: choice.forms,
    shown: choice.view === "precomputed" || choice.view === "live" ? choice.view : null,
    calculated: choice.view === "precomputed" || choice.view === "live" ? scheduleKey(checkForm(form)) : null,
  };
}

export function reformReducer(state, action) {
  switch (action.type) {
    // Selecting a policy opens its panel; a tile pressed again (`toggle`)
    // closes it. Either way the results go: they belong to the schedule
    // calculated.
    case "select": {
      const policy = action.toggle && action.policy === state.policy ? null : action.policy;
      return { ...state, policy, shown: null, calculated: null };
    }
    case "edit":
      return { ...state, forms: { ...state.forms, [action.policy]: action.form } };
    // Calculate pressed on a valid form: `shown` is "precomputed" or "live".
    case "calculate":
      return { ...state, shown: action.shown, calculated: scheduleKey(checkForm(state.forms[state.policy])) };
    // A link to equalisation's results: Calculate on its own values.
    case "showEqualisation": {
      const form = formOf(action.precomputed.rates, action.precomputed.badr, action.precomputed.elasticity);
      return {
        ...state,
        policy: "equalise",
        forms: { ...state.forms, equalise: form },
        shown: "precomputed",
        calculated: scheduleKey(checkForm(form)),
      };
    }
    default:
      return state;
  }
}

// Results on show whose schedule no longer matches the selected form.
export function isStale(state) {
  if (!state.shown || !state.policy) return false;
  return scheduleKey(checkForm(state.forms[state.policy])) !== state.calculated;
}
