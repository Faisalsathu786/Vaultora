import { Component } from 'react';

export default class ErrorBoundary extends Component {
  state = { error: null };
  static getDerivedStateFromError(error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <div className="card" style={{ padding: 24, margin: 16, borderRadius: 12, border: '2px solid #f85149' }}>
          <p style={{ color: '#f85149', margin: '0 0 12px', fontWeight: 800, fontSize: '1rem' }}>
            ⚠ Predict Error
          </p>
          <p style={{ color: '#eee', fontSize: '.82rem', fontFamily: 'monospace', wordBreak: 'break-all', margin: 0 }}>
            {String(this.state.error?.message || this.state.error)}
          </p>
          <p style={{ color: '#888', fontSize: '.68rem', margin: '12px 0 0', textAlign: 'center' }}>
            Copy the error above and send to dev
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}
