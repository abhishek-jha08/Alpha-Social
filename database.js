const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');

const dbPath = path.join(__dirname, 'social.db');
const db = new sqlite3.Database(dbPath);

const run = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) {
        reject(err);
        return;
      }

      resolve({ id: this.lastID, changes: this.changes });
    });
  });

const get = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) {
        reject(err);
        return;
      }

      resolve(row);
    });
  });

const all = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) {
        reject(err);
        return;
      }

      resolve(rows);
    });
  });

async function initializeDatabase() {
  const userTableInfo = await all('PRAGMA table_info(users)');

  if (!userTableInfo.length) {
    await run(`
      CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        bio TEXT,
        avatar TEXT DEFAULT 'https://api.dicebear.com/7.x/adventurer/svg?seed=default',
        password_hash TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);
  } else {
    const columns = new Set(userTableInfo.map((column) => column.name));

    if (!columns.has('email')) {
      await run('ALTER TABLE users ADD COLUMN email TEXT');
    }

    if (!columns.has('password_hash')) {
      await run('ALTER TABLE users ADD COLUMN password_hash TEXT');
    }

    if (!columns.has('created_at')) {
      await run('ALTER TABLE users ADD COLUMN created_at TEXT');
    }
  }

  const users = await all('SELECT * FROM users ORDER BY id');

  for (const user of users) {
    let nextEmail = user.email ? String(user.email).trim() : '';

    if (!nextEmail) {
      const base = (user.username || `user${user.id}`)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '') || `user${user.id}`;

      let candidate = `${base}@example.com`;
      let index = 1;

      while (await get('SELECT id FROM users WHERE LOWER(email) = LOWER(?) AND id != ?', [candidate, user.id])) {
        candidate = `${base}${index}@example.com`;
        index += 1;
      }

      nextEmail = candidate;
      await run('UPDATE users SET email = ? WHERE id = ?', [nextEmail, user.id]);
    }

    if (!user.password_hash) {
      await run('UPDATE users SET password_hash = ? WHERE id = ?', [bcrypt.hashSync('Password123!', 10), user.id]);
    }
  }

  await run('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username)');
  await run('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email)');

  await run(`
    CREATE TABLE IF NOT EXISTS posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      image TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (post_id) REFERENCES posts(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS followers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      follower_id INTEGER NOT NULL,
      following_id INTEGER NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(follower_id, following_id),
      FOREIGN KEY (follower_id) REFERENCES users(id),
      FOREIGN KEY (following_id) REFERENCES users(id)
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS likes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      post_id INTEGER NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, post_id),
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (post_id) REFERENCES posts(id)
    )
  `);

  const userCount = await get('SELECT COUNT(*) AS count FROM users');

  if (userCount.count === 0) {
    const seedUsers = [
      {
        name: 'Ava Brooks',
        username: 'ava',
        email: 'ava@example.com',
        password: 'Password123!',
        bio: 'Designer, traveler, coffee enthusiast.',
        avatar: 'https://api.dicebear.com/7.x/adventurer/svg?seed=ava'
      },
      {
        name: 'Noah Carter',
        username: 'noah',
        email: 'noah@example.com',
        password: 'Password123!',
        bio: 'Full-stack maker building cool products.',
        avatar: 'https://api.dicebear.com/7.x/adventurer/svg?seed=noah'
      },
      {
        name: 'Mia Johnson',
        username: 'mia',
        email: 'mia@example.com',
        password: 'Password123!',
        bio: 'Photojournalist and creative storyteller.',
        avatar: 'https://api.dicebear.com/7.x/adventurer/svg?seed=mia'
      }
    ];

    for (const user of seedUsers) {
      await run(
        'INSERT INTO users (name, username, email, bio, avatar, password_hash) VALUES (?, ?, ?, ?, ?, ?)',
        [user.name, user.username, user.email, user.bio, user.avatar, bcrypt.hashSync(user.password, 10)]
      );
    }

    const users = await all('SELECT * FROM users ORDER BY id');

    const posts = [
      {
        user_id: users[0].id,
        content: 'Morning walk, fresh air, and a big idea for the next product launch.',
        image: 'https://images.unsplash.com/photo-1493246507139-91e8fad9978e?auto=format&fit=crop&w=1200&q=80'
      },
      {
        user_id: users[1].id,
        content: 'Building a lifestyle dashboard for creators. Progress feels good.',
        image: ''
      },
      {
        user_id: users[2].id,
        content: 'Weekend vibes: camera in hand and a city full of stories.',
        image: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80'
      }
    ];

    for (const post of posts) {
      await run('INSERT INTO posts (user_id, content, image) VALUES (?, ?, ?)', [post.user_id, post.content, post.image]);
    }

    const allPosts = await all('SELECT * FROM posts ORDER BY id');
    await run('INSERT INTO comments (post_id, user_id, content) VALUES (?, ?, ?)', [allPosts[0].id, users[1].id, 'This looks amazing!']);
    await run('INSERT INTO comments (post_id, user_id, content) VALUES (?, ?, ?)', [allPosts[1].id, users[2].id, 'Love the idea. Keep shipping!']);
    await run('INSERT INTO likes (user_id, post_id) VALUES (?, ?)', [users[1].id, allPosts[0].id]);
    await run('INSERT INTO likes (user_id, post_id) VALUES (?, ?)', [users[2].id, allPosts[0].id]);
    await run('INSERT INTO likes (user_id, post_id) VALUES (?, ?)', [users[0].id, allPosts[1].id]);
    await run('INSERT INTO followers (follower_id, following_id) VALUES (?, ?)', [users[1].id, users[0].id]);
    await run('INSERT INTO followers (follower_id, following_id) VALUES (?, ?)', [users[2].id, users[0].id]);
    await run('INSERT INTO followers (follower_id, following_id) VALUES (?, ?)', [users[0].id, users[1].id]);
  }
}

async function getUserById(id, viewerId = null) {
  const currentViewerId = Number(viewerId || 0);

  return get(
    `SELECT u.id, u.name, u.username, u.email, u.bio, u.avatar,
      (SELECT COUNT(*) FROM posts WHERE user_id = u.id) AS posts_count,
      (SELECT COUNT(*) FROM followers WHERE following_id = u.id) AS followers_count,
      (SELECT COUNT(*) FROM followers WHERE follower_id = u.id) AS following_count,
      CASE
        WHEN ? > 0 AND u.id != ? AND EXISTS (
          SELECT 1 FROM followers f WHERE f.follower_id = ? AND f.following_id = u.id
        ) THEN 1
        ELSE 0
      END AS is_following
    FROM users u
    WHERE u.id = ?`,
    [currentViewerId, currentViewerId, currentViewerId, id]
  );
}

async function getAllUsers(viewerId = null) {
  const currentViewerId = Number(viewerId || 0);

  return all(
    `SELECT u.id, u.name, u.username, u.email, u.bio, u.avatar,
      (SELECT COUNT(*) FROM posts WHERE user_id = u.id) AS posts_count,
      (SELECT COUNT(*) FROM followers WHERE following_id = u.id) AS followers_count,
      (SELECT COUNT(*) FROM followers WHERE follower_id = u.id) AS following_count,
      CASE
        WHEN ? > 0 AND u.id != ? AND EXISTS (
          SELECT 1 FROM followers f WHERE f.follower_id = ? AND f.following_id = u.id
        ) THEN 1
        ELSE 0
      END AS is_following
    FROM users u
    ORDER BY u.id`,
    [currentViewerId, currentViewerId, currentViewerId]
  );
}

async function getUserProfile(userId) {
  const user = await getUserById(userId);
  if (!user) return null;
  return user;
}

async function authenticateUser(identifier, password) {
  const cleanIdentifier = String(identifier || '').trim();
  const user = await get(
    'SELECT * FROM users WHERE LOWER(email) = LOWER(?) OR LOWER(username) = LOWER(?)',
    [cleanIdentifier, cleanIdentifier]
  );

  if (!user) {
    return null;
  }

  const isValid = bcrypt.compareSync(password, user.password_hash);
  if (!isValid) {
    return null;
  }

  const { password_hash, ...safeUser } = user;
  return {
    ...safeUser,
    posts_count: await get('SELECT COUNT(*) AS count FROM posts WHERE user_id = ?', [user.id]).then((row) => row.count),
    followers_count: await get('SELECT COUNT(*) AS count FROM followers WHERE following_id = ?', [user.id]).then((row) => row.count),
    following_count: await get('SELECT COUNT(*) AS count FROM followers WHERE follower_id = ?', [user.id]).then((row) => row.count)
  };
}

async function createUser({ name, username, email, password, bio = '', avatar = '' }) {
  const normalizedName = String(name || '').trim();
  const normalizedUsername = String(username || '').trim();
  const normalizedEmail = String(email || '').trim().toLowerCase();

  if (!normalizedName || !normalizedUsername || !normalizedEmail || !password) {
    throw new Error('Name, username, email, and password are required');
  }

  if (password.length < 8) {
    throw new Error('Password must be at least 8 characters long');
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    throw new Error('Please enter a valid email address');
  }

  const existing = await get('SELECT id FROM users WHERE LOWER(username) = LOWER(?) OR LOWER(email) = LOWER(?)', [normalizedUsername, normalizedEmail]);
  if (existing) {
    throw new Error('A user with that username or email already exists');
  }

  const result = await run(
    'INSERT INTO users (name, username, email, bio, avatar, password_hash) VALUES (?, ?, ?, ?, ?, ?)',
    [normalizedName, normalizedUsername, normalizedEmail, bio.trim(), avatar || `https://api.dicebear.com/7.x/adventurer/svg?seed=${normalizedUsername}`, bcrypt.hashSync(password, 10)]
  );

  return getUserById(result.id);
}

async function getUserPosts(userId) {
  return all(
    `SELECT p.*, u.name, u.username, u.avatar,
      (SELECT COUNT(*) FROM likes WHERE post_id = p.id) AS likes_count,
      (SELECT COUNT(*) FROM comments WHERE post_id = p.id) AS comments_count
     FROM posts p
     JOIN users u ON u.id = p.user_id
     WHERE p.user_id = ?
     ORDER BY p.created_at DESC`,
    [userId]
  );
}

async function toggleFollow(followerId, followingId) {
  if (followerId === followingId) {
    return { following: false, followers_count: await get('SELECT COUNT(*) AS count FROM followers WHERE following_id = ?', [followingId]).then((row) => Number(row.count || 0)) };
  }

  const existing = await get(
    'SELECT * FROM followers WHERE follower_id = ? AND following_id = ?',
    [followerId, followingId]
  );

  if (existing) {
    await run('DELETE FROM followers WHERE follower_id = ? AND following_id = ?', [followerId, followingId]);
    const followersCount = await get('SELECT COUNT(*) AS count FROM followers WHERE following_id = ?', [followingId]).then((row) => Number(row.count || 0));
    return { following: false, followers_count: followersCount };
  }

  await run('INSERT INTO followers (follower_id, following_id) VALUES (?, ?)', [followerId, followingId]);
  const followersCount = await get('SELECT COUNT(*) AS count FROM followers WHERE following_id = ?', [followingId]).then((row) => Number(row.count || 0));
  return { following: true, followers_count: followersCount };
}

async function getFeed(currentUserId) {
  const rows = await all(
    `SELECT p.*, u.name, u.username, u.avatar,
      (SELECT COUNT(*) FROM likes WHERE post_id = p.id) AS likes_count,
      (SELECT COUNT(*) FROM comments WHERE post_id = p.id) AS comments_count,
      (SELECT COUNT(*) FROM likes WHERE post_id = p.id AND user_id = ?) AS liked_by_current_user
     FROM posts p
     JOIN users u ON u.id = p.user_id
     ORDER BY p.created_at DESC`,
    [currentUserId]
  );

  const posts = [];

  for (const post of rows) {
    const comments = await all(
      `SELECT c.*, u.name, u.username, u.avatar
       FROM comments c
       JOIN users u ON u.id = c.user_id
       WHERE c.post_id = ?
       ORDER BY c.created_at ASC`,
      [post.id]
    );

    posts.push({
      ...post,
      liked_by_current_user: Boolean(post.liked_by_current_user),
      comments
    });
  }

  return posts;
}

async function createPost(userId, content, image = '') {
  const cleanContent = content.trim();

  if (!cleanContent) {
    throw new Error('Post content is required');
  }

  const result = await run(
    'INSERT INTO posts (user_id, content, image) VALUES (?, ?, ?)',
    [userId, cleanContent, image]
  );

  return { id: result.id };
}

async function createComment(postId, userId, content) {
  const cleanContent = content.trim();

  if (!cleanContent) {
    throw new Error('Comment content is required');
  }

  const result = await run(
    'INSERT INTO comments (post_id, user_id, content) VALUES (?, ?, ?)',
    [postId, userId, cleanContent]
  );

  return { id: result.id };
}

async function toggleLike(postId, userId) {
  const existing = await get('SELECT * FROM likes WHERE post_id = ? AND user_id = ?', [postId, userId]);

  if (existing) {
    await run('DELETE FROM likes WHERE post_id = ? AND user_id = ?', [postId, userId]);
    return { liked: false };
  }

  await run('INSERT INTO likes (post_id, user_id) VALUES (?, ?)', [postId, userId]);
  return { liked: true };
}

module.exports = {
  db,
  initializeDatabase,
  getAllUsers,
  getUserById,
  getUserProfile,
  getUserPosts,
  toggleFollow,
  getFeed,
  createPost,
  createComment,
  toggleLike,
  createUser,
  authenticateUser,
  all,
  get,
  run
};
