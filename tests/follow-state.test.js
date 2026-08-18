const assert = require('node:assert/strict');
const { initializeDatabase, getAllUsers, toggleFollow, db } = require('../database');

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
  const refreshedMia = refreshedUsers.find((user) => user.username === 'mia');
  assert.equal(Number(refreshedMia.is_following), 1, 'The user should be marked as followed after toggling on');

  const beforeUnfollow = Number(refreshedMia.followers_count);
  const unfollowResult = await toggleFollow(1, 3);
  assert.equal(unfollowResult.following, false, 'Toggle follow should report unfollowed state');

  const finalUsers = await getAllUsers(1);
  const finalMia = finalUsers.find((user) => user.username === 'mia');
  assert.equal(Number(finalMia.followers_count), beforeUnfollow - 1, 'Follower count should decrease by exactly one after unfollow');
  assert.equal(Number(finalMia.is_following), 0, 'The user should be marked as not followed after toggling off');

  console.log('follow-state test passed');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
