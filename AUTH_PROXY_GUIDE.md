# Auth Proxy Configuration Guide

## Overview

This application implements an authentication proxy that securely communicates with the GraphQL backend without exposing the API key to client browsers.

## Architecture

### HTTP Proxy (`/api/graphql`)
- **Purpose**: Proxies GraphQL queries and mutations
- **Location**: `src/app/api/graphql/route.ts`
- **Functionality**: 
  - Receives GraphQL requests from the frontend
  - Adds the `X-API-Key` header from server-side environment variables
  - Forwards the request to the backend GraphQL endpoint
  - Returns the response to the frontend with preserved content type

### WebSocket Proxy (`/api/graphql/ws`)
- **Purpose**: Proxies GraphQL subscriptions
- **Location**: `server.js` (custom Next.js server)
- **Functionality**:
  - Accepts WebSocket connections from the frontend
  - Establishes a WebSocket connection to the backend with the `X-API-Key` header
  - Bidirectionally forwards messages between client and backend
  - Handles connection lifecycle (open, close, error)

## Environment Variables

### Server-Side (Secret - Never exposed to browser)
- `GRAPHQL_BACKEND_URL`: The actual GraphQL HTTP endpoint (e.g., `https://sponsoring.dev2.impierce.com/graphql`)
- `GRAPHQL_BACKEND_WS_URL`: The actual GraphQL WebSocket endpoint (e.g., `wss://sponsoring.dev2.impierce.com/graphql`)
- `X_API_KEY`: The API key for authenticating with the GraphQL backend

### Client-Side (Public - Exposed to browser)
- `NEXT_PUBLIC_API_URL`: The public-facing API URL that points to the proxy (e.g., `http://localhost:3000/api/graphql`)
- `NEXT_PUBLIC_WS_URL`: The public-facing WebSocket URL that points to the proxy (e.g., `ws://localhost:3000/api/graphql/ws`)

## Setup Instructions

1. Copy the environment example file:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and configure the variables:
   ```env
   # Public URLs (used by frontend, point to local proxy)
   NEXT_PUBLIC_API_URL="http://localhost:3000/api/graphql"
   NEXT_PUBLIC_WS_URL="ws://localhost:3000/api/graphql/ws"
   
   # Backend URLs (used by server, point to actual GraphQL backend)
   GRAPHQL_BACKEND_URL="https://your-backend.example.com/graphql"
   GRAPHQL_BACKEND_WS_URL="wss://your-backend.example.com/graphql"
   
   # API Key (secret, never exposed to browser)
   X_API_KEY="your-actual-api-key-here"
   
   # Basic auth for the UI
   BASIC_AUTH_PASSWORD="your-password-here"
   ```

3. Install dependencies:
   ```bash
   bun install
   ```

4. Start the development server:
   ```bash
   bun dev
   ```

## Testing the Proxy

### Manual Testing

1. **Start the server**: The custom server will log when it's ready and whether the WebSocket proxy is configured.

2. **Test HTTP Proxy**: Open the browser developer tools and observe network requests. GraphQL queries and mutations should go to `http://localhost:3000/api/graphql` (or your configured URL).

3. **Test WebSocket Proxy**: WebSocket connections for GraphQL subscriptions should connect to `ws://localhost:3000/api/graphql/ws`.

4. **Verify API Key**: Check the browser network inspector - the `X-API-Key` header should NOT appear in any outgoing requests from the browser. It's only added on the server side.

### Production Deployment

In production environments:

1. Set `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_WS_URL` to your production domain's proxy endpoints
2. Ensure `X_API_KEY` is securely stored (e.g., using secrets management)
3. The Dockerfiles are already configured to include the custom server

## Security Considerations

- ✅ **API Key Protection**: The API key is never exposed to the client browser
- ✅ **Server-Side Only**: Authentication happens exclusively on the server
- ✅ **Content-Type Preservation**: Response headers are properly forwarded
- ✅ **Error Handling**: Errors don't leak sensitive information to clients
- ✅ **CORS**: Handled by Next.js middleware, not overly permissive

## Troubleshooting

### WebSocket Proxy Not Working
- Check that `GRAPHQL_BACKEND_WS_URL` and `X_API_KEY` are set in your environment
- Look for "WebSocket proxy not configured" warning in server logs
- Verify the backend WebSocket URL is reachable from your server

### HTTP Proxy Errors
- Check that `GRAPHQL_BACKEND_URL` and `X_API_KEY` are set
- Verify the backend HTTP URL is correct and reachable
- Check server logs for detailed error messages

### Connection Refused
- Ensure the custom server (server.js) is running instead of the default Next.js server
- Check that the port (default 3000) is not already in use
