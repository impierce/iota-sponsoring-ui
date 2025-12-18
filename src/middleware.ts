import { NextRequest, NextResponse } from 'next/server'

const AUTH_COOKIE_NAME = 'auth_token'

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
 * Generates a simple token from credentials
 * In production, use proper cryptographic signing
 */
function generateToken(username: string, password: string): string {
  return Buffer.from(`${username}:${password}`).toString('base64')
}

/**
 * Validates the auth token from cookie
 */
function validateToken(token: string): boolean {
  try {
    const decoded = Buffer.from(token, 'base64').toString('utf-8')
    const [username, password] = decoded.split(':')
    return verifyCredentials(username, password)
  } catch {
    return false
  }
}

/**
 * Handles successful authentication by setting a cookie
 */
function handleSuccessfulAuth(username: string, password: string): NextResponse {
  const response = NextResponse.next()
  const token = generateToken(username, password)
  
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
 * Processes Basic Auth header and returns response
 */
function processBasicAuth(authHeader: string): NextResponse | null {
  if (!authHeader.startsWith('Basic ')) {
    return null
  }
  
  const [, base64Credentials] = authHeader.split(' ')
  const credentials = Buffer.from(base64Credentials, 'base64').toString('utf-8')
  const [username, password] = credentials.split(':')
  
  if (verifyCredentials(username, password)) {
    return handleSuccessfulAuth(username, password)
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
