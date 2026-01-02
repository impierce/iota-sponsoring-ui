import { NextRequest, NextResponse } from 'next/server'

/**
 * Validates environment configuration
 */
function validateConfig(): {
  backendUrl: string
  apiKey: string
} | null {
  const backendUrl = process.env.GRAPHQL_BACKEND_URL
  const apiKey = process.env.X_API_KEY

  if (!backendUrl) {
    console.error('GRAPHQL_BACKEND_URL environment variable is not set')
    return null
  }

  if (!apiKey) {
    console.error('X_API_KEY environment variable is not set')
    return null
  }

  return { backendUrl, apiKey }
}

/**
 * Forwards a GraphQL request to the backend
 */
async function forwardGraphQLRequest(
  backendUrl: string,
  apiKey: string,
  body: string
): Promise<Response> {
  return fetch(backendUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': apiKey
    },
    body
  })
}

/**
 * GraphQL proxy endpoint that adds X-API-Key header
 * This prevents exposing the API key to the client's browser
 */
export async function POST(request: NextRequest) {
  const config = validateConfig()

  if (!config) {
    return NextResponse.json(
      { error: 'GraphQL backend is not configured' },
      { status: 500 }
    )
  }

  try {
    const body = await request.text()
    const response = await forwardGraphQLRequest(
      config.backendUrl,
      config.apiKey,
      body
    )
    const data = await response.text()

    return new NextResponse(data, {
      status: response.status,
      headers: {
        'Content-Type': 'application/json'
      }
    })
  } catch (error) {
    console.error('Error proxying GraphQL request:', error)
    return NextResponse.json(
      { error: 'Failed to proxy GraphQL request' },
      { status: 500 }
    )
  }
}

/**
 * Handle OPTIONS requests for CORS preflight
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  })
}
