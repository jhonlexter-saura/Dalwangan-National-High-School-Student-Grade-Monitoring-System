/** Returns a plain user object with password and reset-token fields removed. */
function safeUser(user) {
  const result = user.toObject();

  delete result.password;
  delete result.resetPasswordToken;
  delete result.resetPasswordExpires;

  return result;
}

module.exports = { safeUser };