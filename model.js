// model.js：声明、请求、释放（原地改状态并返回；拒绝/失败记账后抛错）
import { safetyOf } from "./check.js";

const NAME_RE = /^[A-Za-z0-9]{1,6}$/;

function raise(code) {
  throw Object.assign(new Error(code), { code });
}

function validName(proc) {
  return typeof proc === "string" && NAME_RE.test(proc);
}

function validVec(vec, width) {
  return Array.isArray(vec) && vec.length === width &&
    vec.every((value) => Number.isInteger(value) && value >= 0);
}

function findRow(state, proc) {
  return state.procs.findIndex((row) => row[0] === proc);
}

function fail(state, proc, code) {
  state.fails.push([proc, code]);
  state.failed += 1;
  raise(code);
}

function deny(state, proc, code) {
  state.rejects.push([proc, code]);
  state.denies += 1;
  raise(code);
}

export function declare(state, proc, max) {
  if (!validName(proc)) {
    fail(state, proc, "E_BAD_NAME");
  }
  if (!validVec(max, state.total.length)) {
    fail(state, proc, "E_BAD_VEC");
  }
  if (findRow(state, proc) >= 0) {
    fail(state, proc, "E_DUP_PROC");
  }
  state.procs.push([proc, max.slice(), max.map(() => 0), max.slice()]);
  state.declares += 1;
  return state;
}

export function request(state, proc, vec) {
  if (!validName(proc)) {
    fail(state, proc, "E_BAD_NAME");
  }
  if (!validVec(vec, state.total.length)) {
    fail(state, proc, "E_BAD_VEC");
  }
  const idx = findRow(state, proc);
  if (idx < 0) {
    fail(state, proc, "E_NO_PROC");
  }
  const row = state.procs[idx];
  if (vec.some((value, at) => value > row[3][at])) {
    deny(state, proc, "E_OVER_NEED");
  }
  if (vec.some((value, at) => value > state.avail[at])) {
    deny(state, proc, "E_NO_AVAIL");
  }
  for (let at = 0; at < vec.length; at += 1) {
    state.avail[at] -= vec[at];
    row[2][at] += vec[at];
    row[3][at] -= vec[at];
  }
  const trios = state.procs.map((item) => [item[0], item[2], item[3]]);
  const verdict = safetyOf(state.avail, trios);
  const safe = verdict[0];
  const seq = verdict[1].map((item) => item[0]);
  state.last_safe = safe;
  state.last_seq = seq;
  state.checks += 1;
  if (!safe) {
    for (let at = 0; at < vec.length; at += 1) {
      state.avail[at] += vec[at];
      row[2][at] -= vec[at];
      row[3][at] += vec[at];
    }
    deny(state, proc, "E_UNSAFE");
  }
  state.accepts.push([proc, vec.slice(), seq]);
  state.grants += 1;
  return state;
}

export function release(state, proc, vec) {
  if (!validName(proc)) {
    fail(state, proc, "E_BAD_NAME");
  }
  if (!validVec(vec, state.total.length)) {
    fail(state, proc, "E_BAD_VEC");
  }
  const idx = findRow(state, proc);
  if (idx < 0) {
    fail(state, proc, "E_NO_PROC");
  }
  const row = state.procs[idx];
  if (vec.some((value, at) => value > row[2][at])) {
    fail(state, proc, "E_OVER_ALLOC");
  }
  for (let at = 0; at < vec.length; at += 1) {
    state.avail[at] += vec[at];
    row[2][at] -= vec[at];
    row[3][at] += vec[at];
  }
  state.releases += 1;
  return state;
}
