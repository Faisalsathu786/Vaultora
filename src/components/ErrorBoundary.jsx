import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(e) { return { error: e }; }
  render() {
    if (this.state.error) {
      const { error } = this.state.error;
      const msg = error?.message || String(this.state.error);
      return (
        <div className="card" style={{ padding: 20, margin: 16 }}>
          <p style={{ color: '#f87171', margin: '0 0 8px', fontWeight: 700, fontSize: '.85rem' }}>
            Render Error
          </p>
          <p style={{ color: 'var(--dim)', fontSize: '.72rem', fontFamily: 'monospace', wordBreak: 'break-all', margin: 0 }}>
            {msg}
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}
