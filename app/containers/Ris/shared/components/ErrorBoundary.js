import React from 'react';
import PropTypes from 'prop-types';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error, info) {
    // This remains useful in development and can be replaced by the production
    // error-tracking adapter without changing the user-facing fallback.
    this.lastError = error;
    console.error('RIS frontend error', error, info);
  }

  retry = () => {
    this.setState({ failed: false });
    if (typeof window !== 'undefined') window.location.reload();
  };

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="ris-error-boundary" role="alert">
        <div>
          <h1>Halaman tidak dapat ditampilkan</h1>
          <p>Terjadi kesalahan saat memuat halaman. Muat ulang untuk mencoba kembali.</p>
          <button type="button" onClick={this.retry}>Muat ulang</button>
        </div>
      </main>
    );
  }
}

ErrorBoundary.propTypes = { children: PropTypes.node.isRequired };
