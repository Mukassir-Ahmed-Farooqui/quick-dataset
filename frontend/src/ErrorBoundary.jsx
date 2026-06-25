import React from 'react';

export class GlobalErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    console.error("GlobalErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '20px', background: '#fee', color: '#c00', fontFamily: 'monospace' }}>
          <h2>React Render Crash</h2>
          <p><strong>Error:</strong> {this.state.error && this.state.error.toString()}</p>
          <pre style={{ overflow: 'auto', maxHeight: '400px' }}>
            {this.state.errorInfo && this.state.errorInfo.componentStack}
          </pre>
          <pre style={{ overflow: 'auto', maxHeight: '400px' }}>
            {this.state.error && this.state.error.stack}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}
