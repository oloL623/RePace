function interpolateElapsedSeconds(previousPoint, currentPoint, distance) {
  const distanceRange =
    currentPoint.cumulativeDistance - previousPoint.cumulativeDistance;

  if (distanceRange <= 0) {
    return currentPoint.elapsedSeconds;
  }

  const ratio =
    (distance - previousPoint.cumulativeDistance) / distanceRange;

  return (
    previousPoint.elapsedSeconds +
    (currentPoint.elapsedSeconds - previousPoint.elapsedSeconds) * ratio
  );
}

// 백엔드 분석에 필요한 1km별 페이스(초/km)를 GPS 누적 거리에서 보간한다.
export function createKilometerSplits(path) {
  if (!Array.isArray(path) || path.length < 2) {
    return [];
  }

  const splits = [];
  const totalDistance = path.at(-1)?.cumulativeDistance ?? 0;
  const completedKilometers = Math.floor(totalDistance / 1000);
  let previousCrossingTime = 0;
  let pointIndex = 1;

  for (let kilometer = 1; kilometer <= completedKilometers; kilometer += 1) {
    const targetDistance = kilometer * 1000;

    while (
      pointIndex < path.length &&
      (path[pointIndex].cumulativeDistance ?? 0) < targetDistance
    ) {
      pointIndex += 1;
    }

    const currentPoint = path[pointIndex];
    const previousPoint = path[pointIndex - 1];

    if (!currentPoint || !previousPoint) {
      break;
    }

    const crossingTime = interpolateElapsedSeconds(
      previousPoint,
      currentPoint,
      targetDistance
    );

    splits.push({
      km: kilometer,
      pace: Math.max(0, Math.round(crossingTime - previousCrossingTime)),
      cadence: null,
    });
    previousCrossingTime = crossingTime;
  }

  return splits;
}
