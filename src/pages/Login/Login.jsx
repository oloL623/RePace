import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppHeader from "../../components/AppHeader";
import { isSupabaseConfigured, supabase } from "../../lib/supabase";
import runningCat from "../../assets/runningcat.png";
import "./Login.css";

function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [session, setSession] = useState(null);
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mode, setMode] = useState("signin");

  useEffect(() => {
    if (!supabase) {
      return undefined;
    }

    supabase.auth.getSession().then(({ data }) => setSession(data.session));

    // 토큰 갱신과 로그아웃도 화면에 바로 반영한다.
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => data.subscription.unsubscribe();
  }, []);

  async function handleAuth(nextMode) {
    if (!supabase || isSubmitting) {
      return;
    }

    const trimmedEmail = email.trim();

    // 빈 이메일은 Supabase가 익명 가입 요청으로 해석할 수 있어 프론트에서 먼저 막는다.
    if (!trimmedEmail) {
      setMessage("이메일을 입력해 주세요.");
      return;
    }

    if (password.length < 6) {
      setMessage("비밀번호는 6자 이상 입력해 주세요.");
      return;
    }

    setIsSubmitting(true);
    setMessage("");

    const credentials = { email: trimmedEmail, password };
    const { error } =
      nextMode === "signup"
        ? await supabase.auth.signUp(credentials)
        : await supabase.auth.signInWithPassword(credentials);

    if (error) {
      setMessage(
        error.message === "Anonymous sign-ins are disabled"
          ? "이메일과 비밀번호를 모두 입력한 뒤 다시 시도해 주세요."
          : error.message
      );
    } else if (nextMode === "signup") {
      setMessage("회원가입이 완료되었습니다. 이메일 인증 설정을 확인해 주세요.");
    } else {
      navigate("/home");
    }

    setIsSubmitting(false);
  }

  async function handleSignOut() {
    await supabase?.auth.signOut();
    setMessage("로그아웃되었습니다.");
  }

  if (!isSupabaseConfigured) {
    return (
      <div className="auth-screen">
        <AppHeader />
        <main className="auth-content auth-content--center">
          <div className="auth-icon" aria-hidden="true"><img src={runningCat} alt="" /></div>
          <p className="page-kicker">LOCAL MODE</p>
          <h1 className="page-title">로컬 기록으로<br />먼저 달려볼까요?</h1>
          <p className="page-description">
            Supabase 환경변수가 없어 로그인 없이 기기에 기록을 저장합니다.
          </p>
          <button className="primary-button full-button" type="button" onClick={() => navigate("/home")}>
            로컬 모드로 계속하기
          </button>
        </main>
      </div>
    );
  }

  if (session) {
    return (
      <div className="auth-screen">
        <AppHeader />
        <main className="auth-content auth-content--center">
          <div className="auth-icon" aria-hidden="true"><img src={runningCat} alt="" /></div>
          <p className="page-kicker">WELCOME BACK</p>
          <h1 className="page-title">다시 만났네요!</h1>
          <p className="page-description">{session.user.email}</p>
          <button className="primary-button full-button" type="button" onClick={() => navigate("/home")}>
            홈으로 이동
          </button>
          <button className="auth-text-button" type="button" onClick={handleSignOut}>
            다른 계정으로 로그인
          </button>
        </main>
      </div>
    );
  }

  const isSignup = mode === "signup";

  return (
    <div className="auth-screen">
      <AppHeader />
      <main className="auth-content">
        <p className="page-kicker">{isSignup ? "JOIN REPACE" : "WELCOME BACK"}</p>
        <h1 className="page-title">
          {isSignup ? "어제의 나와 달리는\n새로운 경험을 시작해요." : "돌아온 걸 환영해요!\n오늘도 함께 달려볼까요?"}
        </h1>
        <p className="page-description">
          나의 기록을 안전하게 보관하고 지난 페이스와 다시 달려보세요.
        </p>

        <div className="auth-tabs" role="tablist" aria-label="로그인 방식 선택">
          <button className={!isSignup ? "is-active" : ""} type="button" onClick={() => { setMode("signin"); setMessage(""); }}>
            로그인
          </button>
          <button className={isSignup ? "is-active" : ""} type="button" onClick={() => { setMode("signup"); setMessage(""); }}>
            회원가입
          </button>
        </div>

        <form
          className="auth-form"
          onSubmit={(event) => {
            event.preventDefault();
            handleAuth(mode);
          }}
        >
          <label>
            이메일
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="runner@example.com"
              autoComplete="email"
              required
            />
          </label>
          <label>
            비밀번호
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="6자 이상 입력"
              autoComplete={isSignup ? "new-password" : "current-password"}
              minLength={6}
              required
            />
          </label>
          <button className="primary-button full-button" type="submit" disabled={isSubmitting}>
            {isSubmitting ? "처리 중..." : isSignup ? "RePace 시작하기" : "로그인"}
          </button>
        </form>

        {message && <p className="status-message" role="status">{message}</p>}

        <button className="auth-text-button" type="button" onClick={() => navigate("/home")}>
          로그인 없이 둘러보기
        </button>
      </main>
    </div>
  );
}

export default Login;
