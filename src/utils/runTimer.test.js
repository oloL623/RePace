import test from "node:test";
import assert from "node:assert/strict";
import { calculateActiveElapsedSeconds } from "./runTimer.js";

test("일시정지하지 않은 러닝은 시작과 현재 시각의 차이를 반환한다", () => {
  assert.equal(
    calculateActiveElapsedSeconds({ startTime: 1000, currentTime: 61000 }),
    60
  );
});

test("완료된 일시정지 시간을 러닝 시간에서 제외한다", () => {
  assert.equal(
    calculateActiveElapsedSeconds({
      startTime: 1000,
      currentTime: 71000,
      totalPausedMilliseconds: 10000,
    }),
    60
  );
});

test("현재 일시정지 중인 시간도 러닝 시간에서 제외한다", () => {
  assert.equal(
    calculateActiveElapsedSeconds({
      startTime: 1000,
      currentTime: 81000,
      totalPausedMilliseconds: 10000,
      pausedAt: 61000,
    }),
    50
  );
});
