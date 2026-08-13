import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  isSupabaseConfigured,
  supabase,
} from "../../lib/supabase";

function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [session, setSession] = useState(null);
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!supabase) {
      return undefined;
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
    });

    // 토큰 갱신과 로그아웃도 화면에 바로 반영한다.
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => data.subscription.unsubscribe();
  }, []);

  async function handleAuth(mode) {
    if (!supabase || isSubmitting) {
      return;
    }

    const trimmedEmail = email.trim();

    // 회원가입 버튼도 form submit과 동일한 입력 검증을 거치게 한다.
    // 값이 비어 있으면 Supabase가 익명 가입 요청으로 해석할 수 있다.
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
      mode === "signup"
        ? await supabase.auth.signUp(credentials)
        : await supabase.auth.signInWithPassword(credentials);

    if (error) {
      setMessage(
        error.message === "Anonymous sign-ins are disabled"
          ? "이메일과 비밀번호를 모두 입력한 뒤 다시 시도해 주세요."
          : error.message
      );
    } else if (mode === "signup") {
      setMessage("회원가입 요청이 완료되었습니다. 이메일 인증 설정을 확인해 주세요.");
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
      <main>
        <h1>로그인</h1>
        <p>
          Supabase 환경변수가 없어 현재는 로컬 기록 모드로 동작합니다.
          .env 파일에 VITE_SUPABASE_URL과 VITE_SUPABASE_ANON_KEY를 설정해
          주세요.
        </p>
        <button type="button" onClick={() => navigate("/home")}>
          로컬 모드로 계속하기
        </button>
      </main>
    );
  }

  if (session) {
    return (
      <main>
        <h1>로그인 완료</h1>
        <p>{session.user.email}</p>
        <button type="button" onClick={() => navigate("/home")}>
          홈으로 이동
        </button>{" "}
        <button type="button" onClick={handleSignOut}>
          로그아웃
        </button>
      </main>
    );
  }

  return (
    <main>
      <h1>로그인</h1>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          handleAuth("signin");
        }}
      >
        <label>
          이메일
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            required
          />
        </label>
        <br />
        <label>
          비밀번호
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            minLength={6}
            required
          />
        </label>
        <br />
        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "처리 중..." : "로그인"}
        </button>{" "}
        <button
          type="button"
          disabled={isSubmitting}
          onClick={() => handleAuth("signup")}
        >
          회원가입
        </button>
      </form>
      {message && <p>{message}</p>}
    </main>
  );
}

export default Login;
