import { Component, type ErrorInfo, type ReactNode } from 'react'

interface State {
  error: Error | null
}

export class GlobalErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled render error', error, info.componentStack)
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children
    return (
      <div className="grid min-h-screen place-items-center bg-bg p-6 text-fg">
        <div className="w-full max-w-lg border border-line">
          <div className="flex h-8 items-center gap-1.5 border-b border-line bg-bg-subtle px-3">
            <span className="size-[10px] rounded-full bg-[#ff5f57]" />
            <span className="size-[10px] rounded-full bg-[#febc2e]" />
            <span className="size-[10px] rounded-full bg-[#28c840]" />
          </div>
          <div className="p-6">
            <p className="eyebrow text-danger">Unexpected error</p>
            <h1 className="mt-2 font-display text-xl font-bold">This screen crashed.</h1>
            <p className="mt-2 text-sm text-fg-secondary">Reloading usually fixes it. Your data is safe on the server.</p>
            <pre className="mt-4 max-h-40 overflow-auto border border-line bg-bg-subtle p-3 font-mono text-[11px] text-fg-muted">{error.message}</pre>
            <div className="mt-5 flex gap-2">
              <button
                onClick={() => window.location.reload()}
                className="h-9 border border-primary bg-primary px-4 font-display text-xs font-bold text-primary-foreground"
              >
                Reload
              </button>
              <button
                onClick={() => (window.location.href = '/dashboard')}
                className="h-9 border border-line px-4 font-display text-xs font-bold"
              >
                Go to dashboard
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }
}
