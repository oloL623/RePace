import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getCourse } from "../../api/courses";
import { isBackendConfigured } from "../../api/apiClient";
import { supabase } from "../../lib/supabase";
import KakaoMap from "../../components/KakaoMap";
import PageShell from "../../components/PageShell";
import { loadRunPreferences } from "../../utils/runPreferences";
import {
  loadSharedCourseMetadata,
  normalizeSharedCourse,
} from "../../utils/sharedCourses";
import "./SharedCourseDetail.css";

function formatPace(pace) {
  if (!Number.isFinite(pace)) return "-";

  const minutes = Math.floor(pace);
  const seconds = Math.round((pace - minutes) * 60);
  return `${minutes}'${String(seconds).padStart(2, "0")}"/km`;
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return "-";

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);
  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
}

function SharedCourseDetail() {
  const navigate = useNavigate();
  const { courseId } = useParams();
  const [rawCourse, setRawCourse] = useState(null);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [status, setStatus] = useState(
    isBackendConfigured ? "loading" : "unavailable"
  );
  const metadata = useMemo(() => loadSharedCourseMetadata(), []);
  const course = useMemo(
    () =>
      rawCourse
        ? normalizeSharedCourse(rawCourse, { currentUserId, metadata })
        : null,
    [currentUserId, metadata, rawCourse]
  );

  useEffect(() => {
    const numericCourseId = Number(courseId);
    let isActive = true;

    supabase?.auth.getSession().then(({ data }) => {
      if (isActive) {
        setCurrentUserId(data.session?.user?.id ?? null);
      }
    });

    if (!isBackendConfigured || !Number.isInteger(numericCourseId)) {
      return () => {
        isActive = false;
      };
    }

    getCourse(numericCourseId)
      .then((courseData) => {
        if (isActive) {
          setRawCourse(courseData);
          setStatus("ready");
        }
      })
      .catch((error) => {
        if (isActive) {
          console.error("공유 코스를 불러오지 못했습니다.", error);
          setStatus("error");
        }
      });

    return () => {
      isActive = false;
    };
  }, [courseId]);

  function handleRunCourse() {
    if (!course || course.path.length < 2) {
      return;
    }

    const preferences = loadRunPreferences();
    const pace = course.pace ?? preferences.targetPaceMinutes;
    const elapsedTime = course.elapsedTime ??
      pace * 60 * (course.distance / 1000);
    const selectedCourse = {
      id: `course-${course.id}`,
      courseId: course.id,
      title: course.name,
      creatorName: course.creatorName,
      path: course.path,
      distance: course.distance,
      elapsedTime,
      pace,
      isSharedCourse: true,
    };

    sessionStorage.setItem("selectedSharedCourse", JSON.stringify(selectedCourse));
    localStorage.setItem("selectedPacerRecord", JSON.stringify(selectedCourse));
    navigate("/run-ready");
  }

  const headerAction = (
    <button
      className="shared-course-back"
      type="button"
      aria-label="공유 코스 목록으로 돌아가기"
      onClick={() => navigate("/shared-courses")}
    >
      ←
    </button>
  );

  if (status !== "ready" || !course) {
    return (
      <PageShell className="shared-course-map-screen" headerAction={headerAction}>
        <div className="empty-state shared-course-detail-state">
          <p>
            {status === "loading" && "코스 지도를 불러오고 있어요."}
            {status === "unavailable" && "백엔드 주소를 설정하면 코스를 볼 수 있어요."}
            {status === "error" && "코스를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요."}
          </p>
        </div>
      </PageShell>
    );
  }

  const firstPoint = course.path[0];

  return (
    <PageShell className="shared-course-map-screen" headerAction={headerAction}>
      <div className="shared-course-detail-map">
        {firstPoint ? (
          <KakaoMap
            latitude={firstPoint.latitude}
            longitude={firstPoint.longitude}
            path={course.path}
            fitPath
            height={390}
          />
        ) : (
          <div className="empty-state">표시할 GPS 경로가 없습니다.</div>
        )}
      </div>

      <section className="shared-course-sheet">
        <span className="shared-course-sheet__handle" aria-hidden="true" />
        <h1>{course.name}</h1>
        <div className="shared-course-sheet__creator">
          <span aria-hidden="true">{course.creatorName.slice(0, 1).toUpperCase()}</span>
          <div><strong>{course.creatorName}</strong><small>{course.isMine ? "내가 공유한 코스" : "공유 코스 크리에이터"}</small></div>
        </div>
        <dl>
          <div><dt>총 거리</dt><dd>{Math.round(course.distance)}m</dd></div>
          <div><dt>기준 페이스</dt><dd>{formatPace(course.pace)}</dd></div>
          <div><dt>기준 기록</dt><dd>{formatTime(course.elapsedTime)}</dd></div>
        </dl>
        <button
          className="primary-button full-button"
          type="button"
          disabled={course.path.length < 2}
          onClick={handleRunCourse}
        >
          이 코스 달려보기
        </button>
      </section>
    </PageShell>
  );
}

export default SharedCourseDetail;
