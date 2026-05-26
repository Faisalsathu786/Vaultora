import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null, info: '' };
  }
  static getDerivedStateFromError(e) {
    return { error: e };
  }
  componentDidCatch(error, info) {
    this.setState({ info: info?.componentStack || '' });
  }
  render() {
    if (this.state.error) {
      const msg = this.state.error?.message || String(this.state.error);
      return (
        <div className="card" style={{ padding: 24, margin: 16, borderRadius: 12, border: '2px solid #f85149' }}>
          <p style={{ color: '#f85149', margin: '0 0 12px', fontWeight: 800, fontSize: '1rem' }}>
            ⚠ Render Error
          </p>
          <div style={{ background: 'rgba(248,81,73,.08)', padding: 12, borderRadius: 8, marginBottom: 12 }}>
            <p style={{ color: '#fbbf24', margin: '0 0 4px', fontSize: '.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px' }}>Message</p>
            <p style={{ color: '#eee', fontSize: '.82rem', fontFamily: 'monospace', wordBreak: 'break-all', margin: 0, lineHeight: 1.4 }}>{msg}</p>
          </div>
          {this.state.info && (
            <div style={{ background: 'rgba(255,255,255,.03)', padding: 12, borderRadius: 8 }}>
              <p style={{ color: '#888', margin: '0 0 4px', fontSize: '.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px' }}>Stack</p>
              <pre style={{ color: '#777', fontSize: '.65rem', fontFamily: 'monospace', lineHeight: 1.3, margin: 0, whiteSpace: 'pre-wrap', maxHeight: 200, overflow: 'auto' }}>{this.state.info}</pre>
            </div>
          )}
          <p style={{ color: '#888', fontSize: '.68rem', margin: '12px 0 0', textAlign: 'center' }}>
            Copy the <b>Message</b> above and send to your dev to fix.
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}
