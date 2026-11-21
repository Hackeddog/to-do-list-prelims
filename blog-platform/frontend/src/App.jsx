import { useCallback, useEffect, useMemo, useState } from 'react';
import { postsApi } from './api/client';
import { useAuth } from './context/AuthContext';
import AuthModal from './components/AuthModal';
import Header from './components/Header';
import PostCard from './components/PostCard';
import PostDetailModal from './components/PostDetailModal';
import PostFormModal from './components/PostFormModal';

const ROLE_DESCRIPTIONS = {
  reader: 'Signed in as Reader — you can read all posts and inspect your own activity.',
  author: 'Signed in as Author — you can publish new posts and edit your own articles.',
  admin: 'Signed in as Admin — you can publish, edit any post, and delete any post.'
};

export default function App() {
  const { user, initializing, isAuthenticated, canPublish, logout } = useAuth();

  const [activeTab, setActiveTab] = useState('all');
  const [posts, setPosts] = useState([]);
  const [myPosts, setMyPosts] = useState([]);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [postsError, setPostsError] = useState('');

  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState('newest');
  const [feedback, setFeedback] = useState(null);

  const [authModalMode, setAuthModalMode] = useState(null);
  const [viewingPostId, setViewingPostId] = useState(null);
  const [editingPost, setEditingPost] = useState(undefined);
  const [deletingPost, setDeletingPost] = useState(null);
  const [deletingBusy, setDeletingBusy] = useState(false);

  const showToast = useCallback((type, message) => {
    setFeedback({ type, message });
  }, []);

  useEffect(() => {
    if (!feedback) return undefined;
    const timer = setTimeout(() => setFeedback(null), 4500);
    return () => clearTimeout(timer);
  }, [feedback]);

  const fetchAllPosts = useCallback(async () => {
    setLoadingPosts(true);
    setPostsError('');
    try {
      const data = await postsApi.list();
      setPosts(Array.isArray(data) ? data : []);
    } catch (err) {
      setPostsError(err.message || 'Unable to connect to the Blog API.');
    } finally {
      setLoadingPosts(false);
    }
  }, []);

  const fetchMyPosts = useCallback(async () => {
    if (!isAuthenticated) {
      setMyPosts([]);
      return;
    }
    try {
      const data = await postsApi.listMine();
      setMyPosts(Array.isArray(data) ? data : []);
    } catch (err) {
      if (err.status !== 401) {
        showToast('error', err.message || 'Unable to fetch your posts.');
      }
      setMyPosts([]);
    }
  }, [isAuthenticated, showToast]);

  useEffect(() => {
    fetchAllPosts();
  }, [fetchAllPosts]);

  useEffect(() => {
    if (!initializing) {
      fetchMyPosts();
      if (!isAuthenticated && activeTab === 'mine') {
        setActiveTab('all');
      }
    }
  }, [initializing, isAuthenticated, activeTab, fetchMyPosts]);

  const displayedPosts = useMemo(() => {
    const source = activeTab === 'mine' ? myPosts : posts;
    const term = searchQuery.trim().toLowerCase();

    const filtered = term
      ? source.filter(
          (post) =>
            post.title.toLowerCase().includes(term) ||
            post.content.toLowerCase().includes(term) ||
            String(post.author_username || '').toLowerCase().includes(term)
        )
      : [...source];

    filtered.sort((a, b) => {
      const dateA = new Date(a.created_at).getTime() || 0;
      const dateB = new Date(b.created_at).getTime() || 0;
      return sortOrder === 'oldest' ? dateA - dateB : dateB - dateA;
    });

    return filtered;
  }, [activeTab, myPosts, posts, searchQuery, sortOrder]);

  async function handleSavePost(payload, postId) {
    if (postId) {
      await postsApi.update(postId, payload);
      showToast('success', 'Post updated successfully.');
    } else {
      await postsApi.create(payload);
      showToast('success', 'Post published successfully.');
    }
    setEditingPost(undefined);
    await Promise.all([fetchAllPosts(), fetchMyPosts()]);
  }

  async function handleConfirmDelete() {
    if (!deletingPost) return;
    setDeletingBusy(true);
    try {
      await postsApi.remove(deletingPost.id);
      setDeletingPost(null);
      showToast('success', 'Post deleted successfully.');
      await Promise.all([fetchAllPosts(), fetchMyPosts()]);
    } catch (err) {
      showToast('error', err.message || 'Unable to delete post.');
    } finally {
      setDeletingBusy(false);
    }
  }

  async function handleLogout() {
    await logout();
    setActiveTab('all');
    showToast('info', 'You have been logged out.');
  }

  return (
    <div className="app-shell">
      <Header
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        totalCount={posts.length}
        myCount={myPosts.length}
        onOpenAuth={(mode) => setAuthModalMode(mode)}
        onOpenCreate={() => setEditingPost(null)}
        onLogout={handleLogout}
      />

      <main className="container main-content">
        <section className="hero-banner">
          <div>
            <h2>{activeTab === 'mine' ? 'My Published Posts' : 'Community Blog Feed'}</h2>
            <p>
              {isAuthenticated
                ? ROLE_DESCRIPTIONS[user.role]
                : 'Public read access — log in or register as an author or admin to write and manage posts.'}
            </p>
          </div>
          {canPublish && activeTab === 'mine' && (
            <button type="button" className="btn btn-primary" onClick={() => setEditingPost(null)}>
              + Write New Post
            </button>
          )}
        </section>

        {feedback && (
          <div className={`alert alert-${feedback.type}`}>
            <span>{feedback.message}</span>
            <button
              type="button"
              className="close-btn"
              onClick={() => setFeedback(null)}
              aria-label="Dismiss notification"
            >
              &times;
            </button>
          </div>
        )}

        <div className="toolbar">
          <div className="search-group">
            <input
              type="search"
              className="input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search posts by title, content, or author..."
              aria-label="Search posts"
            />
          </div>

          <div style={{ display: 'flex', gap: '0.55rem' }}>
            <select
              className="select sort-select"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              aria-label="Sort posts"
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
            </select>

            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                fetchAllPosts();
                if (isAuthenticated) fetchMyPosts();
              }}
            >
              Refresh
            </button>
          </div>
        </div>

        {postsError && (
          <div className="alert alert-error">
            <span>{postsError} — Make sure Blog Server (port 5000) and MariaDB are running.</span>
            <button type="button" className="btn btn-secondary btn-sm" onClick={fetchAllPosts}>
              Retry
            </button>
          </div>
        )}

        {loadingPosts ? (
          <div className="empty-state">
            <h3>Loading posts...</h3>
            <p>Connecting to the Blog API and MariaDB.</p>
          </div>
        ) : displayedPosts.length === 0 ? (
          <div className="empty-state">
            <h3>{searchQuery ? 'No matching posts found' : 'No posts yet'}</h3>
            <p>
              {searchQuery
                ? 'Try clearing your search filter.'
                : activeTab === 'mine'
                  ? canPublish
                    ? 'You have not published any posts yet. Click "+ Write Post" to create your first article.'
                    : 'Reader accounts can view all posts. Register an Author or Admin account to publish posts.'
                  : 'Be the first author to publish an article!'}
            </p>
          </div>
        ) : (
          <div className="posts-grid">
            {displayedPosts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                user={user}
                onView={(id) => setViewingPostId(id)}
                onEdit={(targetPost) => setEditingPost(targetPost)}
                onDelete={(targetPost) => setDeletingPost(targetPost)}
              />
            ))}
          </div>
        )}
      </main>

      <footer className="site-footer">
        <div className="container">
          Inkwell Blog Platform &bull; Auth Server (:4000) + Blog Server (:5000) + MariaDB + ReactJS
        </div>
      </footer>

      {authModalMode && (
        <AuthModal
          initialMode={authModalMode}
          onClose={() => setAuthModalMode(null)}
          onAuthenticated={(loggedInUser) => {
            setAuthModalMode(null);
            showToast('success', `Welcome back, ${loggedInUser.username} (${loggedInUser.role})!`);
          }}
        />
      )}

      {viewingPostId !== null && (
        <PostDetailModal
          postId={viewingPostId}
          user={user}
          onClose={() => setViewingPostId(null)}
          onEdit={(targetPost) => setEditingPost(targetPost)}
          onDelete={(targetPost) => setDeletingPost(targetPost)}
        />
      )}

      {editingPost !== undefined && (
        <PostFormModal
          initialPost={editingPost}
          onClose={() => setEditingPost(undefined)}
          onSave={handleSavePost}
        />
      )}

      {deletingPost && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="delete-modal-title">
          <div className="modal-card">
            <div className="modal-header">
              <h3 id="delete-modal-title">Delete Post</h3>
              <button
                type="button"
                className="close-btn"
                onClick={() => setDeletingPost(null)}
                aria-label="Close modal"
              >
                &times;
              </button>
            </div>
            <p>
              Are you sure you want to permanently delete <strong>{deletingPost.title}</strong>?
            </p>
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setDeletingPost(null)}
                disabled={deletingBusy}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleConfirmDelete}
                disabled={deletingBusy}
              >
                {deletingBusy ? 'Deleting...' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
