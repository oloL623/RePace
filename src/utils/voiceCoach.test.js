import test from "node:test";
import assert from "node:assert/strict";

import {
  createComparisonCoachMessage,
  createFinishCoachMessage,
  createProgressCoachMessage,
  formatDistanceForSpeech,
  formatDurationForSpeech,
  formatPaceForSpeech,
  getTimeComparisonState,
} from "./voiceCoach.js";

test("TTS용 거리와 시간을 자연스러운 단위로 변환한다", () => {
  assert.equal(formatDistanceForSpeech(1250), "1 킬로미터 250 미터");
  assert.equal(formatDurationForSpeech(3725), "1시간 2분 5초");
});

test("소수 형태의 페이스를 분과 초로 변환한다", () => {
  assert.equal(formatPaceForSpeech(5.5), "5분 30초");
  assert.equal(formatPaceForSpeech(null), null);
});

test("1초 범위를 기준으로 지난 기록과의 시간 상태를 구분한다", () => {
  assert.equal(getTimeComparisonState(5), "ahead");
  assert.equal(getTimeComparisonState(-5), "behind");
  assert.equal(getTimeComparisonState(1), "even");
});

test("뒤처짐 안내는 무리한 가속 대신 안전한 리듬을 권한다", () => {
  const message = createComparisonCoachMessage({
    timeDifference: -5,
  });

  assert.match(message, /지난번보다 5초 느립니다/);
  assert.match(message, /무리하게 속도를 올리지 말고/);
});

test("앞선 경우 구체적인 시간 차이와 페이스 유지 안내를 제공한다", () => {
  const message = createComparisonCoachMessage({
    timeDifference: 65,
  });

  assert.match(message, /지난번보다 1분 5초 빠릅니다/);
  assert.match(message, /현재 페이스를 유지하면/);
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
