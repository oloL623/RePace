import axios from 'axios';

// 백엔드 실제 서버 주소 입력
const API_BASE_URL = 'https://viewer-impose-hurling.ngrok-free.dev'; // 👈 실제 백엔드 주소로 변경하세요

const client = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 요청 헤더에 'Bearer <토큰>' 형태로 자동 전달
client.interceptors.request.use((config) => {
  const token = localStorage.getItem('authorization');
  if (token) {
    // Bearer 키워드와 한 칸 공백 추가
    config.headers.authorization = token.startsWith('Bearer ') 
      ? token 
      : `Bearer ${token}`;
  }
  return config;
});

export default client;