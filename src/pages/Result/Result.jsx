import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import PageShell from "../../components/PageShell";
import KakaoMap from "../../components/KakaoMap";
import { createCourse } from "../../api/courses";
import { isBackendConfigured } from "../../api/apiClient";
import { getAccessToken, supabase } from "../../lib/supabase";
import {
  getEmailNickname,
  saveSharedCourseMetadata,
} from "../../utils/sharedCourses";
import {
  formatStartLocation,
  UNKNOWN_START_LOCATION,
} from "../../utils/startLocation";
import { sortRunningRecords } from "../../utils/runningRecordSort";
import "./Result.css";

function loadRunningRecords() {
  try {
    const savedRecords = JSON.parse(localStorage.getItem("runningRecords"));

    return Array.isArray(savedRecords)
      ? sortRunningRecords(savedRecords)
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
  const [records, setRecords] = useState(loadRunningRecords);
  const [selectedRecordId, setSelectedRecordId] = useState(null);
  const [startLocations, setStartLocations] = useState({});
  const [visibleRecordCount, setVisibleRecordCount] = useState(10);
  const [sortOrder, setSortOrder] = useState("latest");
  const [shareTarget, setShareTarget] = useState(null);
  const [shareError, setShareError] = useState("");
  const [isSharing, setIsSharing] = useState(false);
  const loadMoreRef = useRef(null);
  const sortedRecords = useMemo(
    () => sortRunningRecords(records, sortOrder),
    [records, sortOrder]
  );

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

  function handleDeleteRecord(record) {
    if (!window.confirm("이 기록을 삭제할까요?\n삭제한 기록은 복구할 수 없습니다.")) {
      return;
    }

    const nextRecords = records.filter((savedRecord) => savedRecord.id !== record.id);
    localStorage.setItem("runningRecords", JSON.stringify(nextRecords));

    try {
      const selectedPacer = JSON.parse(localStorage.getItem("selectedPacerRecord"));

      if (selectedPacer?.id === record.id) {
        localStorage.removeItem("selectedPacerRecord");
      }
    } catch {
      localStorage.removeItem("selectedPacerRecord");
    }

    setRecords(nextRecords);
    setSelectedRecordId(null);
  }

  async function handleConfirmShare() {
    if (!shareTarget || isSharing) {
      return;
    }

    const referencePath = (shareTarget.path ?? [])
      .map((point) => [Number(point.latitude), Number(point.longitude)])
      .filter(([latitude, longitude]) =>
        Number.isFinite(latitude) && Number.isFinite(longitude)
      );

    if (referencePath.length < 2) {
      setShareError("GPS 경로가 있는 기록만 코스로 공유할 수 있어요.");
      return;
    }

    if (!isBackendConfigured || !supabase) {
      setShareError("로그인과 백엔드 연결 후 코스를 공유할 수 있어요.");
      return;
    }

    setIsSharing(true);
    setShareError("");

    try {
      const accessToken = await getAccessToken();
      const { data } = await supabase.auth.getSession();

      if (!accessToken || !data.session?.user) {
        throw new Error("로그인 후 코스를 공유해 주세요.");
      }

      const startLocation = startLocations[shareTarget.id];
      const courseName =
        startLocation &&
        startLocation !== "확인 중" &&
        startLocation !== UNKNOWN_START_LOCATION
          ? `${startLocation} 코스`
          : `${formatDate(shareTarget.startTime)} 러닝 코스`;
      const course = await createCourse({
        accessToken,
        name: courseName,
        referencePath,
      });

      saveSharedCourseMetadata(course.id, {
        creatorName: getEmailNickname(data.session.user.email),
        distance: shareTarget.distance,
        elapsedTime: shareTarget.elapsedTime,
        pace: shareTarget.pace,
        sourceRecordId: shareTarget.id,
      });
      navigate(`/shared-courses?shared=${course.id}`);
    } catch (error) {
      console.error("코스를 공유하지 못했습니다.", error);
      setShareError(error.message || "코스를 공유하지 못했습니다.");
    } finally {
      setIsSharing(false);
    }
  }

  return (
    <PageShell className="result-screen">
      <p className="page-kicker">MY RECORD</p>
      <h1 className="page-title">러닝 기록</h1>
      <p className="page-description">총 {records.length}개의 러닝이 나만의 페이스로 저장되어 있어요.</p>

      <div className="section-heading">
        <h2>전체 러닝</h2>
        <select
          className="result-sort"
          value={sortOrder}
          aria-label="러닝 기록 정렬 방법"
          onChange={(event) => {
            setSortOrder(event.target.value);
            setVisibleRecordCount(10);
            setSelectedRecordId(null);
          }}
        >
          <option value="latest">최신 순</option>
          <option value="pace">페이스 빠른 순</option>
          <option value="distance">거리 긴 순</option>
        </select>
      </div>

      <div className="result-list">
        {/* 서버 기록 목록 API가 추가되기 전까지 로컬 기록을 기준으로 표시한다. */}
        {/* 전체 기록을 먼저 정렬한 뒤 화면에는 10개씩 추가로 표시한다. */}
        {sortedRecords.slice(0, visibleRecordCount).map((record) => {
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
                      <div className="result-detail__top-actions">
                        <span className={`result-detail__status${selectedRecord.serverSynced ? " is-synced" : ""}`}>
                          {selectedRecord.serverSynced ? "서버 저장" : "로컬 기록"}
                        </span>
                        <button
                          className="result-delete-button"
                          type="button"
                          onClick={() => handleDeleteRecord(selectedRecord)}
                        >
                          삭제하기
                        </button>
                        <button
                          className="result-share-button"
                          type="button"
                          onClick={() => {
                            setShareTarget(selectedRecord);
                            setShareError("");
                          }}
                        >
                          공유하기
                        </button>
                      </div>
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

      {shareTarget && (
        <div className="share-dialog-backdrop" role="presentation">
          <section
            className="share-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="share-dialog-title"
          >
            <span className="share-dialog__icon" aria-hidden="true">↗</span>
            <h2 id="share-dialog-title">이 코스를 공유할까요?</h2>
            <p>공유하면 다른 러너들이 이 경로를 보고 도전할 수 있어요.</p>
            {shareError && <p className="share-dialog__error" role="alert">{shareError}</p>}
            <div>
              <button
                className="ghost-button"
                type="button"
                disabled={isSharing}
                onClick={() => setShareTarget(null)}
              >
                취소
              </button>
              <button
                className="primary-button"
                type="button"
                disabled={isSharing}
                onClick={handleConfirmShare}
              >
                {isSharing ? "공유 중..." : "확인"}
              </button>
            </div>
          </section>
        </div>
      )}
    </PageShell>
  );
}

export default Result;
