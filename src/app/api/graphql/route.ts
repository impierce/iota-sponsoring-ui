import { NextRequest, NextResponse } from 'next/server'

/**
 * GraphQL proxy endpoint that adds X-API-Key header
 * This prevents exposing the API key to the client's browser
 */
export async function POST(request: NextRequest) {
  const backendUrl = process.env.GRAPHQL_BACKEND_URL

  if (!backendUrl) {
    console.error('GRAPHQL_BACKEND_URL environment variable is not set')
    return NextResponse.json(
      { error: 'GraphQL backend URL is not configured' },
      { status: 500 }
    )
  }

  const apiKey = process.env.X_API_KEY

  if (!apiKey) {
    console.error('X_API_KEY environment variable is not set')
    return NextResponse.json(
      { error: 'API key is not configured' },
      { status: 500 }
    )
  }

  try {
    // Get the GraphQL request body
    const body = await request.text()

    // Forward the request to the actual GraphQL backend
    const response = await fetch(backendUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey
      },
      body
    })

    // Get the response data
    const data = await response.text()

    // Return the response with the same status and headers
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
