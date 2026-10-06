const session = require("express-session");
const { get: getRow, run } = require("./database");

class SQLiteSessionStore extends session.Store {
  get(sessionId, callback) {
    getRow("SELECT sess, expires FROM sessions WHERE sid = ?", sessionId)
      .then(async (row) => {
        if (!row) return callback(null, null);
        if (row.expires <= Date.now()) {
          await run("DELETE FROM sessions WHERE sid = ?", sessionId);
          return callback(null, null);
        }
        return callback(null, JSON.parse(row.sess));
      })
      .catch(callback);
  }

  set(sessionId, sessionData, callback = () => {}) {
    const expires = sessionData.cookie?.expires
      ? new Date(sessionData.cookie.expires).getTime()
      : Date.now() + (sessionData.cookie?.maxAge || 8 * 60 * 60 * 1000);
    run(`
        INSERT INTO sessions (sid, sess, expires) VALUES (?, ?, ?)
        ON CONFLICT(sid) DO UPDATE SET sess = excluded.sess, expires = excluded.expires
      `, sessionId, JSON.stringify(sessionData), expires)
      .then(() => callback(null))
      .catch(callback);
  }

  touch(sessionId, sessionData, callback = () => {}) {
    const expires = sessionData.cookie?.expires
      ? new Date(sessionData.cookie.expires).getTime()
      : Date.now() + (sessionData.cookie?.maxAge || 8 * 60 * 60 * 1000);
    run("UPDATE sessions SET expires = ? WHERE sid = ?", expires, sessionId)
      .then(() => callback(null))
      .catch(callback);
  }

  destroy(sessionId, callback = () => {}) {
    run("DELETE FROM sessions WHERE sid = ?", sessionId)
      .then(() => callback(null))
      .catch(callback);
  }
}

module.exports = SQLiteSessionStore;
