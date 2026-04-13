/**
 * React StrictMode runs setup → cleanup → setup again for effects in development only.
 * That can look like “double fetch” in the Network tab; production runs each effect once.
 *
 * Mitigations in this app:
 * - TanStack Query deduplicates in-flight requests with the same key (e.g. GET /api/toplistings).
 * - Other useEffect + fetch paths pass AbortSignal and abort on cleanup so the first run is cancelled.
 */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import App from './App.tsx'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
)
