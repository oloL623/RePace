import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { createGeminiTtsPlugin } from './server/geminiTtsPlugin.js'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react(), createGeminiTtsPlugin(mode)],
}))
