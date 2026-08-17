import test from "node:test";
import assert from "node:assert/strict";
import {
  createRoutePreviewPoints,
  normalizeSharedCourse,
  sortSharedCourses,
} from "./sharedCourses.js";

test("공유 코스 응답을 지도 경로와 내 기록 메타데이터로 변환한다", () => {
  const course = normalizeSharedCourse(
    {
      id: 7,
      name: "한강 코스",
      creator_user_id: "user-1",
      reference_path: [[37.5, 127], [37.501, 127.001]],
    },
    {
      currentUserId: "user-1",
      metadata: {
        7: { creatorName: "runner", distance: 5000, pace: 5.2 },
      },
    }
  );

  assert.equal(course.creatorName, "runner");
  assert.equal(course.distance, 5000);
  assert.equal(course.path.length, 2);
  assert.match(createRoutePreviewPoints(course.path), / /);
});

test("방금 공유한 코스와 내 코스를 다른 코스보다 먼저 정렬한다", () => {
  const courses = [
    { id: 1, creatorUserId: "other", createdAt: "2026-08-17T01:00:00Z" },
    { id: 2, creatorUserId: "me", createdAt: "2026-08-17T02:00:00Z" },
    { id: 3, creatorUserId: "me", createdAt: "2026-08-17T03:00:00Z" },
  ];

  assert.deepEqual(
    sortSharedCourses(courses, {
      currentUserId: "me",
      highlightedCourseId: 2,
    }).map((course) => course.id),
    [2, 3, 1]
  );
});
