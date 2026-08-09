import test from "node:test";
import assert from "node:assert/strict";

import {
  calculateDistanceMeters,
  calculatePacemakerComparison,
  calculateRollingPace,
  createPacemakerProfile,
} from "./pacemaker.js";

const exactRun = {
  startTime: 100000,
  elapsedTime: 120,
  path: [
    {
      latitude: 37,
      longitude: 127,
      elapsedSeconds: 0,
      cumulativeDistance: 0,
    },
    {
      latitude: 37.0005,
      longitude: 127,
      elapsedSeconds: 60,
      cumulativeDistance: 100,
    },
    {
      latitude: 37.001,
      longitude: 127,
      elapsedSeconds: 120,
      cumulativeDistance: 200,
    },
  ],
};

test("같은 좌표의 거리는 0m다", () => {
  const point = { latitude: 37, longitude: 127 };

  assert.equal(calculateDistanceMeters(point, point), 0);
});

test("시간 정보가 있는 기록은 정확 모드로 변환된다", () => {
  const profile = createPacemakerProfile(exactRun);

  assert.equal(profile.mode, "exact");
  assert.equal(profile.totalDistance, 200);
  assert.equal(profile.totalElapsedSeconds, 120);
});

test("현재 러너의 거리와 시간 우위를 계산한다", () => {
  const profile = createPacemakerProfile(exactRun);
  const comparison = calculatePacemakerComparison({
    profile,
    currentPosition: { latitude: 37.0006, longitude: 127 },
    currentDistance: 120,
    currentElapsedSeconds: 60,
  });

  assert.equal(comparison.distanceDifference, 20);
  assert.equal(comparison.timeDifference, 12);
  assert.equal(comparison.remainingDistance, 80);
});

test("좌표별 시간이 없는 기존 기록은 전체 시간으로 추정한다", () => {
  const profile = createPacemakerProfile({
    elapsedTime: 100,
    path: [
      { latitude: 37, longitude: 127 },
      { latitude: 37.001, longitude: 127 },
    ],
  });

  assert.equal(profile.mode, "estimated");
  assert.equal(profile.totalElapsedSeconds, 100);
});

test("최근 이동 기록으로 현재 페이스를 계산한다", () => {
  const pace = calculateRollingPace(exactRun.path, 60, 30);

  assert.ok(Math.abs(pace - 10) < 0.001);
});
