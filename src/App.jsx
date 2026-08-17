import "./App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import Splash from "./pages/Splash/Splash";
import Login from "./pages/Login/Login";
import Home from "./pages/Home/Home";
import RunReady from "./pages/RunReady/RunReady";
import LiveRun from "./pages/LiveRun/LiveRun";
import Result from "./pages/Result/Result";
import SharedCourses from "./pages/SharedCourses/SharedCourses";
import SharedCourseDetail from "./pages/SharedCourses/SharedCourseDetail";
import AiCoaching from "./pages/AiCoaching/AiCoaching";
import MyPage from "./pages/MyPage/MyPage";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Splash />} />
        <Route path="/login" element={<Login />} />
        <Route path="/home" element={<Home />} />
        <Route path="/run-ready" element={<RunReady />} />
        <Route path="/live-run" element={<LiveRun />} />
        <Route path="/result" element={<Result />} />
        <Route path="/shared-courses" element={<SharedCourses />} />
        <Route path="/shared-courses/:courseId" element={<SharedCourseDetail />} />
        <Route path="/ai-coaching" element={<AiCoaching />} />
        <Route path="/my-page" element={<MyPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
