const EARTH_RADIUS_METERS = 6371000;

function isFiniteNumber(value) {
  return Number.isFinite(value);
}

function clamp(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), maximum);
}

function isValidCoordinate(point) {
  return (
    point &&
    isFiniteNumber(point.latitude) &&
    isFiniteNumber(point.longitude)
  );
}

// 두 GPS 좌표 사이의 직선거리를 미터 단위로 계산한다.
export function calculateDistanceMeters(pointA, pointB) {
  if (!isValidCoordinate(pointA) || !isValidCoordinate(pointB)) {
    return 0;
  }

  const toRadians = (degree) => (degree * Math.PI) / 180;
  const latitudeDelta = toRadians(
    pointB.latitude - pointA.latitude
  );
  const longitudeDelta = toRadians(
    pointB.longitude - pointA.longitude
  );
  const latitudeA = toRadians(pointA.latitude);
  const latitudeB = toRadians(pointB.latitude);

  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(latitudeA) *
      Math.cos(latitudeB) *
      Math.sin(longitudeDelta / 2) ** 2;

  return (
    EARTH_RADIUS_METERS *
    2 *
    Math.atan2(
      Math.sqrt(haversine),
      Math.sqrt(1 - haversine)
    )
  );
}

function getRecordedElapsedSeconds(point, runStartTime) {
  if (isFiniteNumber(point.elapsedSeconds)) {
    return point.elapsedSeconds;
  }

  if (
    isFiniteNumber(point.timestamp) &&
    isFiniteNumber(runStartTime)
  ) {
    return Math.max(0, (point.timestamp - runStartTime) / 1000);
  }

  return null;
}

// 과거 기록을 페이스메이커 계산에 사용할 수 있는 시간순 포인트로 변환한다.
// 예전 기록은 좌표별 시간이 없으므로 전체 경과시간에 맞춰 진행 시간을 추정한다.
export function createPacemakerProfile(pastRun) {
  const sourcePoints = Array.isArray(pastRun?.path)
    ? pastRun.path.filter(isValidCoordinate)
    : [];

  if (sourcePoints.length === 0) {
    return {
      mode: "unavailable",
      points: [],
      totalDistance: 0,
      totalElapsedSeconds: 0,
    };
  }

  let cumulativeDistance = 0;
  const points = sourcePoints.map((point, index) => {
    if (index > 0) {
      cumulativeDistance += calculateDistanceMeters(
        sourcePoints[index - 1],
        point
      );
    }

    const savedDistance = isFiniteNumber(point.cumulativeDistance)
      ? point.cumulativeDistance
      : cumulativeDistance;

    return {
      ...point,
      cumulativeDistance: Math.max(0, savedDistance),
      elapsedSeconds: getRecordedElapsedSeconds(
        point,
        pastRun?.startTime
      ),
    };
  });

  const hasExactTimeline = points.every((point) =>
    isFiniteNumber(point.elapsedSeconds)
  );
  const totalDistance = points.at(-1).cumulativeDistance;
  const savedElapsedSeconds = isFiniteNumber(pastRun?.elapsedTime)
    ? pastRun.elapsedTime
    : 0;

  if (!hasExactTimeline) {
    const estimatedElapsedSeconds =
      savedElapsedSeconds > 0
        ? savedElapsedSeconds
        : isFiniteNumber(pastRun?.pace) && totalDistance > 0
          ? pastRun.pace * 60 * (totalDistance / 1000)
          : 0;

    if (estimatedElapsedSeconds <= 0 || totalDistance <= 0) {
      return {
        mode: "unavailable",
        points: [],
        totalDistance,
        totalElapsedSeconds: 0,
      };
    }

    return {
      mode: "estimated",
      points: points.map((point) => ({
        ...point,
        elapsedSeconds:
          (point.cumulativeDistance / totalDistance) *
          estimatedElapsedSeconds,
      })),
      totalDistance,
      totalElapsedSeconds: estimatedElapsedSeconds,
    };
  }

  let previousElapsedSeconds = 0;
  const exactPoints = points.map((point) => {
    const elapsedSeconds = Math.max(
      previousElapsedSeconds,
      point.elapsedSeconds
    );
    previousElapsedSeconds = elapsedSeconds;

    return {
      ...point,
      elapsedSeconds,
    };
  });

  // 종료 버튼을 누른 시각이 마지막 GPS 수신보다 늦으면 마지막 위치에서 멈춘 시간도 보존한다.
  if (savedElapsedSeconds > exactPoints.at(-1).elapsedSeconds) {
    exactPoints.push({
      ...exactPoints.at(-1),
      elapsedSeconds: savedElapsedSeconds,
    });
  }

  return {
    mode: "exact",
    points: exactPoints,
    totalDistance,
    totalElapsedSeconds: exactPoints.at(-1).elapsedSeconds,
  };
}

function interpolatePointByElapsed(points, elapsedSeconds) {
  if (points.length === 0) {
    return null;
  }

  if (elapsedSeconds <= points[0].elapsedSeconds) {
    return { ...points[0] };
  }

  if (elapsedSeconds >= points.at(-1).elapsedSeconds) {
    return { ...points.at(-1) };
  }

  const nextIndex = points.findIndex(
    (point) => point.elapsedSeconds >= elapsedSeconds
  );
  const previousPoint = points[nextIndex - 1];
  const nextPoint = points[nextIndex];
  const elapsedRange =
    nextPoint.elapsedSeconds - previousPoint.elapsedSeconds;
  const ratio =
    elapsedRange === 0
      ? 0
      : (elapsedSeconds - previousPoint.elapsedSeconds) /
        elapsedRange;

  return {
    latitude:
      previousPoint.latitude +
      (nextPoint.latitude - previousPoint.latitude) * ratio,
    longitude:
      previousPoint.longitude +
      (nextPoint.longitude - previousPoint.longitude) * ratio,
    cumulativeDistance:
      previousPoint.cumulativeDistance +
      (nextPoint.cumulativeDistance -
        previousPoint.cumulativeDistance) *
        ratio,
    elapsedSeconds,
  };
}

function interpolateElapsedByDistance(points, distance) {
  if (points.length === 0) {
    return null;
  }

  if (distance <= points[0].cumulativeDistance) {
    return points[0].elapsedSeconds;
  }

  if (distance >= points.at(-1).cumulativeDistance) {
    return points.at(-1).elapsedSeconds;
  }

  const nextIndex = points.findIndex(
    (point) => point.cumulativeDistance >= distance
  );
  const previousPoint = points[nextIndex - 1];
  const nextPoint = points[nextIndex];
  const distanceRange =
    nextPoint.cumulativeDistance -
    previousPoint.cumulativeDistance;
  const ratio =
    distanceRange === 0
      ? 0
      : (distance - previousPoint.cumulativeDistance) /
        distanceRange;

  return (
    previousPoint.elapsedSeconds +
    (nextPoint.elapsedSeconds - previousPoint.elapsedSeconds) *
      ratio
  );
}

function getDistanceToRoute(currentPosition, routePoints) {
  if (!isValidCoordinate(currentPosition) || routePoints.length === 0) {
    return null;
  }

  return routePoints.reduce(
    (nearestDistance, point) =>
      Math.min(
        nearestDistance,
        calculateDistanceMeters(currentPosition, point)
      ),
    Infinity
  );
}

// 최근 일정 시간 동안 실제로 이동한 거리를 이용해 흔들림이 적은 현재 페이스를 계산한다.
export function calculateRollingPace(
  points,
  currentElapsedSeconds,
  windowSeconds = 30
) {
  if (!Array.isArray(points) || points.length < 2) {
    return null;
  }

  const firstElapsedSeconds = points[0].elapsedSeconds;
  const windowStartSeconds = Math.max(
    firstElapsedSeconds,
    currentElapsedSeconds - windowSeconds
  );
  const startPoint = interpolatePointByElapsed(
    points,
    windowStartSeconds
  );
  const endPoint = interpolatePointByElapsed(
    points,
    currentElapsedSeconds
  );
  const elapsedDifference =
    currentElapsedSeconds - windowStartSeconds;
  const distanceDifference =
    endPoint.cumulativeDistance - startPoint.cumulativeDistance;

  if (elapsedDifference < 5 || distanceDifference < 5) {
    return null;
  }

  return (elapsedDifference / 60) / (distanceDifference / 1000);
}

// 같은 경과시간의 과거 러너와 현재 러너를 거리와 시간 두 기준으로 비교한다.
export function calculatePacemakerComparison({
  profile,
  currentPosition,
  currentDistance,
  currentElapsedSeconds,
}) {
  if (!profile || profile.points.length < 2) {
    return null;
  }

  const ghostPoint = interpolatePointByElapsed(
    profile.points,
    currentElapsedSeconds
  );
  const boundedCurrentDistance = clamp(
    currentDistance,
    0,
    profile.totalDistance
  );
  const pastElapsedAtCurrentDistance = interpolateElapsedByDistance(
    profile.points,
    boundedCurrentDistance
  );

  return {
    mode: profile.mode,
    ghostPosition: {
      latitude: ghostPoint.latitude,
      longitude: ghostPoint.longitude,
    },
    ghostDistance: ghostPoint.cumulativeDistance,
    distanceDifference:
      currentDistance - ghostPoint.cumulativeDistance,
    // 양수면 현재 러너가 같은 지점에 더 빨리 도착했다는 뜻이다.
    timeDifference:
      pastElapsedAtCurrentDistance - currentElapsedSeconds,
    remainingDistance: Math.max(
      0,
      profile.totalDistance - currentDistance
    ),
    routeDistance: getDistanceToRoute(
      currentPosition,
      profile.points
    ),
    ghostPace: calculateRollingPace(
      profile.points,
      currentElapsedSeconds
    ),
  };
}
