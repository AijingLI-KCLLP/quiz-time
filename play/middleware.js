import { next } from '@vercel/functions'

const REALM = 'Private QCM'
const encoder = new TextEncoder()

function sameValue(left, right) {
  const leftBytes = encoder.encode(left)
  const rightBytes = encoder.encode(right)

  if (leftBytes.length !== rightBytes.length) return false

  let difference = 0
  for (let index = 0; index < leftBytes.length; index += 1) {
    difference |= leftBytes[index] ^ rightBytes[index]
  }
  return difference === 0
}

function suppliedPassword(authorization) {
  if (!authorization?.startsWith('Basic ')) return null

  try {
    const binary = atob(authorization.slice(6))
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0))
    const credentials = new TextDecoder().decode(bytes)
    const separator = credentials.indexOf(':')
    return separator === -1 ? null : credentials.slice(separator + 1)
  } catch {
    return null
  }
}

function unauthorized() {
  return new Response('Authentication required.', {
    status: 401,
    headers: {
      'WWW-Authenticate': `Basic realm="${REALM}", charset="UTF-8"`,
      'Cache-Control': 'no-store',
    },
  })
}

export default function middleware(request) {
  const expectedPassword = process.env.SITE_PASSWORD

  // Fail closed: an incorrectly configured deployment must not expose the QCM.
  if (!expectedPassword) {
    return new Response('SITE_PASSWORD is not configured.', {
      status: 503,
      headers: { 'Cache-Control': 'no-store' },
    })
  }

  const password = suppliedPassword(request.headers.get('authorization'))
  if (password === null || !sameValue(password, expectedPassword)) {
    return unauthorized()
  }

  return next()
}
