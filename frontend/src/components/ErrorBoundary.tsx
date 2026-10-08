import { Component, type ErrorInfo, type ReactNode } from 'react';
import { ErrorState } from './ErrorState';

export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean; revision: number }> {
  state = { failed: false, revision: 0 };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error, info: ErrorInfo) {
    if (import.meta.env.DEV) console.error('CHIS render failure', error, info);
  }
  render() {
    if (this.state.failed) return <main className="max-w-2xl mx-auto p-6">
      <ErrorState onRetry={() => this.setState(state => ({ failed: false, revision: state.revision + 1 }))}
        onHome={() => { window.location.hash = '#/home'; window.location.reload(); }} />
    </main>;
    return <div key={this.state.revision}>{this.props.children}</div>;
  }
}
