import test from "node:test";
import assert from "node:assert/strict";
import { createKilometerSplits } from "./runSplits.js";

test("누적 거리의 1km 통과 시각을 보간해 구간 페이스를 만든다", () => {
  const path = [
    { cumulativeDistance: 0, elapsedSeconds: 0 },
    { cumulativeDistance: 800, elapsedSeconds: 240 },
    { cumulativeDistance: 1200, elapsedSeconds: 360 },
    { cumulativeDistance: 2000, elapsedSeconds: 620 },
  ];

  assert.deepEqual(createKilometerSplits(path), [
    { km: 1, pace: 300, cadence: null },
    { km: 2, pace: 320, cadence: null },
  ]);
});

test("1km를 완료하지 않은 기록은 구간 기록을 만들지 않는다", () => {
  const path = [
    { cumulativeDistance: 0, elapsedSeconds: 0 },
    { cumulativeDistance: 900, elapsedSeconds: 300 },
  ];

  assert.deepEqual(createKilometerSplits(path), []);
});
