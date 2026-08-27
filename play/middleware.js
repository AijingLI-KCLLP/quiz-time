import { next } from '@vercel/functions'

const ACCESS_PATH = '/__access'
const SESSION_COOKIE = 'qcm_access'
const SESSION_VALUE = 'granted'
const QUESTION = 'Full name of my cat?'
const encoder = new TextEncoder()
const decoder = new TextDecoder()

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

function safeNext(value) {
  return value?.startsWith('/') && !value.startsWith('//') ? value : '/'
}

function redirect(location) {
  return new Response(null, {
    status: 303,
    headers: { Location: location, 'Cache-Control': 'no-store' },
  })
}

function cookieValue(cookieHeader, name) {
  return cookieHeader?.split(';').map((item) => item.trim())
    .find((item) => item.startsWith(`${name}=`))?.slice(name.length + 1) ?? null
}

function constantTimeEqual(left, right) {
  if (left.length !== right.length) return false
  let difference = 0
  for (let index = 0; index < left.length; index += 1) {
    difference |= left[index] ^ right[index]
  }
  return difference === 0
}

function toBase64Url(bytes) {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
}

async function sessionSignature(password) {
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(password), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  )
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(SESSION_VALUE))
  return toBase64Url(new Uint8Array(signature))
}

async function hasValidSession(request, password) {
  const session = cookieValue(request.headers.get('cookie'), SESSION_COOKIE)
  if (!session) return false

  const expected = encoder.encode(`${SESSION_VALUE}.${await sessionSignature(password)}`)
  return constantTimeEqual(encoder.encode(session), expected)
}

function htmlResponse(html, status = 200) {
  return new Response(html, {
    status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'self'",
    },
  })
}

export default async function middleware(request) {
  const expectedPassword = process.env.SITE_PASSWORD
  if (!expectedPassword) {
    return new Response('SITE_PASSWORD is not configured.', {
      status: 503,
      headers: { 'Cache-Control': 'no-store' },
    })
  }

  const url = new URL(request.url)
  if (url.pathname === ACCESS_PATH) {
    if (request.method === 'POST') {
      const form = new URLSearchParams(decoder.decode(await request.arrayBuffer()))
      const nextPath = safeNext(form.get('next'))
      if (form.get('answer') !== expectedPassword) return htmlResponse(loginPage(nextPath, true), 401)

      const signature = await sessionSignature(expectedPassword)
      const secure = url.protocol === 'https:' ? '; Secure' : ''
      const response = redirect(nextPath)
      response.headers.set('Set-Cookie', `${SESSION_COOKIE}=${SESSION_VALUE}.${signature}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000${secure}`)
      return response
    }

    return htmlResponse(loginPage(safeNext(url.searchParams.get('next'))))
  }

  if (await hasValidSession(request, expectedPassword)) return next()
  return redirect(`${ACCESS_PATH}?next=${encodeURIComponent(url.pathname + url.search)}`)
}
