export function formatDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export default function PostCard({ post, user, onView, onEdit, onDelete }) {
  const isOwner = user && Number(user.id) === Number(post.author_id);
  const canEdit = Boolean(user && (isOwner || user.role === 'admin'));
  const canDelete = Boolean(user && user.role === 'admin');
  const authorName = post.author_username || `User #${post.author_id}`;
  const wasEdited = post.updated_at && post.created_at && post.updated_at !== post.created_at;

  return (
    <article className="post-card">
      <div>
        <div className="post-meta">
          <span className="author-chip">
            <span className="author-avatar">{authorName.slice(0, 1).toUpperCase()}</span>
            @{authorName}
          </span>
          <span>
            {formatDate(post.created_at)}
            {wasEdited ? ' · Edited' : ''}
          </span>
        </div>

        <button type="button" className="post-title-btn" onClick={() => onView(post.id)}>
          {post.title}
        </button>

        <p className="post-excerpt">{post.content}</p>
      </div>

      <div className="post-footer">
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => onView(post.id)}>
          Read Article
        </button>

        <div className="post-actions">
          {canEdit && (
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => onEdit(post)}>
              Edit
            </button>
          )}
          {canDelete && (
            <button type="button" className="btn btn-danger btn-sm" onClick={() => onDelete(post)}>
              Delete
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
