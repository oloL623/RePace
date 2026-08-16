import test from "node:test";
import assert from "node:assert/strict";
import {
  createKilometerSplits,
  createSegmentAnalysisSummary,
} from "./runSplits.js";

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

test("백엔드 구간 분석에서 가장 느린 구간과 이전 기록 차이를 찾는다", () => {
  const summary = createSegmentAnalysisSummary([
    { km: 1, pace: 342, ghost_pace: 350, pace_diff: -8 },
    { km: 2, pace: 338, ghost_pace: 345, pace_diff: -7 },
    { km: 3, pace: 372, ghost_pace: 360, pace_diff: 12 },
  ]);

  assert.equal(summary.weakestSegment.km, 3);
  assert.equal(summary.segments[2].paceLabel, "6'12\"");
  assert.equal(summary.segments[2].isWeakest, true);
  assert.equal(summary.hasGhostComparison, true);
  assert.match(summary.coachExample, /이전 기록/);
});
