import { useEffect, useState } from 'react';
import { postsApi } from '../api/client';
import { formatDate } from './PostCard';

export default function PostDetailModal({ postId, user, onClose, onEdit, onDelete }) {
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const data = await postsApi.getById(postId);
        if (active) setPost(data);
      } catch (err) {
        if (active) setError(err.message || 'Unable to load post.');
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [postId]);

  const isOwner = post && user && Number(user.id) === Number(post.author_id);
  const canEdit = Boolean(post && user && (isOwner || user.role === 'admin'));
  const canDelete = Boolean(post && user && user.role === 'admin');

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="post-detail-title">
      <div className="modal-card modal-card-lg">
        <div className="modal-header">
          <div>
            <h3 id="post-detail-title">{loading ? 'Loading article...' : post?.title || 'Post'}</h3>
            {post && (
              <p className="field-hint">
                By @{post.author_username || `User #${post.author_id}`} &bull; Published{' '}
                {formatDate(post.created_at)}
                {post.updated_at && post.updated_at !== post.created_at
                  ? ` · Updated ${formatDate(post.updated_at)}`
                  : ''}
              </p>
            )}
          </div>
          <button type="button" className="close-btn" onClick={onClose} aria-label="Close modal">
            &times;
          </button>
        </div>

        {loading && <p className="field-hint">Fetching post details from Blog Server...</p>}
        {error && <div className="alert alert-error">{error}</div>}
        {post && <div className="article-body">{post.content}</div>}

        <div className="modal-footer">
          {canEdit && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                onClose();
                onEdit(post);
              }}
            >
              Edit Post
            </button>
          )}
          {canDelete && (
            <button
              type="button"
              className="btn btn-danger"
              onClick={() => {
                onClose();
                onDelete(post);
              }}
            >
              Delete Post
            </button>
          )}
          <button type="button" className="btn btn-primary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
