import { NextResponse } from 'next/server'

/**
 * API route to expose configuration values to authenticated clients
 * This route is protected by the Basic Auth middleware, so it will only
 * be accessible after successful authentication
 */
export async function GET() {
  const apiKey = process.env.GRAPHQL_API_KEY

  if (!apiKey) {
    console.error('GRAPHQL_API_KEY environment variable is not set')
    return NextResponse.json(
      { error: 'API key not configured' },
      { status: 500 }
    )
  }

  return NextResponse.json({
    graphqlApiKey: apiKey
  })
}
