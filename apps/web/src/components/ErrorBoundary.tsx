import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}
interface State {
  error: Error | null
}

/** Keeps one thrown component from blanking the whole app. */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info)
  }

  reset = () => this.setState({ error: null })

  render() {
    if (this.state.error) {
      if (this.props.fallback) return this.props.fallback
      return (
        <div className="mx-auto max-w-lg px-4 py-16">
          <div className="ui-card p-8 text-center">
            <i className="ph-bold ph-warning-octagon mb-2 text-4xl text-ink-faint" aria-hidden="true" />
            <h1 className="page-title">Something broke here</h1>
            <p className="mt-2 text-sm text-ink-light">{this.state.error.message}</p>
            <button onClick={this.reset} className="btn btn-outline mt-6">
              <i className="ph-bold ph-arrow-clockwise" aria-hidden="true" /> Try again
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
