import test from "node:test";
import assert from "node:assert/strict";
import { getUndeliveredNativePositions } from "./backgroundLocation.js";

test("백그라운드 좌표는 시간순으로 한 번씩만 전달한다", () => {
  const deliveredKeys = new Set();
  const locations = [
    { latitude: 37.2, longitude: 127.2, timestamp: 2, accuracy: 5 },
    { latitude: 37.1, longitude: 127.1, timestamp: 1, accuracy: 4 },
  ];

  assert.deepEqual(
    getUndeliveredNativePositions(locations, deliveredKeys).map(
      (position) => position.timestamp
    ),
    [1, 2]
  );
  assert.equal(getUndeliveredNativePositions(locations, deliveredKeys).length, 0);
});
