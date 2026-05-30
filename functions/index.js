// Auth blocking example: deny sign-in/create for non-allowlisted Google emails
// Deploy with: firebase deploy --only functions

const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();

const ALLOWED_EMAIL = 'bouchard.joseph92@gmail.com';

// Note: Auth blocking triggers require enabling in Firebase and the appropriate SDK versions.
// This example uses the beforeCreate and beforeSignIn hooks to reject unwanted accounts.

exports.beforeCreate = functions.auth.user().beforeCreate((user, context) => {
  const email = (user.email || '').toLowerCase();
  if (email && email !== ALLOWED_EMAIL.toLowerCase()) {
    console.log('Rejecting create for', email);
    throw new functions.auth.HttpsError('invalid-argument', 'Email not allowed');
  }
  return user;
});

exports.beforeSignIn = functions.auth.user().beforeSignIn((user, context) => {
  const email = (user.email || '').toLowerCase();
  if (email && email !== ALLOWED_EMAIL.toLowerCase()) {
    console.log('Rejecting sign-in for', email);
    throw new functions.auth.HttpsError('invalid-argument', 'Email not allowed');
  }
  return user;
});
