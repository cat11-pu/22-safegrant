// app.js：把三类事件喂给模块并算出页面要读的视图
import { fitsWork, safetyOf } from "./check.js";
import { declare, request, release } from "./model.js";

const KEYS = ["total", "procs", "avail", "last_seq", "last_safe", "accepts",
              "rejects", "fails", "declares", "grants", "denies", "releases",
              "checks", "failed"];

export function copyState(state) {
  return {
    total: (state.total || []).slice(),
    procs: (state.procs || []).map(function (row) {
      return [row[0], (row[1] || []).slice(), (row[2] || []).slice(), (row[3] || []).slice()];
    }),
    avail: (state.avail || []).slice(),
    last_seq: (state.last_seq || []).slice(),
    last_safe: !!state.last_safe,
    accepts: (state.accepts || []).map(function (row) {
      return [row[0], (row[1] || []).slice(), (row[2] || []).slice()];
    }),
    rejects: (state.rejects || []).map(function (row) { return row.slice(); }),
    fails: (state.fails || []).map(function (row) { return row.slice(); }),
    declares: state.declares || 0,
    grants: state.grants || 0,
    denies: state.denies || 0,
    releases: state.releases || 0,
    checks: state.checks || 0,
    failed: state.failed || 0
  };
}

export function fingerprint(state) {
  const out = {};
  for (const key of KEYS) {
    out[key] = state[key];
  }
  return JSON.stringify(out);
}

export function drive(events, state) {
  let now = state;
  const marks = [];
  for (const event of events || []) {
    try {
      if (event.kind === "declare") {
        now = declare(now, event.proc, event.max);
      } else if (event.kind === "request") {
        now = request(now, event.proc, event.vec);
      } else if (event.kind === "release") {
        now = release(now, event.proc, event.vec);
      } else {
        throw Object.assign(new Error("E_BAD_EVENT"), { code: "E_BAD_EVENT" });
      }
    } catch (error) {
      marks.push([event.kind, error && error.code ? error.code : "E_BAD_EVENT"]);
    }
  }
  return [now, marks];
}

function spread(state) {
  const rows = state.procs || [];
  return {
    total: (state.total || []).slice(),
    avail: (state.avail || []).slice(),
    maxes: rows.map(function (row) { return [row[0], (row[1] || []).slice()]; }),
    allocs: rows.map(function (row) { return [row[0], (row[2] || []).slice()]; }),
    needs: rows.map(function (row) { return [row[0], (row[3] || []).slice()]; })
  };
}

export function render(spec) {
  const start = copyState(spec.state || {});
  const run = drive(spec.events || [], copyState(spec.state || {}));
  const state = run[0];
  const parts = spread(state);
  const procs = (state.procs || []).map(function (row) { return [row[0], row[2], row[3]]; });
  const verdict = safetyOf(state.avail || [], procs);
  let conserve = true;
  for (let at = 0; at < parts.total.length; at += 1) {
    let held = 0;
    for (const row of state.procs || []) {
      held += row[2][at];
    }
    if (parts.total[at] !== state.avail[at] + held) {
      conserve = false;
    }
  }
  let closure = true;
  let nonneg = true;
  for (const row of state.procs || []) {
    for (let at = 0; at < (row[1] || []).length; at += 1) {
      if (row[1][at] !== row[2][at] + row[3][at]) {
        closure = false;
      }
      if (row[2][at] < 0 || row[3][at] < 0) {
        nonneg = false;
      }
      if (row[1][at] < 0) {
        nonneg = false;
      }
    }
  }
  for (const value of state.avail || []) {
    if (value < 0) {
      nonneg = false;
    }
  }
  let unsafeDenies = 0;
  for (const row of state.rejects || []) {
    if (row[1] === "E_UNSAFE") {
      unsafeDenies += 1;
    }
  }
  const events = spec.events || [];
  const half = Math.ceil(events.length / 2);
  const left = drive(events.slice(0, half), copyState(spec.state || {}))[0];
  const right = drive(events.slice(half), copyState(left))[0];
  const again = drive(events, copyState(spec.state || {}))[0];
  return {
    total: parts.total,
    avail: parts.avail,
    maxes: parts.maxes,
    allocs: parts.allocs,
    needs: parts.needs,
    last_seq: (state.last_seq || []).slice(),
    last_safe: !!state.last_safe,
    accepts: state.accepts,
    rejects: state.rejects,
    fails: state.fails,
    declares: state.declares,
    grants: state.grants,
    denies: state.denies,
    releases: state.releases,
    checks: state.checks,
    failed: state.failed,
    conserve: conserve,
    closure: closure,
    nonneg: nonneg,
    safe_now: !!verdict[0],
    checks_ok: state.checks === state.grants + unsafeDenies,
    replay_new: fingerprint(again) === fingerprint(state) ? 0 : 1,
    mid_differs: fingerprint(left) !== fingerprint(state),
    split_equal: fingerprint(right) === fingerprint(again),
    failed_events: run[1].length,
    failed_marks: run[1],
    count_events: events.length
  };
}
