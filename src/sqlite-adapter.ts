import type { Adapter, AdapterAccount, AdapterSession, AdapterUser, VerificationToken } from "@auth/core/adapters"
import Database from "better-sqlite3";
import { MemoryAdapter } from "./memory-adapter";
import chalk from 'chalk';

const log = (func: string, ...args: any[]) => console.log(chalk.magenta(`SQLiteAdapter.${func}(${args})`));

// In-memory database fallback
// const memDB = MemoryAdapter();

// fake proxy adapter
const memDB = new Proxy({} as Adapter, {
  get: function(target, prop, receiver) {
    return function() {
      return null;
    };
  }
});

export function SQLiteAdapter(dbName: string): Adapter {
  const db = new Database(dbName, {});
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  return {
    createUser: (user) => {
      log('createUser', JSON.stringify(user));
      memDB.createUser(user);
      const sql = `
        INSERT INTO users (name, email, email_verified_at, avatar) 
        VALUES (?, ?, ?, ?)
        RETURNING user_id AS id, name, email, email_verified_at AS emailVerified, avatar AS image`;
      const stmt = db.prepare(sql);
      const rv = stmt.get(user.name, user.email, user.emailVerified, user.image) as AdapterUser;
      log('createUser#return', JSON.stringify(rv));
      return rv;
    },
    getUser: (id) => {
      log('getUser', id);
      const sql = `SELECT user_id AS id, name, email, email_verified_at AS emailVerified, avatar AS image FROM users WHERE user_id = ?`;
      const stmt = db.prepare(sql);
      const rv = stmt.get(id) as AdapterUser;
      log('getUser#return', rv);
      return rv ?? memDB.getUser(id);
    },
    getUserByEmail: (email) => {
      log('getUserByEmail', email);
      const sql = `SELECT user_id AS id, name, email, email_verified_at AS emailVerified, avatar AS image FROM users WHERE email = ?`;
      const stmt = db.prepare(sql);
      const rv = stmt.get(email) as AdapterUser;
      log('getUserByEmail#return', JSON.stringify(rv));
      return rv ?? memDB.getUserByEmail(email);
    },
    getUserByAccount: (account) => {
      log('getUserByAccount', JSON.stringify(account));
      const memRv = memDB.getUserByAccount(account);
      const sql = `
        SELECT u.user_id AS id, u.name, u.email, u.email_verified_at AS emailVerified, u.avatar AS image 
        FROM users u, login_provider_accounts lpa
        WHERE u.user_id = lpa.user_id AND lpa.provider_user_id = ? AND lpa.provider = ?`;
      const stmt = db.prepare(sql);
      const rv = stmt.get(account.providerAccountId, account.provider) as AdapterUser;
      log('getUserByAccount#return', JSON.stringify(rv));
      return rv ?? memRv;
    },
    updateUser: (user) => {
      log('updateUser', user);
      const memRv = memDB.updateUser(user);
      if (!user || !user.id) {
        throw new Error('Cannot update invalid user object, got: ' + JSON.stringify(user));
      }

      // Get the old user object. Note that we cannot use this.getUser() because ES6 arrow functions don't automatically bind `this`.
      const sql_get = `SELECT user_id AS id, name, email, email_verified_at AS emailVerified, avatar AS image FROM users WHERE user_id = ?`;
      const stmt_get = db.prepare(sql_get);
      const oldUser = stmt_get.get(user.id) as AdapterUser;
      const newUser = {
        ...oldUser,
        ...user
      }

      const sql = `
        UPDATE users SET
        name = ?, 
        email = ?,
        email_verified_at = ?,
        avatar = ?
        WHERE user_id = ?
        RETURNING user_id AS id, name, email, email_verified_at AS emailVerified, avatar AS image`;
      const stmt = db.prepare(sql);
      const rv = stmt.get(newUser.name, newUser.email, newUser.emailVerified, newUser.image, newUser.id) as AdapterUser;
      log('updateUser#return', rv);
      return rv ?? memRv;
    },
    deleteUser: async (userId) => {
      log('deleteUser', userId);
      memDB.deleteUser!(userId);
      await db.prepare(`DELETE FROM users WHERE user_id = ?`).run(userId);
      await db.prepare(`DELETE FROM login_provider_accounts WHERE user_id = ?`).run(userId);
      await db.prepare(`DELETE FROM sessions WHERE user_id = ?`).run(userId);
    },
    createSession: (session) => {
      log('createSession', JSON.stringify(session));
      const memRv = memDB.createSession(session);
      let expiresAt: number;
      if (session.expires instanceof Date) {
        expiresAt = Math.round(session.expires.getTime() / 1000);
      } else if (typeof session.expires === 'number') {
        expiresAt = session.expires;
      } else {
        throw new Error('Cannot create session without valid expires date, got: ' + JSON.stringify(session.expires));
      }
      if (!session.userId || !session.sessionToken) {
        throw new Error('Cannot create session without valid userId and sessionToken, got: ' + JSON.stringify(session));
      }

      const sql = `
        INSERT INTO sessions (user_id, expires_at, session_token)
        VALUES (?, datetime(?, 'unixepoch'), ?) 
        RETURNING session_token AS sessionToken, user_id AS userId, unixepoch(expires_at) AS expires`;
      const stmt = db.prepare(sql);
      const rv = stmt.get(session.userId, expiresAt, session.sessionToken) as AdapterSession;
      rv.expires = new Date(rv.expires);
      log('createSession#return', JSON.stringify(rv));
      return rv ?? memRv;
    },
    updateSession: (session) => {
      log('updateSession', JSON.stringify(session));
      const memRv = memDB.updateSession(session);

      const { sessionToken } = session;
      if (!sessionToken || sessionToken?.length === 0) {
        console.warn('SQLiteAdapter.updateSession called without sessionToken');
        return null;
      }

      const sql = `SELECT session_id AS id, user_id AS userId, unixepoch(expires_at) AS expires, session_token AS sessionToken FROM sessions WHERE session_token = ?`;
      const originalSession = db.prepare(sql).get(sessionToken) as AdapterSession;

      const newSession: AdapterSession = {
        ...originalSession,
        ...session
      }
      const updateSql = `
        UPDATE sessions SET
        user_id = ?,
        expires_at = datetime(?, 'unixepoch')
        WHERE session_token = ?
        RETURNING session_id AS id, user_id AS userId, unixepoch(expires_at) AS expires, session_token AS sessionToken`;
      const stmt = db.prepare(updateSql);
      const rv = stmt.get(newSession.userId, newSession.expires, newSession.sessionToken) as AdapterSession;
      rv.expires = new Date(rv.expires);
      log('updateSession#return', JSON.stringify(rv));
      return rv ?? memRv;
    },
    deleteSession: async (sessionToken) => {
      log('deleteSession', JSON.stringify(sessionToken));
      memDB.deleteSession(sessionToken);
      await db.prepare(`DELETE FROM sessions WHERE session_token = ?`).run(sessionToken);
    },
    linkAccount: async (account) => {
      log('linkAccount', JSON.stringify(account));
      const memRv = memDB.linkAccount(account);
      const sql = `
      INSERT INTO login_provider_accounts (
        user_id, provider, type, provider_user_id, access_token, expires_at, 
        refresh_token, id_token, scope, session_state, token_type)
      VALUES (?, ?, ?, ?, ?, datetime(?, 'unixepoch'), ?, ?, ?, ?, ?)
      RETURNING login_id AS id, user_id AS userId, provider, type, provider_user_id AS providerAccountId, 
        access_token, unixepoch(expires_at), refresh_token, id_token, scope, session_state, token_type`;
      const stmt = db.prepare(sql);
      const rv = stmt.get(account.userId,
        account.provider,
        account.type,
        account.providerAccountId,
        account.access_token,
        account.expires_at,
        account.refresh_token,
        account.id_token,
        account.scope,
        account.session_state,
        account.token_type);
      log('linkAccount#void-result', JSON.stringify(rv));
    },
    unlinkAccount: async (account) => {
      log('unlinkAccount', JSON.stringify(account));
      const memRv = memDB.unlinkAccount!(account);
      // find the account first, then delete it
      const sql = `
        SELECT login_id AS id, user_id AS userId, provider, type, provider_user_id AS providerAccountId, 
          access_token, unixepoch(expires_at), refresh_token, id_token, scope, session_state, token_type
        FROM login_provider_accounts
        WHERE provider_user_id = ? AND provider = ?`;
      const stmt = db.prepare(sql);
      const rv = stmt.get(account.providerAccountId, account.provider) as AdapterAccount;

      await db.prepare(`DELETE FROM login_provider_accounts WHERE provider_user_id = ? AND provider = ?`).run(account.providerAccountId, account.provider);
      log('unlinkAccount#return', JSON.stringify(rv));
      return rv ?? memRv;
    },
    getSessionAndUser: (sessionToken) => {
      log('getSessionAndUser', sessionToken);
      const memRv = memDB.getSessionAndUser(sessionToken);
      if (!sessionToken || sessionToken?.length === 0) {
        console.warn('SQLiteAdapter.getSessionAndUser: called without sessionToken');
        return null;
      }

      // TODO: Check if session is expired
      const sql = `SELECT session_id AS id, user_id AS userId, unixepoch(expires_at) AS expires, session_token AS sessionToken FROM sessions WHERE session_token = ?`;
      const session = db.prepare(sql).get(sessionToken) as AdapterSession;
      // session.expires = new Date(session.expires);

      if (!session) {
        console.warn('SQLiteAdapter.getSessionAndUser: found no session, return null');
        return null;
      }

      // Get the user object. Note that we cannot us this.getUser() because ES6 arrow functions don't automatically bind `this`.
      const sql_get = `SELECT user_id AS id, name, email, email_verified_at AS emailVerified, avatar AS image FROM users WHERE user_id = ?`;
      const stmt_get = db.prepare(sql_get);
      const user = stmt_get.get(session.userId) as AdapterUser;

      if (!user) {
        console.warn('SQLiteAdapter.getSessionAndUser: found no user, return null');
        return null;
      }

      log('getSessionAndUser#return', JSON.stringify({ session, user }));
      return (session && user) ? { session, user } : memRv;
    },
    createVerificationToken: (token) => {
      log('createVerificationToken', token);
      const memRv = memDB.createVerificationToken!(token);
      const sql = `
      INSERT INTO verification_tokens (verification_token_id, expires_at, token) 
      VALUES (?, datetime(?, 'unixepoch'), ?)
      RETURNING verification_token_id AS identifier, unixepoch(expires_at) AS expires, token`;
      const stmt = db.prepare(sql);
      const rv = stmt.get(token.identifier, token.expires, token.token) as VerificationToken;
      log('createVerificationToken#return', rv);
      return rv ?? memRv;
    },
    useVerificationToken: (token) => {
      log('useVerificationToken', token);
      const memRv = memDB.useVerificationToken!(token);
      const sql = `
      DELETE FROM verification_tokens
      WHERE verification_token_id = ? AND token = ?
      RETURNING verification_token_id AS identifier, unixepoch(expires_at) AS expires, token`;
      const stmt = db.prepare(sql);
      const rv = stmt.get(token.identifier, token.token) as VerificationToken;
      log('useVerificationToken#return', rv);
      return rv ?? memRv;
    }
  }
}