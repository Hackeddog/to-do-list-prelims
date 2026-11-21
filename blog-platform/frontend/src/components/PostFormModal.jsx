import { useState } from 'react';

export default function PostFormModal({ initialPost = null, onClose, onSave }) {
  const isEdit = Boolean(initialPost);
  const [title, setTitle] = useState(initialPost?.title || '');
  const [content, setContent] = useState(initialPost?.content || '');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    const cleanTitle = title.trim();
    const cleanContent = content.trim();

    if (!cleanTitle || !cleanContent) {
      setError('Title and content are required.');
      return;
    }

    setError('');
    setSubmitting(true);
    try {
      await onSave({ title: cleanTitle, content: cleanContent }, initialPost?.id || null);
    } catch (err) {
      setError(err.message || 'Unable to save post.');
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="post-form-title">
      <div className="modal-card modal-card-lg">
        <div className="modal-header">
          <h3 id="post-form-title">{isEdit ? 'Edit Post' : 'Write a New Post'}</h3>
          <button type="button" className="close-btn" onClick={onClose} aria-label="Close modal">
            &times;
          </button>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        <form className="form-grid" onSubmit={handleSubmit}>
          <div className="form-field">
            <label htmlFor="post-title">Title</label>
            <input
              id="post-title"
              className="input"
              type="text"
              maxLength={255}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter an engaging headline..."
              required
            />
            <p className="field-hint">{title.length}/255 characters</p>
          </div>

          <div className="form-field">
            <label htmlFor="post-content">Content</label>
            <textarea
              id="post-content"
              className="textarea"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write your article content..."
              required
            />
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Saving...' : isEdit ? 'Save Changes' : 'Publish Post'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
