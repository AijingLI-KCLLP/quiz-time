import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
function hasValidBasicAuth(authorization, expectedPassword) {
  if (!authorization?.startsWith('Basic ')) return false

  try {
    const credentials = Buffer.from(authorization.slice(6), 'base64').toString('utf8')
    const separator = credentials.indexOf(':')

    return separator !== -1 && credentials.slice(separator + 1) === expectedPassword
  } catch {
    return false
  }
}

function passwordGate(expectedPassword) {
  const authenticate = (request, response, next) => {
    if (!expectedPassword) {
      response.statusCode = 503
      response.setHeader('Cache-Control', 'no-store')
      response.end('SITE_PASSWORD is not configured.')
      return
    }

    if (hasValidBasicAuth(request.headers.authorization, expectedPassword)) {
      next()
      return
    }

    response.statusCode = 401
    response.setHeader('WWW-Authenticate', 'Basic realm="Private QCM", charset="UTF-8"')
    response.setHeader('Cache-Control', 'no-store')
    response.end('Authentication required.')
  }

  return {
    name: 'password-gate',
    configureServer(server) {
      server.middlewares.use(authenticate)
    },
    configurePreviewServer(server) {
      server.middlewares.use(authenticate)
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const password = process.env.SITE_PASSWORD ?? env.SITE_PASSWORD

  return {
    plugins: [react(), passwordGate(password)],
    server: {
      host: true,
      port: 5174,
      strictPort: true,
    },
  }
})
