import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import Dashboard from './components/Dashboard'

const queryClient = new QueryClient()

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, error: Error | null, info: any }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null, info: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: any) {
    this.setState({ info });
    console.error("ErrorBoundary caught an error", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 20, color: 'red', background: '#fee' }}>
          <h2>Đã xảy ra lỗi (Crash):</h2>
          <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {this.state.error?.toString()}
          </pre>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, marginTop: 10 }}>
            {this.state.info?.componentStack}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary>
        <BrowserRouter>
          <div className="min-h-screen w-full bg-background text-foreground relative overflow-hidden flex font-sans antialiased">
            <Dashboard />
          </div>
        </BrowserRouter>
      </ErrorBoundary>
    </QueryClientProvider>
  )
}

export default App
