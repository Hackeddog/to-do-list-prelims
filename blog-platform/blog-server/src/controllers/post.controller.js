const { pool } = require('../../db');

const POST_SELECT = `
  SELECT
    p.id,
    p.author_id,
    u.username AS author_username,
    p.title,
    p.content,
    p.created_at,
    p.updated_at
  FROM posts p
  JOIN users u ON u.id = p.author_id
`;

function parsePostId(rawId) {
  const parsed = Number(rawId);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

async function findPostById(postId) {
  const [rows] = await pool.query(`${POST_SELECT} WHERE p.id = ? LIMIT 1`, [postId]);
  return rows[0] || null;
}

async function listPosts(req, res) {
  const [rows] = await pool.query(`${POST_SELECT} ORDER BY p.created_at DESC, p.id DESC`);
  return res.json(rows);
}

async function getPost(req, res) {
  const postId = parsePostId(req.params.id);
  if (!postId) {
    return res.status(404).json({ error: 'post not found' });
  }

  const post = await findPostById(postId);
  if (!post) {
    return res.status(404).json({ error: 'post not found' });
  }
  return res.json(post);
}

async function createPost(req, res) {
  const { title, content } = req.body || {};
  const normalizedTitle = typeof title === 'string' ? title.trim() : '';
  const normalizedContent = typeof content === 'string' ? content.trim() : '';

  if (!normalizedTitle || !normalizedContent) {
    return res.status(400).json({ error: 'title and content are required' });
  }
  if (normalizedTitle.length > 255) {
    return res.status(400).json({ error: 'title must be 255 characters or fewer' });
  }

  const [result] = await pool.query(
    'INSERT INTO posts (author_id, title, content) VALUES (?, ?, ?)',
    [req.user.id, normalizedTitle, normalizedContent]
  );

  const createdPost = await findPostById(result.insertId);
  return res.status(201).json(createdPost);
}

async function updatePost(req, res) {
  const postId = parsePostId(req.params.id);
  if (!postId) {
    return res.status(404).json({ error: 'post not found' });
  }

  const existingPost = await findPostById(postId);
  if (!existingPost) {
    return res.status(404).json({ error: 'post not found' });
  }

  const isOwner = Number(existingPost.author_id) === Number(req.user.id);
  if (!isOwner && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'you can only update your own posts' });
  }

  const { title, content } = req.body || {};
  if (title === undefined && content === undefined) {
    return res.status(400).json({ error: 'title or content is required' });
  }

  const nextTitle = title !== undefined ? String(title).trim() : existingPost.title;
  const nextContent = content !== undefined ? String(content).trim() : existingPost.content;

  if (!nextTitle || !nextContent) {
    return res.status(400).json({ error: 'title and content cannot be empty' });
  }
  if (nextTitle.length > 255) {
    return res.status(400).json({ error: 'title must be 255 characters or fewer' });
  }

  await pool.query('UPDATE posts SET title = ?, content = ? WHERE id = ?', [
    nextTitle,
    nextContent,
    postId
  ]);

  const updatedPost = await findPostById(postId);
  return res.json(updatedPost);
}

async function deletePost(req, res) {
  const postId = parsePostId(req.params.id);
  if (!postId) {
    return res.status(404).json({ error: 'post not found' });
  }

  const existingPost = await findPostById(postId);
  if (!existingPost) {
    return res.status(404).json({ error: 'post not found' });
  }

  await pool.query('DELETE FROM posts WHERE id = ?', [postId]);
  return res.json({ message: 'post deleted successfully', post: existingPost });
}

async function listMyPosts(req, res) {
  const [rows] = await pool.query(
    `${POST_SELECT} WHERE p.author_id = ? ORDER BY p.created_at DESC, p.id DESC`,
    [req.user.id]
  );
  return res.json(rows);
}

module.exports = {
  listPosts,
  getPost,
  createPost,
  updatePost,
  deletePost,
  listMyPosts
};
