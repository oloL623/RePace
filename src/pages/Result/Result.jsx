import { useState } from "react";
import { useNavigate } from "react-router-dom";
import KakaoMap from "../../components/KakaoMap";

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
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(timestamp));
}

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  return `${minutes}분 ${String(remainingSeconds).padStart(2, "0")}초`;
}

function formatPace(pace) {
  if (!Number.isFinite(pace)) {
    return "-";
  }

  const minutes = Math.floor(pace);
  const seconds = Math.round((pace - minutes) * 60);

  return `${minutes}:${String(seconds).padStart(2, "0")} 분/km`;
}

function Result() {
  const navigate = useNavigate();
  const [records] = useState(loadRunningRecords);
  const [selectedRecord, setSelectedRecord] = useState(
    () => records[0] ?? null
  );

  if (records.length === 0) {
    return (
      <main>
        <h1>러닝 기록</h1>
        <p>저장된 러닝 기록이 없습니다.</p>
      </main>
    );
  }

  const firstPoint = selectedRecord?.path?.[0] ?? null;

  return (
    <main>
      <h1>러닝 기록</h1>
      <p>총 {records.length}개의 러닝 기록</p>

      {/* 서버 API에 기록 목록이 추가되기 전까지 로컬 기록을 기준으로 표시한다. */}
      {records.map((record) => (
        <article
          key={record.id}
          onClick={() => setSelectedRecord(record)}
          style={{
            border:
              selectedRecord?.id === record.id
                ? "2px solid #007AFF"
                : "1px solid #ddd",
            borderRadius: "12px",
            padding: "16px",
            marginBottom: "12px",
            cursor: "pointer",
          }}
        >
          <h2>{formatDate(record.startTime)}</h2>
          <p>총 거리 : {(record.distance / 1000).toFixed(2)} km</p>
          <p>러닝 시간 : {formatTime(record.elapsedTime)}</p>
          <p>평균 페이스 : {formatPace(record.pace)}</p>
          <p>GPS 경로 : {record.path?.length ?? 0}개 좌표</p>
          <p>
            서버 저장 : {record.serverSynced ? "완료" : "로컬 기록"}
          </p>

          {record.aiFeedback && (
            <section>
              <h3>🤖 AI 러닝 분석</h3>
              <p>{record.aiFeedback}</p>
            </section>
          )}

          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              localStorage.setItem(
                "selectedPacerRecord",
                JSON.stringify(record)
              );
              navigate("/live-run");
            }}
          >
            이 기록과 다시 달리기
          </button>
        </article>
      ))}

      <hr />

      {selectedRecord && (
        <section>
          <h2>{formatDate(selectedRecord.startTime)} 러닝 경로</h2>
          {firstPoint ? (
            <KakaoMap
              latitude={firstPoint.latitude}
              longitude={firstPoint.longitude}
              path={selectedRecord.path}
            />
          ) : (
            <p>저장된 GPS 경로가 없습니다.</p>
          )}
        </section>
      )}
    </main>
  );
}

export default Result;
