import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, loadEnv } from 'vite'
import { resolveApiBase } from './src/config/api-base.js'

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  resolveApiBase(env.VITE_API_BASE_URL, { production: command === 'build' })
  return { plugins: [vue(), tailwindcss()] }
})
