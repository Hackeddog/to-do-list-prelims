import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

const ROLE_HINTS = {
  reader: 'Browse and read published posts.',
  author: 'Create posts and edit your own articles.',
  admin: 'Full access: create, edit, and delete any post.'
};

export default function AuthModal({ initialMode = 'login', onClose, onAuthenticated }) {
  const { login, register } = useAuth();
  const [mode, setMode] = useState(initialMode);
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('reader');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isRegister = mode === 'register';

  function switchMode(nextMode) {
    setMode(nextMode);
    setError('');
    setNotice('');
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setNotice('');
    setSubmitting(true);

    try {
      if (isRegister) {
        await register({
          email: email.trim(),
          username: username.trim(),
          password,
          role
        });
        setMode('login');
        setPassword('');
        setNotice('Account created successfully. You can now log in.');
      } else {
        const loggedInUser = await login({
          username: username.trim(),
          password
        });
        onAuthenticated(loggedInUser);
      }
    } catch (err) {
      setError(err.message || 'Authentication failed.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="auth-modal-title">
      <div className="modal-card">
        <div className="modal-header">
          <h3 id="auth-modal-title">{isRegister ? 'Create an Account' : 'Welcome Back'}</h3>
          <button type="button" className="close-btn" onClick={onClose} aria-label="Close modal">
            &times;
          </button>
        </div>

        <div className="tabs">
          <button
            type="button"
            className={`tab-btn ${!isRegister ? 'active' : ''}`}
            onClick={() => switchMode('login')}
          >
            Login
          </button>
          <button
            type="button"
            className={`tab-btn ${isRegister ? 'active' : ''}`}
            onClick={() => switchMode('register')}
          >
            Register
          </button>
        </div>

        {notice && <div className="alert alert-success">{notice}</div>}
        {error && <div className="alert alert-error">{error}</div>}

        <form className="form-grid" onSubmit={handleSubmit}>
          {isRegister && (
            <div className="form-field">
              <label htmlFor="auth-email">Email</label>
              <input
                id="auth-email"
                className="input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
              />
            </div>
          )}

          <div className="form-field">
            <label htmlFor="auth-username">{isRegister ? 'Username' : 'Username or Email'}</label>
            <input
              id="auth-username"
              className="input"
              type="text"
              maxLength={isRegister ? 50 : 255}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder={isRegister ? 'Choose a username (max 50 chars)' : 'Enter username or email'}
              required
            />
          </div>

          <div className="form-field">
            <label htmlFor="auth-password">Password</label>
            <input
              id="auth-password"
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              required
            />
          </div>

          {isRegister && (
            <div className="form-field">
              <label htmlFor="auth-role">Role</label>
              <select
                id="auth-role"
                className="select"
                value={role}
                onChange={(e) => setRole(e.target.value)}
              >
                <option value="reader">Reader</option>
                <option value="author">Author</option>
                <option value="admin">Admin</option>
              </select>
              <p className="field-hint">{ROLE_HINTS[role]}</p>
            </div>
          )}

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Please wait...' : isRegister ? 'Create Account' : 'Login'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
