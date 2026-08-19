const express = require('express');
const path = require('path');
const crypto = require('crypto');
const {
  initializeDatabase,
  getAllUsers,
  getUserProfile,
  toggleFollow,
  getFeed,
  createPost,
  createComment,
  toggleLike,
  deletePost,
  createUser,
  authenticateUser
} = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;
const SESSION_SECRET = process.env.ALPHA_SESSION_SECRET || 'alpha-social-secret';

function createSessionToken(userId) {
  const signature = crypto.createHmac('sha256', SESSION_SECRET).update(String(userId)).digest('hex');
  return `${userId}:${signature}`;
}

function getSessionUserId(req) {
  const rawCookie = req.headers.cookie || '';
  const match = rawCookie.match(/(?:^|;\s*)alpha_session=([^;]+)/);
  if (!match) {
    return null;
  }

  const token = decodeURIComponent(match[1]);
  if (!token) {
    return null;
  }

  if (!token.includes(':')) {
    const userId = Number(token);
    return Number.isFinite(userId) && userId > 0 ? userId : null;
  }

  const [userId, signature] = token.split(':');
  if (!userId || !signature) {
    return null;
  }

  const expected = crypto.createHmac('sha256', SESSION_SECRET).update(String(userId)).digest('hex');
  try {
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
      return null;
    }
  } catch (error) {
    return null;
  }

  return Number(userId);
}

function requireAuth(req, res, next) {
  const userId = getSessionUserId(req);
  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  req.userId = userId;
  next();
}

const sanitizeUser = (user) => {
  if (!user) return null;
  const { password_hash, ...safe } = user;
  return safe;
};

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Social app server is running' });
});

app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, username, email, password, bio, avatar } = req.body;

    if (!name || !username || !email || !password) {
      return res.status(400).json({ error: 'Name, username, email, and password are required' });
    }

    const user = await createUser({
      name: String(name),
      username: String(username),
      email: String(email),
      password: String(password),
      bio: bio ? String(bio) : '',
      avatar: avatar ? String(avatar) : ''
    });

    return res.status(201).json({
      message: 'Registration successful',
      user: sanitizeUser(user)
    });
  } catch (error) {
    return res.status(400).json({ error: error.message || 'Registration failed' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const identifier = String(req.body.identifier || '').trim();
    const password = String(req.body.password || '');

    if (!identifier || !password) {
      return res.status(400).json({ error: 'Email or username and password are required' });
    }

    const user = await authenticateUser(identifier, password);

    if (!user) {
      return res.status(401).json({ error: 'Invalid email/username or password' });
    }

    const sessionToken = createSessionToken(user.id);
    res.setHeader('Set-Cookie', `alpha_session=${encodeURIComponent(sessionToken)}; Path=/; SameSite=Lax; HttpOnly=false`);

    return res.json({
      message: 'Login successful',
      user: sanitizeUser(user)
    });
  } catch (error) {
    return res.status(500).json({ error: 'Login failed' });
  }
});

app.get('/api/auth/me', requireAuth, async (req, res) => {
  try {
    const user = await getUserProfile(Number(req.userId));

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json(sanitizeUser(user));
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch current user' });
  }
});

app.get('/api/users', requireAuth, async (req, res) => {
  try {
    const viewerId = Number(req.query.viewerId || req.userId);
    const users = await getAllUsers(viewerId);
    res.json(users.map(sanitizeUser));
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

app.get('/api/users/:id', requireAuth, async (req, res) => {
  try {
    if (Number(req.params.id) !== Number(req.userId)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const user = await getUserProfile(Number(req.params.id));

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json(sanitizeUser(user));
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch user profile' });
  }
});

app.get('/api/posts', requireAuth, async (req, res) => {
  try {
    const currentUserId = Number(req.query.userId || req.userId);
    if (currentUserId !== Number(req.userId)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    const posts = await getFeed(currentUserId);
    res.json(posts);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch posts' });
  }
});

app.post('/api/posts', requireAuth, async (req, res) => {
  try {
    const { userId, content, image } = req.body;
    const currentUserId = Number(userId || req.userId);

    if (currentUserId !== Number(req.userId)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (!content) {
      return res.status(400).json({ error: 'User ID and post content are required' });
    }

    const result = await createPost(currentUserId, String(content), image || '');
    res.status(201).json({ success: true, postId: result.id });
  } catch (error) {
    res.status(400).json({ error: error.message || 'Failed to create post' });
  }
});

app.post('/api/posts/:id/comments', requireAuth, async (req, res) => {
  try {
    const postId = Number(req.params.id);
    const { userId, content } = req.body;
    const currentUserId = Number(userId || req.userId);

    if (currentUserId !== Number(req.userId)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (!content) {
      return res.status(400).json({ error: 'User ID and comment content are required' });
    }

    const result = await createComment(postId, currentUserId, String(content));
    res.status(201).json({ success: true, commentId: result.id });
  } catch (error) {
    res.status(400).json({ error: error.message || 'Failed to create comment' });
  }
});

app.post('/api/posts/:id/like', requireAuth, async (req, res) => {
  try {
    const postId = Number(req.params.id);
    const userId = Number(req.body.userId || req.userId);
    if (userId !== Number(req.userId)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    const result = await toggleLike(postId, userId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update like status' });
  }
});

app.delete('/api/posts/:id', requireAuth, async (req, res) => {
  try {
    const postId = Number(req.params.id);
    const userId = Number(req.body.userId || req.userId);

    if (userId !== Number(req.userId)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const result = await deletePost(postId, userId);

    if (!result.deleted) {
      return res.status(404).json({ error: 'Post not found' });
    }

    return res.json({ success: true, deleted: true });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to delete post' });
  }
});

app.post('/api/users/:id/follow', requireAuth, async (req, res) => {
  try {
    const followingId = Number(req.params.id);
    const followerId = Number(req.body.followerId || req.userId);

    if (followerId !== Number(req.userId)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const result = await toggleFollow(followerId, followingId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update follow status' });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

async function startServer() {
  await initializeDatabase();

  app.listen(PORT, () => {
    console.log(`Social media app running at http://localhost:${PORT}`);
  });
}

startServer().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
