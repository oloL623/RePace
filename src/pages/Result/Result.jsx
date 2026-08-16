import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import PageShell from "../../components/PageShell";
import KakaoMap from "../../components/KakaoMap";
import {
  formatStartLocation,
  UNKNOWN_START_LOCATION,
} from "../../utils/startLocation";
import "./Result.css";

function loadRunningRecords() {
  try {
    const savedRecords = JSON.parse(localStorage.getItem("runningRecords"));

    // 저장 순서와 관계없이 실제 시작 시각이 가장 최근인 기록을 먼저 보여준다.
    return Array.isArray(savedRecords)
      ? [...savedRecords].sort(
          (first, second) => new Date(second.startTime) - new Date(first.startTime)
        )
      : [];
  } catch (error) {
    console.error("저장된 러닝 기록을 불러오지 못했습니다.", error);
    return [];
  }
}

function formatDate(timestamp) {
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(timestamp));
}

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
}

function formatPace(pace) {
  if (!Number.isFinite(pace)) {
    return "-";
  }

  const minutes = Math.floor(pace);
  const seconds = Math.round((pace - minutes) * 60);

  return `${minutes}'${String(seconds).padStart(2, "0")}`;
}

function getComparisonSummary(currentRecord, previousRecord) {
  if (!currentRecord || !previousRecord) {
    return null;
  }

  const distanceGap = Math.abs(currentRecord.distance - previousRecord.distance);
  const comparableDistance = Math.max(currentRecord.distance, previousRecord.distance, 1);

  // 거리 차이가 큰 러닝은 단순 시간으로 우열을 비교하면 오해할 수 있어 제외한다.
  if (distanceGap / comparableDistance > 0.2) {
    return null;
  }

  const timeDifference = previousRecord.elapsedTime - currentRecord.elapsedTime;
  const absoluteSeconds = Math.abs(Math.round(timeDifference));

  return {
    timeDifference,
    label:
      timeDifference > 0
        ? `${absoluteSeconds}초 단축`
        : timeDifference < 0
          ? `${absoluteSeconds}초 더 걸림`
          : "지난 기록과 동일",
    headline:
      timeDifference > 0
        ? "지난 기록을 넘어섰어요."
        : timeDifference < 0
          ? "지난 기록에 다시 도전했어요."
          : "지난 기록과 나란히 달렸어요.",
  };
}

function Result() {
  const navigate = useNavigate();
  const [records] = useState(loadRunningRecords);
  const [selectedRecordId, setSelectedRecordId] = useState(null);
  const [startLocations, setStartLocations] = useState({});
  const [visibleRecordCount, setVisibleRecordCount] = useState(10);
  const loadMoreRef = useRef(null);

  useEffect(() => {
    let isCancelled = false;
    let timer = null;

    const loadStartLocations = () => {
      if (!window.kakao?.maps) {
        return;
      }

      clearInterval(timer);

      window.kakao.maps.load(() => {
        if (isCancelled || !window.kakao.maps.services) {
          return;
        }

        const geocoder = new window.kakao.maps.services.Geocoder();

        records.forEach((record) => {
          const point = record.path?.[0];

          if (!point) {
            return;
          }

          geocoder.coord2Address(
            point.longitude,
            point.latitude,
            (result, status) => {
              if (isCancelled) {
                return;
              }

              const location =
                status === window.kakao.maps.services.Status.OK
                  ? formatStartLocation(result)
                  : UNKNOWN_START_LOCATION;

              setStartLocations((current) => ({
                ...current,
                [record.id]: location,
              }));
            }
          );
        });
      });
    };

    timer = setInterval(loadStartLocations, 100);
    loadStartLocations();

    return () => {
      isCancelled = true;
      clearInterval(timer);
    };
  }, [records]);

  useEffect(() => {
    const loadMoreTarget = loadMoreRef.current;

    if (!loadMoreTarget || records.length <= 10) {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisibleRecordCount((current) =>
            Math.min(current + 10, records.length)
          );
        }
      },
      { rootMargin: "160px 0px" }
    );

    observer.observe(loadMoreTarget);

    return () => observer.disconnect();
  }, [records.length]);

  if (records.length === 0) {
    return (
      <PageShell className="result-screen">
        <p className="page-kicker">MY RECORD</p>
        <h1 className="page-title">러닝 기록</h1>
        <div className="empty-state">
          <div>
            <span className="result-empty-icon" aria-hidden="true">◴</span>
            <p>아직 저장된 러닝 기록이 없습니다.<br />첫 달리기를 시작해 보세요.</p>
            <button className="primary-button" type="button" onClick={() => navigate("/run-ready")}>
              달리기 준비하기
            </button>
          </div>
        </div>
      </PageShell>
    );
  }

  const selectedRecord = records.find((record) => record.id === selectedRecordId) ?? null;
  const firstPoint = selectedRecord?.path?.[0] ?? null;
  const selectedIndex = records.findIndex((record) => record.id === selectedRecord?.id);
  const previousRecord = selectedIndex >= 0 ? records[selectedIndex + 1] ?? null : null;
  const comparison = getComparisonSummary(selectedRecord, previousRecord);

  function handleSelectRecord(record) {
    setSelectedRecordId((current) => (current === record.id ? null : record.id));
  }

  return (
    <PageShell className="result-screen">
      <p className="page-kicker">MY RECORD</p>
      <h1 className="page-title">러닝 기록</h1>
      <p className="page-description">총 {records.length}개의 러닝이 나만의 페이스로 저장되어 있어요.</p>

      <div className="section-heading">
        <h2>전체 러닝</h2>
      </div>

      <div className="result-list">
        {/* 서버 기록 목록 API가 추가되기 전까지 로컬 기록을 기준으로 표시한다. */}
        {records.slice(0, visibleRecordCount).map((record) => {
          const isSelected = selectedRecord?.id === record.id;
          const location = record.path?.[0]
            ? startLocations[record.id] ?? "확인 중"
            : UNKNOWN_START_LOCATION;

          return (
            <article
              key={record.id}
              className={isSelected ? "result-record is-selected" : "result-record"}
            >
              <button
                className="result-list-card"
                type="button"
                aria-expanded={isSelected}
                onClick={() => handleSelectRecord(record)}
              >
                <div>
                  <strong>{formatDate(record.startTime)}</strong>
                  <span>{location}</span>
                </div>
                <div>
                  <strong>{(record.distance / 1000).toFixed(2)} km</strong>
                  <span>{formatPace(record.pace)} /km</span>
                </div>
              </button>

              {isSelected && (
                <div className="result-record__detail">
                  <div className="result-detail__map">
                    {firstPoint ? (
                      <KakaoMap
                        latitude={firstPoint.latitude}
                        longitude={firstPoint.longitude}
                        path={selectedRecord.path}
                        fitPath
                      />
                    ) : (
                      <div className="result-detail__empty-map">
                        저장된 GPS 경로가 없습니다.
                      </div>
                    )}
                  </div>
                  <div className="result-detail__body">
                    <div className="result-detail__topline">
                      <span>{formatDate(selectedRecord.startTime)}</span>
                      <span className={selectedRecord.serverSynced ? "is-synced" : ""}>
                        {selectedRecord.serverSynced ? "서버 저장" : "로컬 기록"}
                      </span>
                    </div>
                    <div className="result-detail__stats">
                      <div>
                        <span>시간</span>
                        <strong>{formatTime(selectedRecord.elapsedTime)}</strong>
                      </div>
                      <div>
                        <span>거리</span>
                        <strong>{(selectedRecord.distance / 1000).toFixed(2)} km</strong>
                      </div>
                      <div>
                        <span>평균 페이스</span>
                        <strong>{formatPace(selectedRecord.pace)} /km</strong>
                      </div>
                    </div>
                    {comparison && (
                      <p
                        className={
                          comparison.timeDifference >= 0
                            ? "result-detail__comparison is-improved"
                            : "result-detail__comparison is-slower"
                        }
                      >
                        {comparison.headline} {comparison.label}
                      </p>
                    )}
                    <button
                      className={
                        selectedRecord.serverRunId || selectedRecord.aiFeedback
                          ? "result-ai-card"
                          : "result-ai-card is-unavailable"
                      }
                      type="button"
                      onClick={() => navigate(`/ai-coaching?record=${selectedRecord.id}`)}
                    >
                      <span aria-hidden="true">✦</span>
                      <div>
                        <strong>AI 페이스 코칭</strong>
                        <p>
                          {selectedRecord.aiFeedback ||
                            (selectedRecord.serverRunId
                              ? "구간별 페이스와 AI 코칭을 확인해 보세요."
                              : "로컬 기록이에요. AI 코칭 이용 조건을 확인해 보세요.")}
                        </p>
                      </div>
                      <span className="result-ai-card__arrow" aria-hidden="true">›</span>
                    </button>
                    <button
                      className="primary-button full-button"
                      type="button"
                      onClick={() => {
                        localStorage.setItem(
                          "selectedPacerRecord",
                          JSON.stringify(selectedRecord)
                        );
                        navigate("/run-ready");
                      }}
                    >
                      이 기록과 다시 달리기
                    </button>
                  </div>
                </div>
              )}
            </article>
          );
        })}
        <div ref={loadMoreRef} className="result-list__sentinel" aria-hidden="true" />
      </div>
    </PageShell>
  );
}

export default Result;
