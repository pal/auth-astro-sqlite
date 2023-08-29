import type { Adapter, AdapterSession, AdapterUser, VerificationToken } from "@auth/core/adapters";
import Database from "better-sqlite3";

const db = new Database("demo.db", {});
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

const debug = (...args: any[]) => console.log('[SQLiteAdapter]', ...args);

/**
 * Auth.js database adapter for SQLite, based on the Postgres adapter by @jakecoppinger.
 * 
 * The actual schema used by this adapter is defined in `scripts/migrations.ts`, but I've
 * made sure everything is compatible with the standard Auth.js schema as per the docs.
 * 
 * @see https://authjs.dev/reference/adapters#models
 * @see https://github.com/jakecoppinger/next-auth/tree/main/packages/adapter-pg
 */
export default function SQLiteAdapter(options = {}): Adapter {
  return {
    async createUser(user: Omit<AdapterUser, 'id'>): Promise<AdapterUser> {
      debug('createUser', user);
      const sql = `
        INSERT INTO users (name, email, email_verified_at, avatar) 
        VALUES (?, ?, ?, ?)
        RETURNING user_id AS id, name, email, email_verified_at AS emailVerified, avatar AS image`;
      const stmt = db.prepare(sql);
      const rv = stmt.get(user.name, user.email, user.emailVerified, user.image) as AdapterUser;
      debug('createUser.return', rv);
      return rv;
    },

    async getUser(id) {
      debug('getUser', { id });
      const sql = `SELECT user_id AS id, name, email, email_verified_at AS emailVerified, avatar AS image FROM users WHERE user_id = ?`;
      const stmt = db.prepare(sql);
      const rv = stmt.get(id) as AdapterUser;
      debug('getUser.return', rv);
      return rv;
    },

    async getUserByEmail(email) {
      debug('getUserByEmail', { email });
      const sql = `SELECT user_id AS id, name, email, email_verified_at AS emailVerified, avatar AS image FROM users WHERE email = ?`;
      const stmt = db.prepare(sql);
      const rv = stmt.get(email) as AdapterUser;
      debug('getUserByEmail.return', rv);
      return rv;
    },

    async getUserByAccount({ providerAccountId, provider }): Promise<AdapterUser | null> {
      debug('getUserByAccount', { providerAccountId, provider });
      const sql = `
        SELECT u.user_id AS id, u.name, u.email, u.email_verified_at AS emailVerified, u.avatar AS image 
        FROM users u, login_provider_accounts lpa
        WHERE u.user_id = lpa.user_id AND lpa.provider_user_id = ? AND lpa.provider = ?`;
      const stmt = db.prepare(sql);
      const rv = stmt.get(providerAccountId, provider) as AdapterUser;
      debug('getUserByAccount.return', rv);
      return rv;
    },

    async updateUser(user: Partial<AdapterUser>): Promise<AdapterUser> {
      debug('updateUser', user);
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
      debug('updateUser.return', rv);
      return rv;
    },

    async deleteUser(userId: string) {
      debug('deleteUser', { userId });
      await db.prepare(`DELETE FROM users WHERE user_id = ?`).run(userId);
      await db.prepare(`DELETE FROM login_provider_accounts WHERE user_id = ?`).run(userId);
      await db.prepare(`DELETE FROM sessions WHERE user_id = ?`).run(userId);
      // Don't delete organizations or other application specific data here
    },

    async linkAccount(account) {
      debug('linkAccount', account);
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
      // return rv; // TODO Shouldn't this return the account?
      debug('linkAccount.return', rv);
    },

    async unlinkAccount({ providerAccountId, provider }) {
      debug('unlinkAccount', { providerAccountId, provider });
      await db.prepare(`DELETE FROM login_provider_accounts WHERE provider_user_id = ? AND provider = ?`).run(providerAccountId, provider);
    },

    async createSession({ sessionToken, userId, expires }) {
      debug('createSession', { sessionToken, userId, expires });
      // convert js date to unix timestamp
      let expiresAt: number;
      if (expires instanceof Date) {
        expiresAt = Math.round(expires.getTime() / 1000);
      } else if (typeof expires === 'number') {
        expiresAt = expires;
      } else {
        throw new Error('Cannot create session without valid expires date, got: ' + JSON.stringify(expires));
      }
      debug('createSession', { sessionToken, userId, expiresAt });
      if (!userId || !sessionToken) {
        throw new Error('Cannot create session without valid userId and sessionToken, got: ' + JSON.stringify({ sessionToken, userId, expiresAt }));
      }

      const sql = `
        INSERT INTO sessions (user_id, expires_at, session_token)
        VALUES (?, datetime(?, 'unixepoch'), ?) 
        RETURNING session_id AS id, session_token AS sessionToken, user_id AS userId, unixepoch(expires_at) AS expires`;
      const stmt = db.prepare(sql);
      const rv = stmt.get(userId, expiresAt, sessionToken) as AdapterSession;
      rv.expires = new Date(rv.expires);
      debug('createSession.return', rv);
      return rv;
    },

    async getSessionAndUser(sessionToken: string | undefined): Promise<{
      session: AdapterSession; user: AdapterUser;
    } | null> {
      debug('getSessionAndUser', { sessionToken });
      if (!sessionToken || sessionToken?.length === 0) {
        console.warn('SQLiteAdapter.getSessionAndUser called without sessionToken');
        return null;
      }

      // TODO: Check if session is expired
      const sql = `SELECT session_id AS id, user_id AS userId, unixepoch(expires_at) AS expires, session_token AS sessionToken FROM sessions WHERE session_token = ?`;
      const session = db.prepare(sql).get(sessionToken) as AdapterSession;
      // session.expires = new Date(session.expires);

      if (!session) {
        debug('found no session, return null');
        return null;
      }

      // Get the user object. Note that we cannot us this.getUser() because ES6 arrow functions don't automatically bind `this`.
      const sql_get = `SELECT user_id AS id, name, email, email_verified_at AS emailVerified, avatar AS image FROM users WHERE user_id = ?`;
      const stmt_get = db.prepare(sql_get);
      const user = stmt_get.get(session.userId) as AdapterUser;

      if (!user) {
        debug('found no user, return null');
        return null;
      }

      debug('getSessionAndUser.return', { session, user });
      return {
        session,
        user,
      };
    },

    async updateSession(session: Partial<AdapterSession> & Pick<AdapterSession, "sessionToken">):
      Promise<AdapterSession | null | undefined> {
      debug('updateSession', { session });
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
      debug('updateSession.return', rv);
      return rv;
    },

    async deleteSession(sessionToken) {
      debug('deleteSession', { sessionToken });
      await db.prepare(`DELETE FROM sessions WHERE session_token = ?`).run(sessionToken);
    },

    async createVerificationToken(verificationToken: VerificationToken): Promise<VerificationToken> {
      debug('createVerificationToken', { verificationToken });
      const { identifier, expires, token } = verificationToken;
      const sql = `
        INSERT INTO verification_tokens (verification_token_id, expires_at, token) 
        VALUES (?, datetime(?, 'unixepoch'), ?)
        RETURNING verification_token_id AS identifier, unixepoch(expires_at) AS expires, token`;
      const stmt = db.prepare(sql);
      const rv = stmt.get(identifier, expires, token) as VerificationToken;
      debug('createVerificationToken.return', rv);
      return rv;
    },

    async useVerificationToken({ identifier, token }: { identifier: string; token: string }):
      Promise<VerificationToken> {
      debug('useVerificationToken', { identifier, token });
      const sql = `
        DELETE FROM verification_tokens
        WHERE verification_token_id = ? AND token = ?
        RETURNING verification_token_id AS identifier, unixepoch(expires_at) AS expires, token`;
      const stmt = db.prepare(sql);
      const rv = stmt.get(identifier, token) as VerificationToken;
      debug('useVerificationToken.return', rv);
      return rv;
    }
  }
}