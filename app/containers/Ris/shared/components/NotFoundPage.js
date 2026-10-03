import React from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';

export default function NotFoundPage({ insideLayout, signedIn }) {
  const homePath = signedIn ? '/ris' : '/login';

  return (
    <main className={`ris-not-found-page${insideLayout ? ' inside-layout' : ''}`}>
      <section aria-labelledby="ris-not-found-title">
        <span className="ris-not-found-code">404</span>
        <h1 id="ris-not-found-title">Halaman tidak ditemukan</h1>
        <p>Alamat yang Anda buka tidak tersedia atau sudah berubah.</p>
        <Link className="ris-button ris-button-blue" to={homePath}>
          {signedIn ? 'Kembali ke Dashboard' : 'Kembali ke Masuk'}
        </Link>
      </section>
    </main>
  );
}

NotFoundPage.propTypes = {
  insideLayout: PropTypes.bool,
  signedIn: PropTypes.bool,
};

NotFoundPage.defaultProps = {
  insideLayout: false,
  signedIn: false,
};
