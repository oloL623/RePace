import { calculateDistanceMeters } from "./pacemaker.js";

const SHARED_COURSE_METADATA_KEY = "sharedCourseMetadata";

function toPath(referencePath) {
  return (Array.isArray(referencePath) ? referencePath : [])
    .map(([latitude, longitude]) => ({
      latitude: Number(latitude),
      longitude: Number(longitude),
    }))
    .filter(
      (point) =>
        Number.isFinite(point.latitude) && Number.isFinite(point.longitude)
    );
}

function calculatePathDistance(path) {
  return path.reduce(
    (distance, point, index) =>
      index === 0
        ? 0
        : distance + calculateDistanceMeters(path[index - 1], point),
    0
  );
}

export function getEmailNickname(email) {
  return email?.split("@")[0]?.trim() || "나";
}

export function loadSharedCourseMetadata() {
  try {
    const metadata = JSON.parse(
      localStorage.getItem(SHARED_COURSE_METADATA_KEY)
    );

    return metadata && typeof metadata === "object" ? metadata : {};
  } catch {
    return {};
  }
}

export function saveSharedCourseMetadata(courseId, metadata) {
  const current = loadSharedCourseMetadata();

  localStorage.setItem(
    SHARED_COURSE_METADATA_KEY,
    JSON.stringify({
      ...current,
      [courseId]: metadata,
    })
  );
}

export function normalizeSharedCourse(
  course,
  { currentUserId = null, metadata = {} } = {}
) {
  const path = toPath(course?.reference_path);
  const localMetadata = metadata?.[course?.id] ?? {};
  const isMine = Boolean(
    currentUserId && course?.creator_user_id === currentUserId
  );

  return {
    id: course?.id,
    name: course?.name || "이름 없는 러닝 코스",
    creatorUserId: course?.creator_user_id ?? null,
    creatorName: isMine
      ? localMetadata.creatorName || "나"
      : "다른 러너",
    createdAt: course?.created_at ?? null,
    path,
    distance:
      Number(localMetadata.distance) || calculatePathDistance(path),
    elapsedTime: Number(localMetadata.elapsedTime) || null,
    pace: Number(localMetadata.pace) || null,
    isMine,
  };
}

export function sortSharedCourses(
  courses,
  { currentUserId = null, highlightedCourseId = null } = {}
) {
  return [...courses].sort((first, second) => {
    if (first.id === highlightedCourseId) return -1;
    if (second.id === highlightedCourseId) return 1;

    const firstIsMine = first.creatorUserId === currentUserId;
    const secondIsMine = second.creatorUserId === currentUserId;

    if (firstIsMine !== secondIsMine) {
      return firstIsMine ? -1 : 1;
    }

    return (
      new Date(second.createdAt ?? 0) - new Date(first.createdAt ?? 0) ||
      Number(second.id) - Number(first.id)
    );
  });
}

export function createRoutePreviewPoints(
  path,
  { width = 320, height = 140, padding = 18 } = {}
) {
  if (!Array.isArray(path) || path.length === 0) {
    return "";
  }

  const longitudes = path.map((point) => point.longitude);
  const latitudes = path.map((point) => point.latitude);
  const minimumLongitude = Math.min(...longitudes);
  const maximumLongitude = Math.max(...longitudes);
  const minimumLatitude = Math.min(...latitudes);
  const maximumLatitude = Math.max(...latitudes);
  const longitudeRange = maximumLongitude - minimumLongitude || 1;
  const latitudeRange = maximumLatitude - minimumLatitude || 1;

  return path
    .map((point) => {
      const x =
        padding +
        ((point.longitude - minimumLongitude) / longitudeRange) *
          (width - padding * 2);
      const y =
        padding +
        ((maximumLatitude - point.latitude) / latitudeRange) *
          (height - padding * 2);

      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}
