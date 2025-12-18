import { NextRequest, NextResponse } from 'next/server'

const AUTH_COOKIE_NAME = 'auth_token'
// In-memory store for session tokens (for production, use a proper session store like Redis)
const sessionTokens = new Set<string>()

/**
 * Verifies if the provided credentials match the configured password
 */
function verifyCredentials(username: string, password: string): boolean {
  const configuredPassword = process.env.AUTH_PASSWORD
  
  if (!configuredPassword) {
    console.error('AUTH_PASSWORD environment variable is not set')
    return false
  }
  
  // Username can be anything, we only check the password
  return password === configuredPassword
}

/**
 * Generates a cryptographically secure random token using Web Crypto API
 */
function generateSecureToken(): string {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return btoa(String.fromCharCode(...array))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
}

/**
 * Validates the auth token from cookie
 */
function validateToken(token: string): boolean {
  return sessionTokens.has(token)
}

/**
 * Handles successful authentication by setting a cookie
 */
function handleSuccessfulAuth(): NextResponse {
  const response = NextResponse.next()
  const token = generateSecureToken()
  
  // Store token in session store
  sessionTokens.add(token)
  
  response.cookies.set(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    // Cookie valid for 7 days
    maxAge: 60 * 60 * 24 * 7,
    path: '/'
  })
  
  return response
}

/**
 * Returns 401 response to trigger browser basic auth dialog
 */
function requestAuthentication(): NextResponse {
  return new NextResponse('Authentication required', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="IOTA Gas Station", charset="UTF-8"'
    }
  })
}

/**
 * Extracts and validates credentials from Basic Auth header
 */
function extractBasicAuthCredentials(authHeader: string): { username: string; password: string } | null {
  if (!authHeader.startsWith('Basic ')) {
    return null
  }
  
  try {
    const [, base64Credentials] = authHeader.split(' ', 2)
    if (!base64Credentials) {
      return null
    }
    
    const credentials = Buffer.from(base64Credentials, 'base64').toString('utf-8')
    const colonIndex = credentials.indexOf(':')
    
    return colonIndex === -1 ? null : {
      username: credentials.slice(0, colonIndex),
      password: credentials.slice(colonIndex + 1)
    }
  } catch {
    return null
  }
}

/**
 * Processes Basic Auth header and returns response
 */
function processBasicAuth(authHeader: string): NextResponse | null {
  const credentials = extractBasicAuthCredentials(authHeader)
  
  if (!credentials) {
    return null
  }
  
  if (verifyCredentials(credentials.username, credentials.password)) {
    return handleSuccessfulAuth()
  }
  
  return null
}

/**
 * Middleware function to handle basic authentication
 */
export function middleware(request: NextRequest) {
  const authCookie = request.cookies.get(AUTH_COOKIE_NAME)
  
  if (authCookie && validateToken(authCookie.value)) {
    return NextResponse.next()
  }
  
  const authHeader = request.headers.get('authorization')
  
  if (authHeader) {
    const authResponse = processBasicAuth(authHeader)
    if (authResponse) {
      return authResponse
    }
  }
  
  return requestAuthentication()
}

/**
 * Configure which routes the middleware should run on
 * Apply to all routes
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, icon.svg (icons)
     * - public files
     */
    '/((?!_next/static|_next/image|favicon.ico|icon.svg).*)'
  ]
}
