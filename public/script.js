const state = {
  users: [],
  currentUserId: null,
  selectedProfileId: null,
  posts: [],
  currentView: 'home',
  authMode: 'login',
  activeChatUserId: null,
  notifications: [
    { id: 1, userId: 2, type: 'follow', message: 'Noah started following you.', unread: true },
    { id: 2, userId: 3, type: 'comment', message: 'Mia commented on your post.', unread: false },
    { id: 3, userId: 1, type: 'like', message: 'Ava liked your update.', unread: true }
  ],
  messages: [
    {
      userId: 2,
      thread: [
        { senderId: 2, text: 'You made a great update. Want to collaborate?' },
        { senderId: 1, text: 'Absolutely! Let’s plan something soon.' },
        { senderId: 2, text: 'Perfect. I’ll send the concept deck today.' }
      ]
    },
    {
      userId: 3,
      thread: [
        { senderId: 3, text: 'The photos you shared are stunning.' },
        { senderId: 1, text: 'Thank you! I loved your recent city shots too.' }
      ]
    }
  ],
  theme: localStorage.getItem('alpha-theme') || 'light'
};

const els = {
  authScreen: document.getElementById('authScreen'),
  appShell: document.getElementById('appShell'),
  authForm: document.getElementById('authForm'),
  authSubmitBtn: document.getElementById('authSubmitBtn'),
  authMessage: document.getElementById('authMessage'),
  authTabs: document.querySelectorAll('.auth-tab'),
  registerFields: document.getElementById('registerFields'),
  authIdentifier: document.getElementById('authIdentifier'),
  authPassword: document.getElementById('authPassword'),
  registerName: document.getElementById('registerName'),
  registerUsername: document.getElementById('registerUsername'),
  registerEmail: document.getElementById('registerEmail'),
  themeToggle: document.getElementById('themeToggle'),
  userSelect: document.getElementById('userSelect'),
  currentUserAvatar: document.getElementById('currentUserAvatar'),
  currentUserName: document.getElementById('currentUserName'),
  postInput: document.getElementById('postInput'),
  imageInput: document.getElementById('imageInput'),
  postButton: document.getElementById('postButton'),
  feed: document.getElementById('feed'),
  pageTitle: document.getElementById('pageTitle'),
  profileAvatar: document.getElementById('profileAvatar'),
  profileName: document.getElementById('profileName'),
  profileUsername: document.getElementById('profileUsername'),
  profileBio: document.getElementById('profileBio'),
  postsCount: document.getElementById('postsCount'),
  followersCount: document.getElementById('followersCount'),
  followingCount: document.getElementById('followingCount'),
  followButton: document.getElementById('followButton'),
  logoutButton: document.getElementById('logoutButton'),
  suggestionsList: document.getElementById('suggestionsList')
};

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Request failed');
  }

  return data;
}

function getUserById(userId) {
  return state.users.find((user) => Number(user.id) === Number(userId)) || null;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function setTheme(themeName) {
  state.theme = themeName;
  document.body.classList.toggle('dark-mode', themeName === 'dark');
  localStorage.setItem('alpha-theme', themeName);
  els.themeToggle.textContent = themeName === 'dark' ? '☀️ Light' : '🌙 Dark';
}

function updateAuthMode() {
  const isRegister = state.authMode === 'register';
  els.registerFields.classList.toggle('hidden', !isRegister);
  els.authSubmitBtn.textContent = isRegister ? 'Create account' : 'Login';
  els.authIdentifier.placeholder = isRegister ? 'Email or username' : 'Email or username';
  els.authMessage.textContent = '';
}

function showAuthScreen() {
  els.authScreen.classList.remove('hidden');
  els.appShell.classList.add('hidden');
}

function showAppShell() {
  els.authScreen.classList.add('hidden');
  els.appShell.classList.remove('hidden');
}

function handleLogout() {
  localStorage.removeItem('alpha-user-id');
  localStorage.removeItem('alpha-theme');
  document.cookie = 'alpha_session=; Max-Age=0; path=/; SameSite=Lax';

  state.currentUserId = null;
  state.selectedProfileId = null;
  state.posts = [];
  state.users = [];
  state.activeChatUserId = null;

  if (els.userSelect) {
    els.userSelect.innerHTML = '';
  }

  showAuthScreen();
  setTheme('light');
  els.authMessage.textContent = 'You have been logged out';
  els.authMessage.style.color = '#86efac';
}

async function deletePost(postId) {
  await fetchJson(`/api/posts/${postId}`, {
    method: 'DELETE',
    body: JSON.stringify({ userId: state.currentUserId })
  });

  await loadPosts();

  if (state.currentView === 'profile') {
    renderProfileSection();
  }
}

function renderUserSelect() {
  const currentUser = getUserById(state.currentUserId);
  if (!currentUser) {
    els.userSelect.innerHTML = '';
    els.userSelect.disabled = true;
    return;
  }

  els.userSelect.innerHTML = `<option value="${currentUser.id}">${currentUser.name} (@${currentUser.username})</option>`;
  els.userSelect.value = String(currentUser.id);
  els.userSelect.disabled = true;
}

function renderCurrentUserCard() {
  const user = getUserById(state.currentUserId) || state.users[0];
  if (!user) return;

  els.currentUserAvatar.src = user.avatar;
  els.currentUserName.textContent = user.name;
}

function renderProfileCard() {
  const user = getUserById(state.selectedProfileId) || state.users[0];
  if (!user) return;

  els.profileAvatar.src = user.avatar;
  els.profileName.textContent = user.name;
  els.profileUsername.textContent = `@${user.username}`;
  els.profileBio.textContent = user.bio || 'No bio yet.';

  const posts = state.posts.filter((post) => Number(post.user_id) === Number(user.id));
  els.postsCount.textContent = String(posts.length);
  els.followersCount.textContent = Number(user.followers_count || 0);
  els.followingCount.textContent = Number(user.following_count || 0);

  const isSameUser = Number(user.id) === Number(state.currentUserId);
  const isFollowing = Boolean(user.is_following) && !isSameUser;
  els.followButton.textContent = isSameUser ? 'You' : isFollowing ? 'Following' : 'Follow';
  els.followButton.disabled = isSameUser;
  els.followButton.classList.toggle('following', isFollowing);
  els.followButton.style.opacity = isSameUser ? '0.8' : '1';
}

function renderSuggestions() {
  const suggestions = state.users.filter((user) => Number(user.id) !== Number(state.currentUserId));

  els.suggestionsList.innerHTML = suggestions
    .slice(0, 4)
    .map(
      (user) => `
        <div class="suggestion-item">
          <div class="suggestion-meta">
            <img src="${user.avatar}" alt="${user.name}" />
            <div>
              <strong>${user.name}</strong>
              <span class="username">@${user.username}</span>
            </div>
          </div>
          <button class="follow-btn ${Boolean(user.is_following) ? 'following' : ''}" data-user-id="${user.id}">${Boolean(user.is_following) ? 'Following' : 'Follow'}</button>
        </div>
      `
    )
    .join('');

  els.suggestionsList.querySelectorAll('.follow-btn').forEach((button) => {
    button.addEventListener('click', async () => {
      const targetId = Number(button.dataset.userId);
      await toggleFollow(targetId);
    });
  });
}

function renderMediaMarkup(mediaUrl, altText = 'Post media') {
  if (!mediaUrl) return '';

  const normalized = String(mediaUrl).toLowerCase();
  const isVideo = /data:video\//.test(normalized) || /\.(mp4|webm|ogg)(\?|$)/.test(normalized) || /video\//.test(normalized);

  if (isVideo) {
    return `<video class="post-image post-video" controls playsinline src="${mediaUrl}"></video>`;
  }

  return `<img class="post-image" src="${mediaUrl}" alt="${altText}" />`;
}

function renderPosts() {
  if (!state.posts.length) {
    els.feed.innerHTML = '<div class="card"><p>No posts yet. Start the conversation.</p></div>';
    return;
  }

  els.feed.innerHTML = state.posts
    .map((post) => {
      const user = getUserById(post.user_id) || { name: post.name, username: post.username, avatar: post.avatar };
      const comments = post.comments || [];

      return `
        <article class="post-card">
          <div class="post-header">
            <div class="post-user">
              <img src="${user.avatar}" alt="${user.name}" />
              <div>
                <h3>${user.name}</h3>
                <span class="username">@${user.username}</span>
              </div>
            </div>
            <button class="secondary-btn" data-profile-id="${post.user_id}">View profile</button>
          </div>

          <div class="post-content">${escapeHtml(post.content)}</div>
          ${renderMediaMarkup(post.image, 'Post media')}

          <div class="post-actions">
            <button class="action-btn ${post.liked_by_current_user ? 'liked' : ''}" data-like-id="${post.id}">
              ${post.liked_by_current_user ? '♥ Liked' : '♡ Like'} (${post.likes_count || 0})
            </button>
            <span>💬 ${post.comments_count || comments.length} comments</span>
          </div>

          <div class="comments">
            ${comments
              .map(
                (comment) => `
                  <div class="comment-item">
                    <strong>${comment.name}</strong>
                    <span>${escapeHtml(comment.content)}</span>
                  </div>
                `
              )
              .join('') || '<p class="username">No comments yet.</p>'}

            <div class="comment-form">
              <input type="text" data-comment-input="${post.id}" placeholder="Write a comment" />
              <button data-comment-button="${post.id}">Post</button>
            </div>
          </div>
        </article>
      `;
    })
    .join('');

  els.feed.querySelectorAll('[data-like-id]').forEach((button) => {
    button.addEventListener('click', async () => {
      const postId = Number(button.dataset.likeId);
      await toggleLike(postId);
      await loadPosts();
    });
  });

  els.feed.querySelectorAll('[data-profile-id]').forEach((button) => {
    button.addEventListener('click', () => {
      state.selectedProfileId = Number(button.dataset.profileId);
      setView('profile');
      renderProfileCard();
      els.userSelect.value = String(state.selectedProfileId);
    });
  });

  els.feed.querySelectorAll('[data-comment-button]').forEach((button) => {
    button.addEventListener('click', async () => {
      const commentInput = document.querySelector(`[data-comment-input="${button.dataset.commentButton}"]`);
      const content = commentInput?.value.trim();

      if (!content) return;

      await fetchJson(`/api/posts/${button.dataset.commentButton}/comments`, {
        method: 'POST',
        body: JSON.stringify({ userId: state.currentUserId, content })
      });

      commentInput.value = '';
      await loadPosts();
    });
  });
}

function renderExploreSection() {
  const suggestions = state.users.filter((user) => Number(user.id) !== Number(state.currentUserId));
  const featuredPosts = state.posts.slice(0, 3);

  els.feed.innerHTML = `
    <div class="section-panel">
      <div class="section-header">
        <h2>Discover</h2>
      </div>

      <div class="explore-grid">
        ${suggestions
          .slice(0, 4)
          .map(
            (user) => `
              <div class="discovery-card">
                <div class="meta">
                  <img src="${user.avatar}" alt="${user.name}" />
                  <div class="meta-copy">
                    <strong>${user.name}</strong>
                    <div class="username">@${user.username}</div>
                  </div>
                </div>
                <p>${user.bio || 'Creative thinker exploring new ideas.'}</p>
                <button class="follow-btn ${Boolean(user.is_following) ? 'following' : ''}" data-user-id="${user.id}">${Boolean(user.is_following) ? 'Following' : 'Follow'}</button>
              </div>
            `
          )
          .join('')}
      </div>

      <div class="section-header">
        <h3>Trending posts</h3>
      </div>

      <div class="feed">
        ${featuredPosts
          .map(
            (post) => `
              <article class="post-card">
                <div class="post-header">
                  <div class="post-user">
                    <img src="${getUserById(post.user_id)?.avatar || ''}" alt="${post.name || 'User'}" />
                    <div>
                      <h3>${post.name || 'User'}</h3>
                      <span class="username">@${post.username || 'user'}</span>
                    </div>
                  </div>
                </div>
                <div class="post-content">${escapeHtml(post.content)}</div>
                ${renderMediaMarkup(post.image, 'Trending post media')}
              </article>
            `
          )
          .join('')}
      </div>
    </div>
  `;

  els.feed.querySelectorAll('[data-user-id]').forEach((button) => {
    button.addEventListener('click', async () => {
      await toggleFollow(Number(button.dataset.userId));
      await loadUsers();
      await loadPosts();
      setView('explore');
    });
  });
}

function renderMessagesSection() {
  const selectedUser = getUserById(state.activeChatUserId) || getUserById(state.users[0]?.id);
  const activeThread = state.messages.find((thread) => Number(thread.userId) === Number(selectedUser?.id));

  els.feed.innerHTML = `
    <div class="section-panel">
      <div class="section-header">
        <h2>Messages</h2>
      </div>
      <div class="message-layout card">
        <div class="chat-list">
          ${state.users
            .filter((user) => Number(user.id) !== Number(state.currentUserId))
            .slice(0, 4)
            .map(
              (user) => `
                <button class="chat-item ${Number(user.id) === Number(selectedUser?.id) ? 'active' : ''}" data-chat-user="${user.id}">
                  <img src="${user.avatar}" alt="${user.name}" />
                  <div>
                    <strong>${user.name}</strong>
                    <div class="username">@${user.username}</div>
                  </div>
                </button>
              `
            )
            .join('')}
        </div>

        <div class="chat-window">
          <div class="section-header">
            <h3>${selectedUser ? selectedUser.name : 'Select a chat'}</h3>
          </div>
          ${(activeThread?.thread || [])
            .map(
              (message) => `
                <div class="message-bubble ${message.senderId === state.currentUserId ? 'me' : 'them'}">
                  ${escapeHtml(message.text)}
                </div>
              `
            )
            .join('') || '<p class="username">No messages yet.</p>'}

          <div class="message-input-row">
            <input id="messageInput" type="text" placeholder="Type a message" />
            <button id="sendMessageBtn" type="button">Send</button>
          </div>
        </div>
      </div>
    </div>
  `;

  els.feed.querySelectorAll('[data-chat-user]').forEach((button) => {
    button.addEventListener('click', () => {
      state.activeChatUserId = Number(button.dataset.chatUser);
      renderMessagesSection();
    });
  });

  const sendButton = document.getElementById('sendMessageBtn');
  const messageInput = document.getElementById('messageInput');

  sendButton?.addEventListener('click', () => {
    const text = messageInput?.value.trim();
    if (!text || !selectedUser) return;

    const existing = state.messages.find((thread) => Number(thread.userId) === Number(selectedUser.id));
    if (existing) {
      existing.thread.push({ senderId: state.currentUserId, text });
    } else {
      state.messages.push({ userId: selectedUser.id, thread: [{ senderId: state.currentUserId, text }] });
    }

    messageInput.value = '';
    renderMessagesSection();
  });
}

function renderNotificationsSection() {
  els.feed.innerHTML = `
    <div class="section-panel">
      <div class="section-header">
        <h2>Notifications</h2>
      </div>

      <div class="notifications-list">
        ${state.notifications
          .map(
            (item) => `
              <div class="notification-item ${item.unread ? 'unread' : ''}">
                <div class="meta">
                  <img src="${getUserById(item.userId)?.avatar || ''}" alt="${getUserById(item.userId)?.name || 'User'}" />
                  <div>
                    <strong>${getUserById(item.userId)?.name || 'Someone'}</strong>
                    <div class="username">${item.type}</div>
                  </div>
                </div>
                <div>
                  <div>${escapeHtml(item.message)}</div>
                  <span class="tag">${item.unread ? 'New' : 'Seen'}</span>
                </div>
              </div>
            `
          )
          .join('')}
      </div>
    </div>
  `;
}

function renderProfileSection() {
  const user = getUserById(state.selectedProfileId) || state.users[0];
  const userPosts = state.posts.filter((post) => Number(post.user_id) === Number(user.id));

  els.feed.innerHTML = `
    <div class="section-panel">
      <div class="profile-grid">
        <div class="profile-detail-card">
          <div class="top">
            <img src="${user.avatar}" alt="${user.name}" />
            <div>
              <h2>${user.name}</h2>
              <span class="username">@${user.username}</span>
            </div>
          </div>
          <p>${user.bio || 'No bio yet.'}</p>
          <div class="stats-row">
            <div><strong>${userPosts.length}</strong><span>Posts</span></div>
            <div><strong>${user.followers_count || 0}</strong><span>Followers</span></div>
            <div><strong>${user.following_count || 0}</strong><span>Following</span></div>
          </div>
          <button class="secondary-btn ${Number(user.id) !== Number(state.currentUserId) && user.is_following ? 'following' : ''}" data-profile-action="follow">${Number(user.id) === Number(state.currentUserId) ? 'Your profile' : user.is_following ? 'Following' : 'Follow'}</button>
        </div>

        <div class="card">
          <div class="section-header">
            <h3>Latest Posts</h3>
          </div>
          ${userPosts.length ? userPosts.map((post) => `
            <div class="comment-item">
              <div class="post-header">
                <div class="post-user">
                  <img src="${user.avatar}" alt="${user.name}" />
                  <div>
                    <strong>${user.name}</strong>
                    <div class="username">@${user.username}</div>
                  </div>
                </div>
                ${Number(user.id) === Number(state.currentUserId) ? `<button class="secondary-btn" data-delete-post-id="${post.id}" type="button">Remove post</button>` : ''}
              </div>
              <div>${escapeHtml(post.content)}</div>
            </div>
          `).join('') : '<p class="username">No posts yet.</p>'}
        </div>
      </div>
    </div>
  `;

  els.feed.querySelectorAll('[data-delete-post-id]').forEach((button) => {
    button.addEventListener('click', async () => {
      const postId = Number(button.dataset.deletePostId);
      if (!postId) return;

      await deletePost(postId);
    });
  });

  const followButton = els.feed.querySelector('[data-profile-action="follow"]');
  followButton?.addEventListener('click', async () => {
    if (Number(user.id) === Number(state.currentUserId)) {
      state.selectedProfileId = state.currentUserId;
      setView('profile');
      return;
    }

    await toggleFollow(Number(user.id));
    await loadUsers();
    await loadPosts();
    setView('profile');
  });
}

function setView(viewName) {
  state.currentView = viewName;

  document.querySelectorAll('.nav-item').forEach((button) => {
    button.classList.toggle('active', button.dataset.view === viewName);
  });

  const viewMap = {
    home: 'Social Feed',
    explore: 'Explore',
    messages: 'Messages',
    notifications: 'Notifications',
    profile: 'Profile'
  };

  els.pageTitle.textContent = viewMap[viewName] || 'Social Feed';

  const composerVisible = viewName === 'home';
  const composerSection = document.getElementById('composerSection');
  if (composerSection) {
    composerSection.style.display = composerVisible ? 'block' : 'none';
  }

  switch (viewName) {
    case 'explore':
      renderExploreSection();
      break;
    case 'messages':
      renderMessagesSection();
      break;
    case 'notifications':
      renderNotificationsSection();
      break;
    case 'profile':
      renderProfileSection();
      break;
    default:
      renderPosts();
  }
}

async function loadUsers() {
  const users = await fetchJson(`/api/users?viewerId=${state.currentUserId || 0}`);
  state.users = users.map((user) => ({
    ...user,
    avatar: user.avatar || 'https://api.dicebear.com/7.x/adventurer/svg?seed=' + user.username,
    is_following: Boolean(user.is_following)
  }));

  if (!state.users.some((user) => Number(user.id) === Number(state.currentUserId))) {
    state.currentUserId = state.users[0]?.id || null;
  }

  if (!state.users.some((user) => Number(user.id) === Number(state.selectedProfileId))) {
    state.selectedProfileId = state.currentUserId;
  }

  renderUserSelect();
  renderCurrentUserCard();
  renderProfileCard();
  renderSuggestions();
}

async function loadPosts() {
  if (!state.currentUserId) {
    return;
  }

  state.posts = await fetchJson(`/api/posts?userId=${state.currentUserId}`);
  renderPosts();
  renderProfileCard();
}

async function toggleLike(postId) {
  await fetchJson(`/api/posts/${postId}/like`, {
    method: 'POST',
    body: JSON.stringify({ userId: state.currentUserId })
  });
}

async function readMediaFile(file) {
  if (!file) {
    return '';
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Unable to read selected media file.'));
    reader.readAsDataURL(file);
  });
}

async function toggleFollow(targetUserId) {
  const result = await fetchJson(`/api/users/${targetUserId}/follow`, {
    method: 'POST',
    body: JSON.stringify({ followerId: state.currentUserId })
  });

  const nextFollowing = Boolean(result.following);
  const nextFollowersCount = Number(result.followers_count ?? 0);
  const nextFollowingCount = Number(result.following_count ?? 0);

  const user = getUserById(targetUserId);
  if (user) {
    user.is_following = nextFollowing;
    user.followers_count = nextFollowersCount;
  }

  const stateUser = state.users.find((item) => Number(item.id) === Number(targetUserId));
  if (stateUser) {
    stateUser.is_following = nextFollowing;
    stateUser.followers_count = nextFollowersCount;
  }

  const currentUser = state.users.find((item) => Number(item.id) === Number(state.currentUserId));
  if (currentUser) {
    currentUser.following_count = nextFollowingCount;
  }

  renderProfileCard();
  renderSuggestions();

  if (state.currentView === 'explore') {
    renderExploreSection();
  }
  if (state.currentView === 'profile') {
    renderProfileSection();
  }

  return result;
}

async function handleCreatePost() {
  const content = els.postInput.value.trim();
  const selectedFile = els.imageInput.files && els.imageInput.files[0];
  const image = selectedFile ? await readMediaFile(selectedFile) : '';

  if (!content && !image) {
    alert('Please write something or add an image/video before posting.');
    return;
  }

  await fetchJson('/api/posts', {
    method: 'POST',
    body: JSON.stringify({
      userId: state.currentUserId,
      content,
      image
    })
  });

  els.postInput.value = '';
  els.imageInput.value = '';
  await loadPosts();
}

async function handleAuthSubmit(event) {
  event.preventDefault();

  const isRegister = state.authMode === 'register';
  const identifier = String(els.authIdentifier.value || '').trim();
  const password = String(els.authPassword.value || '');

  try {
    if (isRegister) {
      const name = String(els.registerName.value || '').trim();
      const username = String(els.registerUsername.value || '').trim();
      const email = String(els.registerEmail.value || '').trim();

      if (!name || !username || !email || !password) {
        throw new Error('Please enter your full name, username, email, and password.');
      }

      const result = await fetchJson('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ name, username, email, password, bio: 'New to Alpha Social' })
      });

      els.authMessage.textContent = result.message;
      els.authMessage.style.color = '#86efac';
      state.authMode = 'login';
      updateAuthMode();
      els.authIdentifier.value = username;
      els.authPassword.value = password;
      await handleAuthSubmit(new Event('submit'));
      return;
    }

    if (!identifier || !password) {
      throw new Error('Email or username and password are required.');
    }

    const result = await fetchJson('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier, password })
    });

    const user = result.user;
    state.currentUserId = Number(user.id);
    state.selectedProfileId = state.currentUserId;
    localStorage.setItem('alpha-user-id', String(user.id));
    els.authMessage.textContent = 'Login successful';
    els.authMessage.style.color = '#86efac';
    await loadUsers();
    await loadPosts();
    showAppShell();
    setView('home');
  } catch (error) {
    els.authMessage.textContent = error.message || 'Authentication failed';
    els.authMessage.style.color = '#fca5a5';
  }
}

els.authTabs.forEach((button) => {
  button.addEventListener('click', () => {
    state.authMode = button.dataset.mode;
    els.authTabs.forEach((tab) => tab.classList.toggle('active', tab === button));
    updateAuthMode();
  });
});

els.themeToggle.addEventListener('click', () => {
  const nextTheme = state.theme === 'dark' ? 'light' : 'dark';
  setTheme(nextTheme);
});

els.userSelect.addEventListener('change', (event) => {
  state.currentUserId = Number(event.target.value);
  state.selectedProfileId = state.currentUserId;
  renderCurrentUserCard();
  renderProfileCard();
  loadPosts();
});

els.postButton.addEventListener('click', handleCreatePost);
els.followButton.addEventListener('click', async () => {
  if (Number(state.selectedProfileId) === Number(state.currentUserId)) {
    state.selectedProfileId = state.currentUserId;
    setView('profile');
    return;
  }

  await toggleFollow(state.selectedProfileId);
  await loadUsers();
  await loadPosts();
});
els.logoutButton?.addEventListener('click', handleLogout);

document.querySelectorAll('.nav-item').forEach((button) => {
  button.addEventListener('click', () => {
    const view = button.dataset.view || 'home';
    if (view === 'profile') {
      state.selectedProfileId = state.currentUserId;
    }
    setView(view);
  });
});

async function initializeApp() {
  setTheme(state.theme);
  updateAuthMode();

  try {
    const result = await fetchJson('/api/auth/me');

    if (result && result.id) {
      state.currentUserId = Number(result.id);
      state.selectedProfileId = state.currentUserId;
      localStorage.setItem('alpha-user-id', String(state.currentUserId));
      await loadUsers();
      await loadPosts();
      showAppShell();
      setView('home');
      return;
    }
  } catch (error) {
    localStorage.removeItem('alpha-user-id');
    document.cookie = 'alpha_session=; Max-Age=0; path=/; SameSite=Lax';
    state.currentUserId = null;
    state.selectedProfileId = null;
  }

  state.currentUserId = null;
  state.selectedProfileId = null;
  showAuthScreen();
}

els.authForm.addEventListener('submit', handleAuthSubmit);
window.addEventListener('DOMContentLoaded', initializeApp);
