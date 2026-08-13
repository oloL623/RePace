function toFiniteNumber(value, fallback = 0) {
  const number = Number(value);

  return Number.isFinite(number) ? number : fallback;
}

function normalizePathPoint(point) {
  if (Array.isArray(point)) {
    return {
      latitude: toFiniteNumber(point[0], null),
      longitude: toFiniteNumber(point[1], null),
    };
  }

  return {
    ...point,
    latitude: toFiniteNumber(point?.latitude, null),
    longitude: toFiniteNumber(point?.longitude, null),
  };
}

// 서버의 snake_case 러닝 응답을 기존 localStorage 기록과 같은 형태로 맞춘다.
export function normalizeServerRunRecord(serverRun) {
  const source = serverRun?.run ?? serverRun;

  if (!source || typeof source !== "object") {
    return null;
  }

  const serverRunId = toFiniteNumber(source.id ?? source.run_id, null);
  const distance = toFiniteNumber(
    source.total_distance ?? source.distance
  );
  const elapsedTime = toFiniteNumber(
    source.total_time ?? source.elapsed_time ?? source.elapsedTime
  );
  const sourcePath = source.gps_path ?? source.path ?? [];
  const path = Array.isArray(sourcePath)
    ? sourcePath
        .map(normalizePathPoint)
        .filter(
          (point) =>
            Number.isFinite(point.latitude) &&
            Number.isFinite(point.longitude)
        )
    : [];
  const calculatedPace =
    distance > 0 && elapsedTime > 0
      ? (elapsedTime / 60) / (distance / 1000)
      : null;
  const parsedStartTime = Date.parse(
    source.start_time ?? source.startTime ?? ""
  );

  return {
    recordVersion: 2,
    id: serverRunId == null ? `server-${Date.now()}` : `server-${serverRunId}`,
    serverRunId,
    serverSynced: true,
    startTime: Number.isFinite(parsedStartTime) ? parsedStartTime : Date.now(),
    elapsedTime,
    distance,
    // 서버 필드의 페이스 단위에 의존하지 않고 거리(m)와 시간(초)으로 다시 계산한다.
    pace: calculatedPace,
    path,
  };
}
