import assert from "node:assert";
import { fitsWork, safetyOf } from "../check.js";
import { declare, request, release } from "../model.js";
import { render } from "../app.js";

const base = {
  state: {
    total: [2, 2], procs: [], avail: [2, 2], last_seq: [], last_safe: false,
    accepts: [], rejects: [], fails: [],
    declares: 0, grants: 0, denies: 0, releases: 0, checks: 0, failed: 0
  },
  events: [{ kind: "declare", proc: "p1", max: [1, 1] }]
};

let failed = 0;
function check(name, fn) {
  try { fn(); console.log("ok " + name); } catch (e) { failed += 1; console.log("FAIL " + name + " :: " + e.message); }
}

check("fitsWork 给布尔", () => {
  assert.strictEqual(typeof fitsWork([1], [1]), "boolean");
});

check("safetyOf 给两元组", () => {
  assert.ok(Array.isArray(safetyOf([1], [])));
  assert.strictEqual(safetyOf([1], []).length, 2);
});

check("declare 返回状态", () => {
  assert.ok(Array.isArray(declare(base.state, "p1", [1, 1]).total));
});

check("request 返回状态", () => {
  assert.ok(Array.isArray(request(base.state, "p1", [1, 1]).avail));
});

check("release 返回状态", () => {
  assert.ok(Array.isArray(release(base.state, "p1", [1, 1]).avail));
});

check("render 给视图", () => {
  assert.strictEqual(typeof render(base).count_events, "number");
});

console.log("6 cases, " + failed + " failed");
process.exit(failed === 0 ? 0 : 1);
