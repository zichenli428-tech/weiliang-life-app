/**
 * 微量生活 Demo 服务器（零依赖，仅使用 Node.js 内置模块）
 *
 * 功能：
 * 1. 提供静态文件服务（dist/ 目录）
 * 2. 代理 AI API 请求（/ai-proxy/* → https://opencode.ai/zen/*）绕过浏览器 CORS
 * 3. SPA 路由回退（非文件请求统一返回 index.html）
 *
 * 使用方法：
 *   1. 先构建项目：npm run build
 *   2. 启动 demo：npm run demo
 *   3. 浏览器访问：http://localhost:8080
 */
import http from 'node:http'
import https from 'node:https'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = process.env.PORT || 8080
// 仅绑定本机回环地址，防止同 WiFi 他人盗用代理白嫖 API 密钥
// 手机端（APK）走 CapacitorHttp 直连，不依赖此 server
const HOST = process.env.HOST || '127.0.0.1'
const DIST_DIR = path.join(__dirname, 'dist')
const AI_PROXY_HOST = 'opencode.ai'
const AI_PROXY_PATH_PREFIX = '/zen' // OpenCode Zen 端点路径前缀（/ai-proxy/v1/* → /zen/v1/*）

// 内置 .env 加载（零依赖）：若项目根存在 .env，将其键值写入 process.env（不覆盖 shell 已有值）
// 这样 AI_API_KEY 既可由 shell 传入，也可写在 .env 中，免去每次启动都加前缀
try {
  const envFile = path.join(__dirname, '.env')
  if (fs.existsSync(envFile)) {
    for (const line of fs.readFileSync(envFile, 'utf-8').split('\n')) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)
      if (!m) continue
      const [, k, v] = m
      if (process.env[k] === undefined) {
        process.env[k] = v.replace(/^['"]|['"]$/g, '')
      }
    }
  }
} catch { /* .env 读取失败时忽略，回退到纯环境变量 */ }

// AI 密钥由服务端持有，客户端不接触；通过环境变量 AI_API_KEY 传入（可写在 .env）
const AI_API_KEY = process.env.AI_API_KEY
if (!AI_API_KEY) {
  console.error('\n❌ 未配置 AI_API_KEY，请在 .env 中设置 AI_API_KEY 或通过 AI_API_KEY=sk-xxx node server.js 启动\n')
  process.exit(1)
}
// 代理超时（毫秒），AI 推理阶段较长，给足 2 分钟
const AI_PROXY_TIMEOUT = 120000

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject',
  '.wasm': 'application/wasm',
  '.webp': 'image/webp'
}

// 检查 dist 目录是否存在
if (!fs.existsSync(DIST_DIR)) {
  console.error('\n❌ 未找到 dist 目录，请先运行: npm run build\n')
  process.exit(1)
}

const server = http.createServer((req, res) => {
  const parsedUrl = new URL(req.url, `http://localhost:${PORT}`)
  const pathname = decodeURIComponent(parsedUrl.pathname)

  // ==================== AI API 代理 ====================
  if (pathname.startsWith('/ai-proxy/')) {
    const targetPath = pathname.replace(/^\/ai-proxy/, '')
    const targetUrl = `https://${AI_PROXY_HOST}${AI_PROXY_PATH_PREFIX}${targetPath}`

    // 转发请求头，替换 host
    const proxyHeaders = { ...req.headers }
    proxyHeaders.host = AI_PROXY_HOST
    delete proxyHeaders['accept-encoding'] // 避免压缩问题
    // 安全关键：删除客户端可能携带的 Authorization，改由服务端注入
    // 这样即使客户端泄露密钥，也无法通过本代理调用 API
    delete proxyHeaders['authorization']
    proxyHeaders['authorization'] = `Bearer ${AI_API_KEY}`

    const proxyReq = https.request(targetUrl, {
      method: req.method,
      headers: proxyHeaders,
      timeout: AI_PROXY_TIMEOUT
    }, (proxyRes) => {
      // 透传响应头
      const responseHeaders = { ...proxyRes.headers }
      // 移除可能引起问题的安全头
      delete responseHeaders['transfer-encoding']

      res.writeHead(proxyRes.statusCode || 200, responseHeaders)
      proxyRes.pipe(res)
    })

    // 代理超时处理：商汤 API 异常时避免连接挂起耗尽句柄
    proxyReq.on('timeout', () => {
      console.error('[AI Proxy] 上游响应超时')
      proxyReq.destroy()
      if (!res.headersSent) {
        res.writeHead(504, { 'Content-Type': 'application/json; charset=utf-8' })
        res.end(JSON.stringify({ error: 'AI_PROXY_TIMEOUT', message: '上游 AI 服务响应超时' }))
      }
    })

    proxyReq.on('error', (err) => {
      console.error('[AI Proxy] 请求失败:', err.message)
      if (!res.headersSent) {
        res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' })
        res.end(JSON.stringify({ error: 'AI_PROXY_ERROR', message: err.message }))
      }
    })

    req.pipe(proxyReq)
    return
  }

  // ==================== 静态文件服务 ====================
  let filePath = path.join(DIST_DIR, pathname)

  // 防止路径穿越攻击
  if (!filePath.startsWith(DIST_DIR)) {
    res.writeHead(403)
    res.end('Forbidden')
    return
  }

  // 根路径 → index.html
  if (pathname === '/' || pathname === '') {
    filePath = path.join(DIST_DIR, 'index.html')
  }

  // 如果路径是目录，尝试访问其中的 index.html
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, 'index.html')
  }

  // SPA 路由回退：文件不存在时返回 index.html
  if (!fs.existsSync(filePath)) {
    filePath = path.join(DIST_DIR, 'index.html')
  }

  const ext = path.extname(filePath)
  const contentType = MIME_TYPES[ext] || 'application/octet-stream'

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end('<h1>404 Not Found</h1>')
      return
    }
    res.writeHead(200, { 'Content-Type': contentType })
    res.end(data)
  })
})

server.listen(PORT, HOST, () => {
  console.log('')
  console.log('  ╔══════════════════════════════════════╗')
  console.log('  ║                                      ║')
  console.log('  ║   🚀 微量生活 Demo 已启动！          ║')
  console.log('  ║                                      ║')
  console.log(`  ║   📱 访问地址: http://${HOST}:${PORT}   ║`)
  console.log('  ║                                      ║')
  console.log('  ║   🔒 仅本机访问，手机端走 APK 直连   ║')
  console.log('  ║                                      ║')
  console.log('  ║   按 Ctrl+C 停止服务                 ║')
  console.log('  ║                                      ║')
  console.log('  ╚══════════════════════════════════════╝')
  console.log('')
})
