import test from "node:test";
import assert from "node:assert/strict";

import {
  isValidTargetDistanceInput,
  parseTargetPaceMinutes,
} from "./runPreferences.js";

test("목표 거리는 빈 값 또는 정수·소수 각각 두 자리까지만 허용한다", () => {
  assert.equal(isValidTargetDistanceInput(""), true);
  assert.equal(isValidTargetDistanceInput("12.34"), true);
  assert.equal(isValidTargetDistanceInput(".5"), false);
  assert.equal(isValidTargetDistanceInput("123"), false);
  assert.equal(isValidTargetDistanceInput("12.345"), false);
});

test("분과 초 입력을 기존 소수형 페이스로 변환한다", () => {
  assert.equal(parseTargetPaceMinutes("6", "00"), 6);
  assert.equal(parseTargetPaceMinutes("5", "30"), 5.5);
  assert.equal(parseTargetPaceMinutes("5", "60"), null);
});
