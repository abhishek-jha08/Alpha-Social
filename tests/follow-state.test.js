const assert = require('node:assert/strict');
const { initializeDatabase, getAllUsers, toggleFollow, deletePost, createPost, db } = require('../database');

(async () => {
  await initializeDatabase();

  await new Promise((resolve, reject) => {
    db.run('DELETE FROM followers', (error) => (error ? reject(error) : resolve()));
  });

  await new Promise((resolve, reject) => {
    db.run('INSERT INTO followers (follower_id, following_id) VALUES (?, ?)', [1, 2], (error) => (error ? reject(error) : resolve()));
  });

  const users = await getAllUsers(1);
  const ava = users.find((user) => user.username === 'ava');
  const mia = users.find((user) => user.username === 'mia');

  assert.ok(Array.isArray(users), 'getAllUsers should return a list of users');
  assert.ok(Object.prototype.hasOwnProperty.call(ava, 'is_following'), 'User objects should include is_following state');
  assert.equal(Number(ava.is_following), 0, 'The current user should not be marked as following themselves');
  assert.equal(Number(mia.is_following), 0, 'Unrelated user should not be marked as following');

  const noah = users.find((user) => user.username === 'noah');
  assert.equal(Number(noah.is_following), 1, 'A user followed by the current user should be marked as followed');

  const toggleResult = await toggleFollow(1, 3);
  assert.equal(toggleResult.following, true, 'Toggle follow should report followed state');

  const refreshedUsers = await getAllUsers(1);
  const refreshedAva = refreshedUsers.find((user) => user.username === 'ava');
  const refreshedMia = refreshedUsers.find((user) => user.username === 'mia');
  assert.equal(Number(refreshedMia.is_following), 1, 'The user should be marked as followed after toggling on');
  assert.equal(Number(refreshedAva.following_count), 2, 'The current user should have one more person in their following count after follow');

  const beforeUnfollow = Number(refreshedMia.followers_count);
  const unfollowResult = await toggleFollow(1, 3);
  assert.equal(unfollowResult.following, false, 'Toggle follow should report unfollowed state');

  const finalUsers = await getAllUsers(1);
  const finalAva = finalUsers.find((user) => user.username === 'ava');
  const finalMia = finalUsers.find((user) => user.username === 'mia');
  assert.equal(Number(finalMia.followers_count), beforeUnfollow - 1, 'Follower count should decrease by exactly one after unfollow');
  assert.equal(Number(finalAva.following_count), 1, 'Following count should decrease by exactly one after unfollow');
  assert.equal(Number(finalMia.is_following), 0, 'The user should be marked as not followed after toggling off');

  const mediaOnlyPost = await createPost(1, '', 'data:video/mp4;base64,AAAA');
  const textAndMediaPost = await createPost(1, 'A mixed post', 'data:image/png;base64,AAAA');
  const createdPosts = await new Promise((resolve, reject) => {
    db.all('SELECT content, image FROM posts WHERE id IN (?, ?) ORDER BY id', [mediaOnlyPost.id, textAndMediaPost.id], (error, rows) => {
      if (error) return reject(error);
      resolve(rows);
    });
  });

  assert.deepEqual(createdPosts, [
    { content: '', image: 'data:video/mp4;base64,AAAA' },
    { content: 'A mixed post', image: 'data:image/png;base64,AAAA' }
  ], 'Posts should support media-only and mixed text/media content');

  await deletePost(mediaOnlyPost.id, 1);
  await deletePost(textAndMediaPost.id, 1);

  const tempPostResult = await new Promise((resolve, reject) => {
    db.run('INSERT INTO posts (user_id, content, image) VALUES (?, ?, ?)', [1, 'Temporary post for delete test', ''], (error) => {
      if (error) return reject(error);
      resolve({ id: this.lastID });
    });
  });

  await deletePost(tempPostResult.id, 1);
  const deletedCheck = await new Promise((resolve, reject) => {
    db.get('SELECT id FROM posts WHERE id = ?', [tempPostResult.id], (error, row) => {
      if (error) return reject(error);
      resolve(row);
    });
  });

  assert.equal(deletedCheck, undefined, 'Delete post should remove the post record from the database');

  console.log('follow-state test passed');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
