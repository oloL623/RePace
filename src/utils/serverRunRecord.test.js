import test from "node:test";
import assert from "node:assert/strict";
import { normalizeServerRunRecord } from "./serverRunRecord.js";

test("서버 러닝 응답을 프론트 페이스메이커 기록으로 변환한다", () => {
  const record = normalizeServerRunRecord({
    id: 42,
    start_time: "2026-08-13T00:00:00.000Z",
    total_distance: 5000,
    total_time: 1500,
    gps_path: [
      [37.5, 126.9],
      [37.51, 126.91],
    ],
  });

  assert.equal(record.serverRunId, 42);
  assert.equal(record.distance, 5000);
  assert.equal(record.elapsedTime, 1500);
  assert.equal(record.pace, 5);
  assert.deepEqual(record.path[0], {
    latitude: 37.5,
    longitude: 126.9,
  });
});

test("응답 데이터가 없으면 변환하지 않는다", () => {
  assert.equal(normalizeServerRunRecord(null), null);
});
