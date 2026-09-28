// check.js：工作向量比较与安全检查（基线：一律判不安全、给空序列）
export function fitsWork(need, work) {
  return false;
}

export function safetyOf(avail, procs) {
  return [false, []];
}
