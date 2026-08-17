import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { getCourses } from "../../api/courses";
import { isBackendConfigured } from "../../api/apiClient";
import { supabase } from "../../lib/supabase";
import PageShell from "../../components/PageShell";
import {
  createRoutePreviewPoints,
  loadSharedCourseMetadata,
  normalizeSharedCourse,
  sortSharedCourses,
} from "../../utils/sharedCourses";
import "./SharedCourses.css";

function formatPace(pace) {
  if (!Number.isFinite(pace)) {
    return "-";
  }

  const minutes = Math.floor(pace);
  const seconds = Math.round((pace - minutes) * 60);
  return `${minutes}'${String(seconds).padStart(2, "0")}"/km`;
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds)) {
    return "-";
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);
  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
}

function CourseRoutePreview({ path }) {
  const points = createRoutePreviewPoints(path);
  const coordinates = points.split(" ");
  const [startX, startY] = (coordinates[0] ?? "").split(",");
  const [finishX, finishY] = (coordinates.at(-1) ?? "").split(",");

  return (
    <svg viewBox="0 0 320 140" role="img" aria-label="공유 코스 경로 미리보기">
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
      {points && (
        <>
          <circle cx={startX} cy={startY} r="10" className="shared-route-start" />
          <circle cx={finishX} cy={finishY} r="10" className="shared-route-finish" />
        </>
      )}
    </svg>
  );
}

function SharedCourses() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [rawCourses, setRawCourses] = useState([]);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [status, setStatus] = useState(
    isBackendConfigured ? "loading" : "unavailable"
  );
  const [visibleCourseCount, setVisibleCourseCount] = useState(10);
  const loadMoreRef = useRef(null);
  const highlightedCourseId = Number(searchParams.get("shared")) || null;
  const metadata = useMemo(() => loadSharedCourseMetadata(), []);
  const courses = useMemo(
    () =>
      sortSharedCourses(
        rawCourses.map((course) =>
          normalizeSharedCourse(course, { currentUserId, metadata })
        ),
        { currentUserId, highlightedCourseId }
      ),
    [currentUserId, highlightedCourseId, metadata, rawCourses]
  );

  useEffect(() => {
    let isActive = true;

    supabase?.auth.getSession().then(({ data }) => {
      if (isActive) {
        setCurrentUserId(data.session?.user?.id ?? null);
      }
    });

    if (!isBackendConfigured) {
      return () => {
        isActive = false;
      };
    }

    getCourses()
      .then((courseList) => {
        if (isActive) {
          setRawCourses(Array.isArray(courseList) ? courseList : []);
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
  }, []);

  useEffect(() => {
    const loadMoreTarget = loadMoreRef.current;

    if (!loadMoreTarget || courses.length <= 10) {
      return undefined;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisibleCourseCount((current) =>
            Math.min(current + 10, courses.length)
          );
        }
      },
      { rootMargin: "180px 0px" }
    );

    observer.observe(loadMoreTarget);
    return () => observer.disconnect();
  }, [courses.length]);

  return (
    <PageShell className="courses-screen">
      <p className="page-kicker">SHARED COURSE</p>
      <h1 className="page-title">러너들의 코스에<br />도전해 보세요.</h1>
      <p className="page-description">
        공유된 기록을 기준으로 달리거나 새로운 코스를 가볍게 즐길 수 있어요.
      </p>

      {status === "loading" && <p className="status-message">공유 코스를 불러오고 있어요.</p>}
      {status === "unavailable" && <p className="status-message">백엔드 주소를 설정하면 공유 코스를 볼 수 있어요.</p>}
      {status === "error" && <p className="status-message">공유 코스를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.</p>}

      {status === "ready" && courses.length === 0 && (
        <div className="empty-state shared-course-empty">
          <p>아직 공유된 코스가 없어요.<br />내 기록에서 첫 코스를 공유해 보세요.</p>
        </div>
      )}

      <div className="shared-course-list">
        {courses.slice(0, visibleCourseCount).map((course) => (
          <article
            className={`shared-course-list-card${course.id === highlightedCourseId ? " is-highlighted" : ""}`}
            key={course.id}
          >
            <div className="shared-course-list-card__preview">
              <CourseRoutePreview path={course.path} />
              {course.isMine && <span>내가 공유한 코스</span>}
            </div>
            <div className="shared-course-list-card__body">
              <div className="shared-course-list-card__creator">
                <span aria-hidden="true">{course.creatorName.slice(0, 1).toUpperCase()}</span>
                <strong>{course.creatorName}</strong>
              </div>
              <h2>{course.name}</h2>
              <p>러너가 공유한 GPS 경로를 따라 달리는 코스</p>
              <dl>
                <div><dt>총 거리</dt><dd>{Math.round(course.distance)}m</dd></div>
                <div><dt>기준 페이스</dt><dd>{formatPace(course.pace)}</dd></div>
                <div><dt>기준 기록</dt><dd>{formatTime(course.elapsedTime)}</dd></div>
              </dl>
              <button type="button" onClick={() => navigate(`/shared-courses/${course.id}`)}>
                이 기록에 도전하기
              </button>
            </div>
          </article>
        ))}
        <div ref={loadMoreRef} className="shared-course-list__sentinel" aria-hidden="true" />
      </div>
    </PageShell>
  );
}

export default SharedCourses;
