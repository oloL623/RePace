import client from './client';

// 서버 Health Check (GET /health)
export const checkHealth = async () => {
  const response = await client.get('/health');
  return response.data;
};