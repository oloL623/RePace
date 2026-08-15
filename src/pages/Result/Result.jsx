import { useState } from "react";
import { useNavigate } from "react-router-dom";
import PageShell from "../../components/PageShell";
import KakaoMap from "../../components/KakaoMap";
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

  return (
    <PageShell className="result-screen">
      <p className="page-kicker">MY RECORD</p>
      <h1 className="page-title">지난 기록을<br />보여드릴게요.</h1>
      <p className="page-description">총 {records.length}개의 러닝이 나만의 페이스로 저장되어 있어요.</p>

      {selectedRecord && (
        <section className="result-highlight">
          <div className="result-highlight__topline">
            <span>{formatDate(selectedRecord.startTime)}</span>
            <span className={selectedRecord.serverSynced ? "is-synced" : ""}>
              {selectedRecord.serverSynced ? "서버 저장" : "로컬 기록"}
            </span>
          </div>
          <div className="result-highlight__time">
            <strong>{formatTime(selectedRecord.elapsedTime)}</strong>
            <span>{(selectedRecord.distance / 1000).toFixed(2)} km</span>
          </div>
          <div className="result-highlight__pace">
            <span>평균 페이스</span>
            <strong>{formatPace(selectedRecord.pace)} /km</strong>
          </div>
          <div className="pace-bars" aria-hidden="true">
            {[44, 68, 56, 82, 72, 92, 64].map((height, index) => (
              <span key={index} style={{ height: `${height}%` }} />
            ))}
          </div>
          <button
            className="primary-button full-button"
            type="button"
            onClick={() => {
              localStorage.setItem("selectedPacerRecord", JSON.stringify(selectedRecord));
              navigate("/run-ready");
            }}
          >
            이 기록과 다시 달리기
          </button>
        </section>
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
            <KakaoMap
              latitude={firstPoint.latitude}
              longitude={firstPoint.longitude}
              path={selectedRecord.path}
            />
          ) : (
            <div className="empty-state">저장된 GPS 경로가 없습니다.</div>
          )}
        </section>
      )}
    </PageShell>
  );
}

export default Result;
