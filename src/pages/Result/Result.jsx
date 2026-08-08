import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import KakaoMap from "../../components/KakaoMap";

function Result() {
  const navigate = useNavigate();

  const [records, setRecords] = useState([]);
  const [selectedRecord, setSelectedRecord] =
    useState(null);

  useEffect(() => {
    const savedRecords =
      JSON.parse(
        localStorage.getItem("runningRecords")
      ) || [];

    const reversedRecords = [
      ...savedRecords,
    ].reverse();

    setRecords(reversedRecords);

    // 가장 최근 기록을 기본 선택
    if (reversedRecords.length > 0) {
      setSelectedRecord(
        reversedRecords[0]
      );
    }
  }, []);

  // 기록이 없는 경우
  if (records.length === 0) {
    return (
      <div>
        <h1>Running Records</h1>

        <p>
          저장된 러닝 기록이 없습니다.
        </p>
      </div>
    );
  }

  // 날짜 표시
  function formatDate(timestamp) {
    const date = new Date(timestamp);

    const year =
      date.getFullYear();

    const month =
      String(
        date.getMonth() + 1
      ).padStart(2, "0");

    const day =
      String(
        date.getDate()
      ).padStart(2, "0");

    return `${year}.${month}.${day}`;
  }

  // 러닝 시간 표시
  function formatTime(seconds) {
    const minutes =
      Math.floor(seconds / 60);

    const remainingSeconds =
      seconds % 60;

    return `${minutes}분 ${String(
      remainingSeconds
    ).padStart(2, "0")}초`;
  }

  // 선택한 기록의 첫 번째 좌표
  const firstPoint =
    selectedRecord &&
    selectedRecord.path &&
    selectedRecord.path.length > 0
      ? selectedRecord.path[0]
      : null;

  return (
    <div>
      <h1>Running Records</h1>

      <hr />

      <p>
        총 {records.length}개의 러닝 기록
      </p>

      {/* 기록 목록 */}
      {records.map((record) => (
        <div
          key={record.id}
          onClick={() =>
            setSelectedRecord(record)
          }
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
          <h2>
            {formatDate(
              record.startTime
            )}
          </h2>

          <p>
            총 거리 :{" "}
            {(record.distance / 1000).toFixed(2)}
            km
          </p>

          <p>
            러닝 시간 :{" "}
            {formatTime(
              record.elapsedTime
            )}
          </p>

          <p>
            평균 페이스 :{" "}
            {record.pace
              ? record.pace.toFixed(2)
              : "-"}{" "}
            분/km
          </p>

          <p>
            GPS 경로 :{" "}
            {record.path
              ? record.path.length
              : 0}개 좌표
          </p>

          {/* 이 기록으로 달리기 버튼 */}
          <button
            onClick={(event) => {
              event.stopPropagation();

              localStorage.setItem(
                "selectedPacerRecord",
                JSON.stringify(record)
              );

              navigate("/live-run");
            }}
            style={{
              padding: "10px 16px",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
            }}
          >
            이 기록으로 달리기
          </button>
        </div>
      ))}

      <hr />

      {/* 선택한 기록 지도 */}
      {selectedRecord && (
        <div>
          <h2>
            {formatDate(
              selectedRecord.startTime
            )}{" "}
            러닝 경로
          </h2>

          {firstPoint ? (
            <KakaoMap
              latitude={
                firstPoint.latitude
              }
              longitude={
                firstPoint.longitude
              }
              path={
                selectedRecord.path
              }
            />
          ) : (
            <p>
              저장된 GPS 경로가 없습니다.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default Result;
