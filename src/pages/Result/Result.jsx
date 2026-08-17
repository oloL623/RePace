import { useState } from "react";
import { useNavigate } from "react-router-dom";
import PageShell from "../../components/PageShell";
import KakaoMap from "../../components/KakaoMap";
import { createKilometerSplits } from "../../utils/runSplits";
import "./Result.css";

function loadRunningRecords() {
  try {
    const savedRecords = JSON.parse(localStorage.getItem("runningRecords"));

    return Array.isArray(savedRecords) ? [...savedRecords].reverse() : [];
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

function Result() {
  const navigate = useNavigate();
  const [records] = useState(loadRunningRecords);
  const [selectedRecord, setSelectedRecord] = useState(() => records[0] ?? null);
  const [shareStatus, setShareStatus] = useState("");

  function shareRecord(record) {
    if (!record?.path || record.path.length < 2) {
      setShareStatus("GPS 경로가 2개 이상 기록된 러닝만 코스로 공유할 수 있어요.");
      return;
    }

    const storageKey = "sharedRunningCourses";
    const savedCourses = JSON.parse(localStorage.getItem(storageKey) ?? "[]");
    const courses = Array.isArray(savedCourses) ? savedCourses : [];
    const courseId = `run-course-${record.id}`;
    const nextCourse = {
      id: courseId,
      title: `${formatDate(record.startTime)} 나의 러닝 코스`,
      description: "내가 완주한 GPS 러닝 경로예요.",
      distanceKilometers: Number((record.distance / 1000).toFixed(2)),
      recordTime: formatTime(record.elapsedTime),
      targetPace: `${formatPace(record.pace)}/km`,
      path: record.path,
      sourceRunId: record.id,
      runner: "나",
      isUserShared: true,
    };
    const nextCourses = [nextCourse, ...courses.filter((course) => course.id !== courseId)];
    localStorage.setItem(storageKey, JSON.stringify(nextCourses));
    setShareStatus("내 코스가 공유 코스 목록에 추가됐어요.");
  }

  if (records.length === 0) {
    return (
      <PageShell className="result-screen">
        <p className="page-kicker">MY RECORD</p>
        <h1 className="page-title">지난 기록을<br />보여드릴게요.</h1>
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

  const firstPoint = selectedRecord?.path?.[0] ?? null;
  const previousRecord = records.find((record) => record.id !== selectedRecord?.id) ?? null;
  const timeDifference = previousRecord && selectedRecord
    ? previousRecord.elapsedTime - selectedRecord.elapsedTime
    : null;
  const splits = createKilometerSplits(selectedRecord?.path ?? []);
  const previousSplits = createKilometerSplits(previousRecord?.path ?? []);
  const graphSplits = splits.map((split) => ({
    ...split,
    previousPace: previousSplits.find((previous) => previous.km === split.km)?.pace ?? null,
  }));

  return (
    <PageShell className="result-screen">
      <p className="page-kicker">MY RECORD</p>
      <p className="result-complete">완주 완료</p>
      <h1 className="page-title">{timeDifference != null && timeDifference > 0 ? "지난 기록을\n넘었어요." : "오늘의 러닝을\n완주했어요."}</h1>

      {selectedRecord && (
        <>
          <section className="result-highlight result-comparison">
            <div><span>지난 기록</span><strong>{previousRecord ? formatTime(previousRecord.elapsedTime) : "기록 없음"}</strong></div>
            <div><span>오늘 기록</span><strong>{formatTime(selectedRecord.elapsedTime)}</strong></div>
            {timeDifference != null && <b className={timeDifference > 0 ? "is-green" : "is-orange"}>{timeDifference > 0 ? "↗" : "↘"} {Math.abs(timeDifference)}초 {timeDifference > 0 ? "단축" : "차이"}</b>}
          </section>
          <section className="result-segment-card"><h2>구간별 기록 차이</h2>{graphSplits.length ? <><p>{previousRecord ? "주황색은 지난 기록보다 느린 구간이에요." : "1km별 실제 페이스를 표시했어요."}</p><div className="result-segment-bars">{graphSplits.map((split) => { const isSlower = split.previousPace != null && split.pace > split.previousPace; return <div key={split.km} className={isSlower ? "is-warning" : ""}><i style={{ height: `${Math.max(18, 128 - split.pace / 4)}px` }} /><span>{split.km}km</span></div>; })}</div></> : <p className="result-analysis-empty">GPS 경로가 1km 이상 기록되면 구간별 페이스 분석이 표시돼요.</p>}</section>
        </>
      )}

      {selectedRecord?.aiFeedback && (
        <section className="result-ai-card">
          <span aria-hidden="true">✦</span>
          <div>
            <strong>AI 페이스 코칭</strong>
            <p>{selectedRecord.aiFeedback}</p>
          </div>
        </section>
      )}

      <div className="section-heading">
        <h2>전체 러닝</h2>
      </div>

      <div className="result-list">
        {/* 서버 기록 목록 API가 추가되기 전까지 로컬 기록을 기준으로 표시한다. */}
        {records.map((record) => (
          <button
            key={record.id}
            className={selectedRecord?.id === record.id ? "result-list-card is-selected" : "result-list-card"}
            type="button"
            onClick={() => setSelectedRecord(record)}
          >
            <div>
              <strong>{formatDate(record.startTime)}</strong>
              <span>GPS {record.path?.length ?? 0}개 지점</span>
            </div>
            <div>
              <strong>{(record.distance / 1000).toFixed(2)} km</strong>
              <span>{formatPace(record.pace)} /km</span>
            </div>
          </button>
        ))}
      </div>

      {selectedRecord && (
        <section className="result-map-section">
          <div className="section-heading">
            <h2>러닝 경로</h2>
          </div>
          {firstPoint ? (
            <><KakaoMap
              latitude={firstPoint.latitude}
              longitude={firstPoint.longitude}
              path={selectedRecord.path}
            /><button className="secondary-button full-button result-share-button" type="button" onClick={() => shareRecord(selectedRecord)}>이 경로를 코스로 공유하기</button>{shareStatus && <p className="result-share-status">{shareStatus}</p>}</>
          ) : (
            <div className="empty-state">저장된 GPS 경로가 없습니다.</div>
          )}
        </section>
      )}
      {!selectedRecord?.aiFeedback && <section className="result-ai-card"><span aria-hidden="true">✦</span><div><strong>AI 한 줄 코칭</strong><p>{graphSplits.length ? "서버 AI 분석이 완료되면 상세 코칭이 표시돼요." : "GPS 경로가 쌓이면 페이스 분석을 시작할 수 있어요."}</p></div></section>}
      <button className="primary-button result-goal-button" type="button" onClick={() => navigate("/ai-coaching")}>구간별 AI 코칭 보기</button>

      <button className="secondary-button full-button result-courses-button" type="button" onClick={() => navigate("/shared-courses")}>
        러너들의 코스 둘러보기
      </button>
    </PageShell>
  );
}

export default Result;


