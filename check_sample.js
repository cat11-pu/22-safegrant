import fs from "node:fs";
import { fitsWork, safetyOf } from "./check.js";
import { declare, request, release } from "./model.js";

const __lines = [];
function emit(label, value) {
  __lines.push([String(label), value]);
}

const KEYS = ["total", "procs", "avail", "last_seq", "last_safe", "accepts",
              "rejects", "fails", "declares", "grants", "denies", "releases",
              "checks", "failed"];

const spec = JSON.parse(fs.readFileSync(process.argv[2] || "sample/alloc.json", "utf8"));

function fresh() {
  return JSON.parse(JSON.stringify(spec.state));
}

function fingerprint(state) {
  const out = {};
  for (const key of KEYS) {
    out[key] = state[key];
  }
  return JSON.stringify(out);
}

function feed(state, events) {
  let now = state;
  let bad = 0;
  for (const event of events || []) {
    try {
      if (event.kind === "declare") {
        now = declare(now, event.proc, event.max);
      } else if (event.kind === "request") {
        now = request(now, event.proc, event.vec);
      } else if (event.kind === "release") {
        now = release(now, event.proc, event.vec);
      } else {
        bad += 1;
      }
    } catch (error) {
      bad += 1;
    }
  }
  return [now, bad];
}

const events = spec.events || [];
const run = feed(fresh(), events);
const state = run[0];
const rows = state.procs || [];
const trios = rows.map(function (row) { return [row[0], row[2], row[3]]; });
const verdict = safetyOf(state.avail || [], trios);

let conserve = true;
for (let at = 0; at < (state.total || []).length; at += 1) {
  let held = 0;
  for (const row of rows) {
    held += row[2][at];
  }
  if (state.total[at] !== state.avail[at] + held) {
    conserve = false;
  }
}
let closure = true;
let nonneg = true;
for (const row of rows) {
  for (let at = 0; at < (row[1] || []).length; at += 1) {
    if (row[1][at] !== row[2][at] + row[3][at]) {
      closure = false;
    }
    if (row[1][at] < 0 || row[2][at] < 0 || row[3][at] < 0) {
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
const half = Math.ceil(events.length / 2);
const left = feed(fresh(), events.slice(0, half))[0];
const mid = fingerprint(left);
const right = feed(left, events.slice(half))[0];
const whole = feed(fresh(), events)[0];

emit("资源总量", state.total);
emit("可用", state.avail);
emit("最大需求表", rows.map(function (row) { return [row[0], row[1]]; }));
emit("已分配表", rows.map(function (row) { return [row[0], row[2]]; }));
emit("还需表", rows.map(function (row) { return [row[0], row[3]]; }));
emit("最近安全序列", state.last_seq);
emit("检测判定", !!state.last_safe);
emit("受理账", state.accepts);
emit("拒绝账", state.rejects);
emit("失败账", state.fails);
emit("声明数", state.declares);
emit("受理数", state.grants);
emit("拒绝数", state.denies);
emit("释放数", state.releases);
emit("检查次数", state.checks);
emit("失败数", state.failed);
emit("守恒成立", conserve);
emit("需求闭合", closure);
emit("非负成立", nonneg);
emit("当前状态安全", !!verdict[0]);
emit("次数对账", state.checks === state.grants + unsafeDenies);
emit("重放不新增", fingerprint(whole) === fingerprint(state) ? 0 : 1);
emit("重放报错", feed(fresh(), events)[1]);
emit("中间态不同", mid !== fingerprint(state));
emit("拆两轮一致", fingerprint(right) === fingerprint(whole));

// ---- 异常路径探针：真调用实现，看它报出什么码 ----
try {
  declare(fresh(), "a-1", [1, 1]);
  emit("坏名字报码", "没有报错");
} catch (error) {
  emit("坏名字报码", error && error.code ? error.code : String(error.message));
}
try {
  declare(fresh(), "z9", [1, 1, 1]);
  emit("坏向量报码", "没有报错");
} catch (error) {
  emit("坏向量报码", error && error.code ? error.code : String(error.message));
}
try {
  let one = fresh();
  one = declare(one, "a", [1, 1]);
  declare(one, "a", [1, 1]);
  emit("重复报名报码", "没有报错");
} catch (error) {
  emit("重复报名报码", error && error.code ? error.code : String(error.message));
}
try {
  request(fresh(), "z9", [1, 1]);
  emit("未报名请求报码", "没有报错");
} catch (error) {
  emit("未报名请求报码", error && error.code ? error.code : String(error.message));
}
try {
  let one = fresh();
  one = declare(one, "a", [1, 1]);
  release(one, "a", [1, 0]);
  emit("释放超额报码", "没有报错");
} catch (error) {
  emit("释放超额报码", error && error.code ? error.code : String(error.message));
}
try {
  let one = fresh();
  one = declare(one, "a", [2, 2]);
  one = declare(one, "b", [2, 2]);
  one = request(one, "a", [1, 1]);
  request(one, "b", [1, 1]);
  emit("不安全拒绝报码", "没有报错");
} catch (error) {
  emit("不安全拒绝报码", error && error.code ? error.code : String(error.message));
}

// ---- 期望值（参考模型算出）----
const EXPECTED = {
  "资源总量": [
    2,
    2
  ],
  "可用": [
    1,
    0
  ],
  "最大需求表": [
    [
      "a",
      [
        2,
        2
      ]
    ],
    [
      "b",
      [
        2,
        2
      ]
    ],
    [
      "c",
      [
        1,
        1
      ]
    ]
  ],
  "已分配表": [
    [
      "a",
      [
        0,
        0
      ]
    ],
    [
      "b",
      [
        1,
        2
      ]
    ],
    [
      "c",
      [
        0,
        0
      ]
    ]
  ],
  "还需表": [
    [
      "a",
      [
        2,
        2
      ]
    ],
    [
      "b",
      [
        1,
        0
      ]
    ],
    [
      "c",
      [
        1,
        1
      ]
    ]
  ],
  "最近安全序列": [],
  "检测判定": false,
  "受理账": [
    [
      "a",
      [
        1,
        1
      ],
      [
        "a",
        "b",
        "c"
      ]
    ],
    [
      "a",
      [
        1,
        0
      ],
      [
        "a",
        "b",
        "c"
      ]
    ],
    [
      "b",
      [
        2,
        2
      ],
      [
        "b",
        "a",
        "c"
      ]
    ]
  ],
  "拒绝账": [
    [
      "b",
      "E_UNSAFE"
    ],
    [
      "c",
      "E_NO_AVAIL"
    ],
    [
      "a",
      "E_OVER_NEED"
    ],
    [
      "c",
      "E_UNSAFE"
    ]
  ],
  "失败账": [
    [
      "b",
      "E_DUP_PROC"
    ],
    [
      "z9",
      "E_NO_PROC"
    ]
  ],
  "声明数": 3,
  "受理数": 3,
  "拒绝数": 4,
  "释放数": 2,
  "检查次数": 5,
  "失败数": 2,
  "守恒成立": true,
  "需求闭合": true,
  "非负成立": true,
  "当前状态安全": true,
  "次数对账": true,
  "重放不新增": 0,
  "重放报错": 6,
  "中间态不同": true,
  "拆两轮一致": true,
  "坏名字报码": "E_BAD_NAME",
  "坏向量报码": "E_BAD_VEC",
  "重复报名报码": "E_DUP_PROC",
  "未报名请求报码": "E_NO_PROC",
  "释放超额报码": "E_OVER_ALLOC",
  "不安全拒绝报码": "E_UNSAFE"
};
function __same(got, want) {
  return JSON.stringify(got) === JSON.stringify(want);
}
let __bad = 0;
for (const [label, want] of Object.entries(EXPECTED)) {
  const found = __lines.find((pair) => pair[0] === label);
  if (!found) { __bad += 1; console.log("缺失验收项 " + label); continue; }
  if (__same(found[1], want)) { console.log("一致 " + label + " = " + JSON.stringify(found[1])); }
  else { __bad += 1; console.log("不一致 " + label + " 期望 " + JSON.stringify(want) + " 实际 " + JSON.stringify(found[1])); }
}
console.log("验收项 " + (Object.keys(EXPECTED).length - __bad) + "/" + Object.keys(EXPECTED).length + " 通过");
process.exit(__bad === 0 ? 0 : 1);
