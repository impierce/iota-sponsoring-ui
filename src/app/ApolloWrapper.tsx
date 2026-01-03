'use client'

import { ApolloLink, HttpLink } from '@apollo/client'
import {
  ApolloClient,
  ApolloNextAppProvider,
  InMemoryCache
} from '@apollo/client-integration-nextjs'
import { setContext } from '@apollo/client/link/context'
import { GraphQLWsLink } from '@apollo/client/link/subscriptions'
import { OperationTypeNode } from 'graphql'
import { createClient } from 'graphql-ws'
import { PropsWithChildren, useEffect, useRef, useState } from 'react'

/**
 * Validates and returns the API URL from environment variables
 */
function getApiUrl(): string {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL?.trim()

  if (!apiUrl) {
    throw new Error('NEXT_PUBLIC_API_URL is not set')
  }

  if (!apiUrl.startsWith('http://') && !apiUrl.startsWith('https://')) {
    throw new Error(
      `NEXT_PUBLIC_API_URL must start with http:// or https://. Got: ${apiUrl}`
    )
  }

  return apiUrl
}

/**
 * Validates and returns the WebSocket URL from environment variables
 */
function getWebSocketUrl(): string {
  const wsUrl = process.env.NEXT_PUBLIC_WS_URL?.trim()

  if (!wsUrl) {
    throw new Error('NEXT_PUBLIC_WS_URL is not set')
  }

  if (!wsUrl.startsWith('ws://') && !wsUrl.startsWith('wss://')) {
    throw new Error(
      `NEXT_PUBLIC_WS_URL must start with ws:// or wss://. Got: ${wsUrl}`
    )
  }

  return wsUrl
}

function makeClient(apiKey: string | null) {
  // Access environment variables inside the function to ensure they're available at runtime
  const { NODE_ENV } = process.env

  // Get validated API URL
  const apiUrl = getApiUrl()

  // Initialize the HTTP link with explicit URI
  const httpLink = new HttpLink({
    uri: apiUrl,
    fetchOptions: {
      ...(NODE_ENV === 'development' ? { cache: 'default' } : {})
    }
  })

  // Add authentication context to include API key in headers
  const authLink = setContext((_, { headers }) => {
    // Only add the X-API-Key header if we have the API key
    if (!apiKey) {
      return { headers }
    }

    return {
      headers: {
        ...headers,
        'X-API-Key': apiKey
      }
    }
  })

  const wsLink = new GraphQLWsLink(
    createClient({
      url: getWebSocketUrl(),
      connectionParams: () => {
        // Only add the X-API-Key header if we have the API key
        if (!apiKey) {
          return {}
        }

        return {
          'X-API-Key': apiKey
        }
      }
    })
  )

  /* The split function takes three parameters:
   **
   ** * A function that's called for each operation to execute
   ** * The Link to use for an operation if the function returns a "truthy" value
   ** * The Link to use for an operation if the function returns a "falsy" value
   */
  const splitLink = ApolloLink.split(
    ({ operationType }) => {
      return operationType === OperationTypeNode.SUBSCRIPTION
    },
    wsLink,
    authLink.concat(httpLink)
  )

  return new ApolloClient({
    cache: new InMemoryCache({
      typePolicies: {
        GroupDto: {
          keyFields: ['groupId']
        },
        ClientDto: {
          keyFields: ['clientId']
        },
        SponsorWalletDto: {
          keyFields: ['sponsorWalletId']
        },
        ConversionRatesDto: {
          keyFields: ['eurToIot', 'usdToIot']
        }
      }
    }),
    link: splitLink
  })
}

export const ApolloWrapper = ({ children }: PropsWithChildren) => {
  const [apiKey, setApiKey] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const clientRef = useRef<ReturnType<typeof makeClient> | null>(null)

  useEffect(() => {
    // Fetch the API key from the server
    fetch('/api/config')
      .then((response) => {
        if (!response.ok) {
          throw new Error('Failed to fetch API configuration')
        }

        return response.json()
      })
      .then((data) => {
        setApiKey(data.graphqlApiKey)
        setIsLoading(false)
      })
      .catch((error) => {
        console.error('Error fetching API key:', error)
        // Still set loading to false to prevent infinite loading
        // The app will work without the API key, but might get auth errors from GraphQL
        setIsLoading(false)
      })
  }, [])

  // Create client only once when we have the API key
  if (!clientRef.current && !isLoading) {
    clientRef.current = makeClient(apiKey)
  }

  // Show loading state while fetching API key
  if (isLoading) {
    return null
  }

  return (
    <ApolloNextAppProvider makeClient={() => clientRef.current!}>
      {children}
    </ApolloNextAppProvider>
  )
}
