// model.js：声明、请求、释放（基线：一律原样返回）
import { fitsWork, safetyOf } from "./check.js";

export function declare(state, proc, max) {
  return state;
}

export function request(state, proc, vec) {
  return state;
}

export function release(state, proc, vec) {
  return state;
}
