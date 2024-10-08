import React from 'react'
import { QueryClient, QueryClientProvider } from 'react-query'
import UrlAnalyzer from './components/UrlAnalyzer'
import ResultsTable from './components/ResultsTable'

const queryClient = new QueryClient()

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen bg-gray-100 p-8">
        <h1 className="text-3xl font-bold mb-8 text-center">A11y Analyzer</h1>
        <UrlAnalyzer />
        <ResultsTable />
      </div>
    </QueryClientProvider>
  )
}

export default App