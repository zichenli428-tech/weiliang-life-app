import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import Components from 'unplugin-vue-components/vite'
import { VantResolver } from '@vant/auto-import-resolver'
import { fileURLToPath, URL } from 'node:url'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // 加载 .env 中的 VITE_AI_API_KEY（仅用于 dev proxy 注入，不会进入客户端构建产物）
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [
      vue(),
      // PRD 5.1：Vant 4 按需自动引入（含样式）
      Components({
        resolvers: [VantResolver()],
        dts: 'components.d.ts'
      })
    ],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url))
      }
    },
    server: {
      host: '0.0.0.0',
      port: 5173,
      open: false,
      // 商汤 SenseNova API 不允许浏览器直连（无 CORS 响应头）
      // 开发环境通过 Vite 代理绕过：前端请求 /ai-proxy/* 由 dev server 转发到 token.sensenova.cn
      // 安全：前端不带 Authorization，由 proxy 注入（密钥不暴露到浏览器请求头）
      proxy: {
        '/ai-proxy': {
          target: 'https://token.sensenova.cn',
          changeOrigin: true,
          secure: true,
          timeout: 120000,
          rewrite: (path) => path.replace(/^\/ai-proxy/, ''),
          headers: {
            Authorization: `Bearer ${env.VITE_AI_API_KEY || ''}`
          }
        }
      }
    }
  }
})
