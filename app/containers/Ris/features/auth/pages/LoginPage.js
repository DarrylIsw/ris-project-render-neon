/* eslint-disable object-curly-newline, object-property-newline, no-multiple-empty-lines, prefer-destructuring, no-use-before-define, react/prop-types */
import React, { useState } from 'react';
import { useHistory } from 'react-router-dom';
import { useRis } from '../../../core/RisContext';
import { FloatingError } from '../../../shared/components/Ui';

export default function LoginPage() {
  const { login } = useRis();
  const history = useHistory();
  const [form, setForm] = useState({ email: '', password: '', remember: false, code: '' });
  const [mfa, setMfa] = useState(null);
  const [error, setError] = useState('');

  const submit = async event => {
    event.preventDefault();
    setError('');
    try {
      const result = await login(form.email, form.password, form.remember, mfa ? form.code : undefined);
      if (result === true) history.replace('/ris');
      else if (result && result.requiresMfa) setMfa(result);
      else setError(mfa ? 'Kode autentikator tidak sesuai atau sudah digunakan.' : 'Email atau kata sandi tidak sesuai.');
    } catch (requestError) {
      setError(requestError.message || 'Tidak dapat menghubungi server.');
    }
  };

  return (
    <div className="ris-login">
      <section className="ris-login-hero">
        <img src="/images/ris/login-background.png" alt="Latar belakang UMN" className="ris-login-bg" />
        <div className="ris-login-title">
          <img src="/images/ris/4-circles.png" alt="" />
          <h1>Research Innovation and Sustainability</h1>
        </div>
      </section>
      <section className="ris-login-panel">
        <img src="/images/ris/ris-logo.png" alt="Logo RIS" className="ris-login-logo" />
        <h2>{mfa ? 'Verifikasi akun' : 'Masuk'}</h2>
        <form onSubmit={submit}>
          <FloatingError message={error} />
          {!mfa ? <>
            <label className="ris-sr-only" htmlFor="ris-login-email">Email</label>
            <input id="ris-login-email" type="email" placeholder="Email" required autoComplete="email" value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} />
            <label className="ris-sr-only" htmlFor="ris-login-password">Kata Sandi</label>
            <input id="ris-login-password" type="password" placeholder="Kata sandi" required autoComplete="current-password" value={form.password} onChange={event => setForm({ ...form, password: event.target.value })} />
            <div className="ris-login-options">
              <label><input type="checkbox" checked={form.remember} onChange={event => setForm({ ...form, remember: event.target.checked })} /> Ingat saya</label>
              <button type="button">Lupa kata sandi?</button>
            </div>
          </> : <>
            {mfa.setupKey && <div className="ris-mfa-setup">
              <p>Tambahkan RIS UMN di aplikasi autentikator menggunakan kunci berikut.</p>
              <code>{mfa.setupKey}</code>
              <button type="button" onClick={() => navigator.clipboard.writeText(mfa.setupKey)}>Salin kunci</button>
            </div>}
            <label htmlFor="ris-login-code">Kode autentikator</label>
            <input id="ris-login-code" type="text" inputMode="numeric" pattern="[0-9]{6}" maxLength="6" required autoComplete="one-time-code" value={form.code} onChange={event => setForm({ ...form, code: event.target.value.replace(/\D/g, '').slice(0, 6) })} />
          </>}
          <button type="submit" className="ris-login-submit">{mfa ? 'Verifikasi dan masuk' : 'Masuk'}</button>
          {mfa && <button type="button" className="ris-login-back" onClick={() => { setMfa(null); setForm({ ...form, password: '', code: '' }); setError(''); }}>Kembali</button>}
        </form>
        {!mfa && <><div className="ris-login-divider"><span />Atau masuk dengan<span /></div>
          <button type="button" className="ris-sso">Sistem Masuk Tunggal (SSO)</button></>}
      </section>
    </div>
  );
}
