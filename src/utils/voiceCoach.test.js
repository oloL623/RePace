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
  selectPreferredKoreanVoice,
} from "./voiceCoach.js";

test("TTS용 거리와 시간을 자연스러운 단위로 변환한다", () => {
  assert.equal(formatDistanceForSpeech(1250), "1 킬로미터 250 미터");
  assert.equal(formatDurationForSpeech(3725), "1시간 2분 5초");
});

test("소수 형태의 페이스를 분과 초로 변환한다", () => {
  assert.equal(formatPaceForSpeech(5.5), "5분 30초");
  assert.equal(formatPaceForSpeech(null), null);
});

test("기본 한국어 음성보다 기기의 자연음 계열을 우선 선택한다", () => {
  const basicVoice = { name: "기본 한국어", lang: "ko-KR" };
  const naturalVoice = {
    name: "Microsoft SunHi Online (Natural)",
    lang: "ko-KR",
  };

  assert.equal(
    selectPreferredKoreanVoice([basicVoice, naturalVoice]),
    naturalVoice
  );
});

test("iOS에서는 Siri 음성 2를 우선하고 없으면 Siri 음성 1을 선택한다", () => {
  const rockoVoice = { name: "Rocko", lang: "ko-KR" };
  const siriVoice1 = { name: "Siri Voice 1", lang: "ko-KR" };
  const siriVoice2 = { name: "Siri 음성 2", lang: "ko-KR" };

  assert.equal(
    selectPreferredKoreanVoice([rockoVoice, siriVoice1, siriVoice2]),
    siriVoice2
  );
  assert.equal(
    selectPreferredKoreanVoice([rockoVoice, siriVoice1]),
    siriVoice1
  );
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

  assert.match(message, /지난번보다 5초 늦어요/);
  assert.match(message, /무리하지 말고/);
});

test("앞선 경우 구체적인 시간 차이와 페이스 유지 안내를 제공한다", () => {
  const message = createComparisonCoachMessage({
    timeDifference: 65,
  });

  assert.match(message, /지난번보다 1분 5초 빨라요/);
  assert.match(message, /지금 리듬 그대로/);
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

test("종료 수치 안내는 고정 시작·마무리 음성을 중복하지 않는다", () => {
  const message = createFinishCoachMessage({
    elapsedSeconds: 600,
    distance: 2000,
    averagePace: 5,
  });

  assert.match(message, /2 킬로미터/);
  assert.match(message, /10분/);
  assert.match(message, /5분 0초/);
  assert.doesNotMatch(message, /오늘 러닝을 마쳤어요/);
  assert.doesNotMatch(message, /수고 많았어요/);
});
