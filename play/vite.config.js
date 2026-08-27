import { createHmac, timingSafeEqual } from 'node:crypto'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

const ACCESS_PATH = '/__access'
const SESSION_COOKIE = 'qcm_access'
const SESSION_VALUE = 'granted'
const QUESTION = 'Full name of my cat?'

function escapeHtml(value) {
  return value.replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  })[character])
}

function loginPage(nextPath, error = false) {
  const message = error ? '<p class="error">That answer is not correct.</p>' : ''
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Private QCM</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f5f6f8;color:#1a2028;font-family:system-ui,sans-serif}.card{width:min(400px,calc(100% - 48px));box-sizing:border-box;padding:32px;border:1px solid #d8dee6;border-radius:12px;background:#fff;box-shadow:0 16px 40px #1a20281a}h1{margin:0 0 8px;font-size:24px}p{color:#5b6470;line-height:1.5}.error{color:#b91c1c}label{display:block;margin:24px 0 8px;font-weight:700}input{width:100%;box-sizing:border-box;padding:11px 12px;border:1px solid #aeb8c5;border-radius:7px;font:inherit}button{margin-top:14px;width:100%;padding:11px;border:0;border-radius:7px;background:#f7df1e;color:#000;font:700 15px system-ui;cursor:pointer}</style>
</head><body><main class="card"><h1>Private QCM</h1><p>Answer the question to continue.</p>${message}<form method="post" action="${ACCESS_PATH}"><input type="hidden" name="next" value="${escapeHtml(nextPath)}"><label for="answer">${QUESTION}</label><input id="answer" name="answer" type="password" autocomplete="current-password" required autofocus><button type="submit">Continue</button></form></main></body></html>`
}

function sessionSignature(password) {
  return createHmac('sha256', password).update(SESSION_VALUE).digest('base64url')
}

function hasValidSession(cookieHeader, password) {
  const session = cookieHeader?.split(';').map((item) => item.trim())
    .find((item) => item.startsWith(`${SESSION_COOKIE}=`))?.slice(SESSION_COOKIE.length + 1)
  if (!session) return false

  const expected = `${SESSION_VALUE}.${sessionSignature(password)}`
  const actual = Buffer.from(session)
  const expectedBuffer = Buffer.from(expected)
  return actual.length === expectedBuffer.length && timingSafeEqual(actual, expectedBuffer)
}

function readForm(request) {
  return new Promise((resolve, reject) => {
    let body = ''
    request.on('data', (chunk) => { body += chunk })
    request.on('end', () => resolve(new URLSearchParams(body)))
    request.on('error', reject)
  })
}

function safeNext(value) {
  return value?.startsWith('/') && !value.startsWith('//') ? value : '/'
}

function redirect(response, location) {
  response.statusCode = 303
  response.setHeader('Location', location)
  response.setHeader('Cache-Control', 'no-store')
  response.end()
}

function passwordGate(expectedPassword) {
  const authenticate = async (request, response, next) => {
    if (!expectedPassword) {
      response.statusCode = 503
      response.setHeader('Cache-Control', 'no-store')
      response.end('SITE_PASSWORD is not configured.')
      return
    }

    const requestUrl = new URL(request.url, 'http://localhost')
    if (requestUrl.pathname === ACCESS_PATH) {
      if (request.method === 'POST') {
        const form = await readForm(request)
        const nextPath = safeNext(form.get('next'))
        if (form.get('answer') !== expectedPassword) {
          response.statusCode = 401
          response.setHeader('Content-Type', 'text/html; charset=utf-8')
          response.setHeader('Cache-Control', 'no-store')
          response.end(loginPage(nextPath, true))
          return
        }

        response.setHeader('Set-Cookie', `${SESSION_COOKIE}=${SESSION_VALUE}.${sessionSignature(expectedPassword)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000`)
        redirect(response, nextPath)
        return
      }

      const nextPath = safeNext(requestUrl.searchParams.get('next'))
      response.statusCode = 200
      response.setHeader('Content-Type', 'text/html; charset=utf-8')
      response.setHeader('Cache-Control', 'no-store')
      response.end(loginPage(nextPath))
      return
    }

    if (hasValidSession(request.headers.cookie, expectedPassword)) {
      next()
      return
    }

    redirect(response, `${ACCESS_PATH}?next=${encodeURIComponent(requestUrl.pathname + requestUrl.search)}`)
  }

  return {
    name: 'password-gate',
    configureServer(server) { server.middlewares.use(authenticate) },
    configurePreviewServer(server) { server.middlewares.use(authenticate) },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const password = process.env.SITE_PASSWORD ?? env.SITE_PASSWORD

  return {
    plugins: [react(), passwordGate(password)],
    server: { host: true, port: 5174, strictPort: true },
  }
})
