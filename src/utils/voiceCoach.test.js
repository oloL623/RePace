import test from "node:test";
import assert from "node:assert/strict";

import {
  createComparisonCoachMessage,
  createFinishCoachMessage,
  createProgressCoachMessage,
  formatDistanceForSpeech,
  formatDurationForSpeech,
  formatPaceForSpeech,
  getComparisonState,
} from "./voiceCoach.js";

test("TTS용 거리와 시간을 자연스러운 단위로 변환한다", () => {
  assert.equal(formatDistanceForSpeech(1250), "1 킬로미터 250 미터");
  assert.equal(formatDurationForSpeech(3725), "1시간 2분 5초");
});

test("소수 형태의 페이스를 분과 초로 변환한다", () => {
  assert.equal(formatPaceForSpeech(5.5), "5분 30초");
  assert.equal(formatPaceForSpeech(null), null);
});

test("20미터 범위를 기준으로 과거 기록과의 상태를 구분한다", () => {
  assert.equal(getComparisonState(21), "ahead");
  assert.equal(getComparisonState(-21), "behind");
  assert.equal(getComparisonState(20), "even");
});

test("뒤처짐 안내는 무리한 가속 대신 안전한 리듬을 권한다", () => {
  const message = createComparisonCoachMessage({
    distanceDifference: -35,
  });

  assert.match(message, /35 미터 뒤/);
  assert.match(message, /무리하지 말고/);
});

test("이동 경로가 없으면 GPS 확인 안내를 만든다", () => {
  const message = createProgressCoachMessage({
    elapsedSeconds: 300,
    distance: 0,
    currentPace: null,
    averagePace: null,
    comparison: null,
  });

  assert.match(message, /GPS 상태를 확인/);
});

test("종료 안내에 거리와 시간 및 평균 페이스를 포함한다", () => {
  const message = createFinishCoachMessage({
    elapsedSeconds: 600,
    distance: 2000,
    averagePace: 5,
  });

  assert.match(message, /2 킬로미터/);
  assert.match(message, /10분/);
  assert.match(message, /5분 0초/);
});
