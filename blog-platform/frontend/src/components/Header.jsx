import { useAuth } from '../context/AuthContext';

export default function Header({
  activeTab,
  onSelectTab,
  totalCount,
  myCount,
  onOpenAuth,
  onOpenCreate,
  onLogout
}) {
  const { user, isAuthenticated, canPublish } = useAuth();

  return (
    <header className="site-header">
      <div className="container header-inner">
        <div className="brand">
          <div className="brand-mark">IB</div>
          <div>
            <h1>Inkwell Blog</h1>
            <p>ExpressJS &bull; MariaDB &bull; ReactJS</p>
          </div>
        </div>

        <nav className="header-nav" aria-label="Primary navigation">
          <button
            type="button"
            className={`nav-tab ${activeTab === 'all' ? 'active' : ''}`}
            onClick={() => onSelectTab('all')}
          >
            All Posts ({totalCount})
          </button>
          {isAuthenticated && (
            <button
              type="button"
              className={`nav-tab ${activeTab === 'mine' ? 'active' : ''}`}
              onClick={() => onSelectTab('mine')}
            >
              My Posts ({myCount})
            </button>
          )}
        </nav>

        <div className="header-auth">
          {canPublish && (
            <button type="button" className="btn btn-primary" onClick={onOpenCreate}>
              + Write Post
            </button>
          )}

          {isAuthenticated ? (
            <>
              <div className="user-pill" title={user.email || user.username}>
                <span>@{user.username}</span>
                <span className={`role-badge role-${user.role}`}>{user.role}</span>
              </div>
              <button type="button" className="btn btn-secondary" onClick={onLogout}>
                Logout
              </button>
            </>
          ) : (
            <>
              <button type="button" className="btn btn-secondary" onClick={() => onOpenAuth('login')}>
                Login
              </button>
              <button type="button" className="btn btn-primary" onClick={() => onOpenAuth('register')}>
                Register
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
