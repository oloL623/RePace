import { apiRequest } from "./apiClient";

export function createCourse({ accessToken, name, referencePath }) {
  return apiRequest("/courses", {
    method: "POST",
    accessToken,
    body: {
      name,
      reference_path: referencePath,
    },
  });
}

export function getCourses() {
  return apiRequest("/courses");
}

export function getCourse(courseId) {
  return apiRequest(`/courses/${courseId}`);
}
