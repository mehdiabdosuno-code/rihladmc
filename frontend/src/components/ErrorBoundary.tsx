import { Component, ErrorInfo, ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children

    if (this.props.fallback) return this.props.fallback

    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        minHeight: '400px',
        gap: '1rem',
        color: '#94a3b8',
      }}>
        <AlertTriangle size={40} strokeWidth={1.5} />
        <p style={{ fontWeight: 600, fontSize: '1rem' }}>Une erreur inattendue est survenue</p>
        <p style={{ fontSize: '0.8rem', opacity: 0.6, maxWidth: 380, textAlign: 'center' }}>
          {this.state.error.message}
        </p>
        <button
          onClick={() => this.setState({ error: null })}
          style={{
            padding: '0.5rem 1.2rem',
            borderRadius: '8px',
            background: '#1628A9',
            color: '#fff',
            border: 'none',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '0.85rem',
          }}
        >
          Réessayer
        </button>
      </div>
    )
  }
}
