import client from './client';

// 1. 코스 목록 조회 (GET /courses)
export const getCourses = async () => {
  const response = await client.get('/courses');
  return response.data;
};

// 2. 코스 생성 (POST /courses)
export const createCourse = async (courseData) => {
  // courseData 예시: { name: "한강 코스", reference_path: [[...]] }
  const response = await client.post('/courses', courseData);
  return response.data;
};

// 3. 특정 코스 상세 조회 (GET /courses/{course_id})
export const getCourseDetail = async (courseId) => {
  const response = await client.get(`/courses/${courseId}`);
  return response.data;
};

// 4. 코스 리더보드 조회 (GET /courses/{course_id}/leaderboard)
export const getLeaderboard = async (courseId) => {
  const response = await client.get(`/courses/${courseId}/leaderboard`);
  return response.data;
};