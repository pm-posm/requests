import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import Dashboard from './components/Dashboard'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 phút cache
      gcTime: 1000 * 60 * 30, // 30 phút rác
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
})

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
        <div className="flex flex-col items-center justify-center min-h-screen p-6 bg-slate-900 text-slate-100 font-sans">
          <div className="max-w-xl w-full bg-slate-800 border border-slate-700 rounded-xl p-6 shadow-xl text-center">
            <h2 className="text-xl font-bold text-red-400 mb-2">⚠️ Đã xảy ra lỗi giao diện!</h2>
            <p className="text-sm text-slate-400 mb-4">Hệ thống ghi nhận sự cố bất ngờ. Hãy thử tải lại trang hoặc báo cho bộ phận IT.</p>
            <div className="bg-slate-950 p-4 rounded-lg text-left overflow-auto max-h-48 text-xs text-red-300 font-mono mb-4">
              {this.state.error?.toString()}
            </div>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-colors"
            >
              Tải lại trang
            </button>
          </div>
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
          <Toaster position="top-right" toastOptions={{ duration: 4000 }} />
          <div className="min-h-screen w-full bg-background text-foreground relative overflow-hidden flex font-sans antialiased">
            <Dashboard />
          </div>
        </BrowserRouter>
      </ErrorBoundary>
    </QueryClientProvider>
  )
}

export default App
