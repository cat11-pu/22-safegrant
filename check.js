// check.js：工作向量比较与安全检查
export function fitsWork(need, work) {
  if (!Array.isArray(need) || !Array.isArray(work) || need.length !== work.length) {
    return false;
  }
  for (let at = 0; at < need.length; at += 1) {
    if (need[at] > work[at]) {
      return false;
    }
  }
  return true;
}

export function safetyOf(avail, procs) {
  const work = (avail || []).slice();
  const done = new Array(procs.length).fill(false);
  const seq = [];
  let finished = 0;
  while (finished < procs.length) {
    let pick = -1;
    for (let at = 0; at < procs.length; at += 1) {
      if (!done[at] && fitsWork(procs[at][2], work)) {
        pick = at;
        break;
      }
    }
    if (pick < 0) {
      break;
    }
    done[pick] = true;
    finished += 1;
    const row = procs[pick];
    for (let at = 0; at < work.length; at += 1) {
      work[at] += row[1][at];
    }
    seq.push([row[0], row[1].slice(), row[2].slice()]);
  }
  return [finished === procs.length, seq];
}
