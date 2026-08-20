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

function toFiniteNumber(value) {
  if (value == null || value === "") {
    return null;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function formatSegmentPace(totalSeconds) {
  const safeSeconds = Math.max(0, Math.round(Number(totalSeconds) || 0));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;

  return `${minutes}'${String(seconds).padStart(2, "0")}"`;
}

// 백엔드의 segment_analysis를 09 AI Coaching 화면에서 바로 쓸 수 있게 정리한다.
export function createSegmentAnalysisSummary(segmentAnalysis) {
  const segments = (Array.isArray(segmentAnalysis) ? segmentAnalysis : [])
    .map((segment, index) => ({
      ...segment,
      km: Number(segment?.km) || index + 1,
      pace: toFiniteNumber(segment?.pace),
      paceDifference: toFiniteNumber(segment?.pace_diff),
      hasGhostPace: toFiniteNumber(segment?.ghost_pace) != null,
    }))
    .filter((segment) => Number.isFinite(segment.pace) && segment.pace > 0)
    .sort((first, second) => first.km - second.km);

  if (segments.length === 0) {
    return {
      segments: [],
      weakestSegment: null,
      comparisonLabel: "구간 분석 대기",
      coachExample: "러닝을 완료하면 구간별 음성 코칭을 안내해 드릴게요.",
      hasGhostComparison: false,
    };
  }

  const fastestPace = Math.min(...segments.map((segment) => segment.pace));
  const slowestPace = Math.max(...segments.map((segment) => segment.pace));
  const paceRange = slowestPace - fastestPace;
  const weakestSegment = segments.length > 1
    ? segments.reduce((weakest, segment) =>
        segment.pace > weakest.pace ? segment : weakest
      )
    : null;
  const paceDifferences = segments
    .map((segment) => segment.paceDifference)
    .filter(Number.isFinite);
  const averageDifference = paceDifferences.length > 0
    ? Math.round(
        paceDifferences.reduce((sum, difference) => sum + difference, 0) /
          paceDifferences.length
      )
    : null;
  const hasGhostComparison = segments.some((segment) => segment.hasGhostPace);
  const comparisonTarget = hasGhostComparison ? "이전 기록" : "이전 구간";

  return {
    segments: segments.map((segment) => ({
      ...segment,
      paceLabel: formatSegmentPace(segment.pace),
      height: paceRange === 0
        ? 76
        : Math.round(52 + ((slowestPace - segment.pace) / paceRange) * 48),
      isWeakest: segment === weakestSegment,
    })),
    weakestSegment,
    hasGhostComparison,
    comparisonLabel:
      averageDifference == null
        ? "구간 분석 완료"
        : averageDifference < 0
          ? `${Math.abs(averageDifference)}초 빠르게 달림`
          : averageDifference > 0
            ? `${averageDifference}초 보완 필요`
            : "안정적인 페이스",
    coachExample:
      averageDifference != null && averageDifference < 0
        ? `지금 페이스를 유지하세요! ${comparisonTarget}보다 ${Math.abs(averageDifference)}초 빠릅니다.`
        : weakestSegment
          ? `${weakestSegment.km}킬로미터 구간이에요. 호흡을 유지하며 페이스를 회복해볼게요.`
          : "지금 리듬을 유지하세요. 안정적인 페이스로 달리고 있어요.",
  };
}
