const express = require('express');
const path = require('path');
const {
  initializeDatabase,
  getAllUsers,
  getUserProfile,
  toggleFollow,
  getFeed,
  createPost,
  createComment,
  toggleLike,
  createUser,
  authenticateUser
} = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

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

    return res.json({
      message: 'Login successful',
      user: sanitizeUser(user)
    });
  } catch (error) {
    return res.status(500).json({ error: 'Login failed' });
  }
});

app.get('/api/users', async (req, res) => {
  try {
    const viewerId = Number(req.query.viewerId || 0);
    const users = await getAllUsers(viewerId);
    res.json(users.map(sanitizeUser));
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

app.get('/api/users/:id', async (req, res) => {
  try {
    const user = await getUserProfile(Number(req.params.id));

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json(sanitizeUser(user));
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch user profile' });
  }
});

app.get('/api/posts', async (req, res) => {
  try {
    const currentUserId = Number(req.query.userId || 1);
    const posts = await getFeed(currentUserId);
    res.json(posts);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch posts' });
  }
});

app.post('/api/posts', async (req, res) => {
  try {
    const { userId, content, image } = req.body;

    if (!userId || !content) {
      return res.status(400).json({ error: 'User ID and post content are required' });
    }

    const result = await createPost(Number(userId), String(content), image || '');
    res.status(201).json({ success: true, postId: result.id });
  } catch (error) {
    res.status(400).json({ error: error.message || 'Failed to create post' });
  }
});

app.post('/api/posts/:id/comments', async (req, res) => {
  try {
    const postId = Number(req.params.id);
    const { userId, content } = req.body;

    if (!userId || !content) {
      return res.status(400).json({ error: 'User ID and comment content are required' });
    }

    const result = await createComment(postId, Number(userId), String(content));
    res.status(201).json({ success: true, commentId: result.id });
  } catch (error) {
    res.status(400).json({ error: error.message || 'Failed to create comment' });
  }
});

app.post('/api/posts/:id/like', async (req, res) => {
  try {
    const postId = Number(req.params.id);
    const userId = Number(req.body.userId || 1);
    const result = await toggleLike(postId, userId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update like status' });
  }
});

app.post('/api/users/:id/follow', async (req, res) => {
  try {
    const followingId = Number(req.params.id);
    const followerId = Number(req.body.followerId || 1);
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
