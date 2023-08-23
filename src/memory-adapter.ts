import type { Adapter, AdapterAccount, AdapterSession, AdapterUser, VerificationToken } from "@auth/core/adapters"

const log = (func: string, ...args: any[]) => console.log(`MemoryAdapter.${func}(${args})`);
const getId = () => Math.random().toString(36).slice(2);

// In-memory database
const users = [] as AdapterUser[];
const accounts = [] as AdapterAccount[];
const sessions = [] as AdapterSession[];
const verificationTokens = [] as VerificationToken[];

export function MemoryAdapter(): Adapter {
  return {
    createUser: (data) => {
      log('createUser', data);
      let u = data as AdapterUser;
      u.id = 'userId_' + getId();
      users.push(u);
      return u;
    },
    getUser: (id) => {
      log('getUser', id);
      return users.find(u => u.id === id) ?? null;
    },
    getUserByEmail: (email) => {
      log('getUserByEmail', email);
      return users.find(u => u.email === email) ?? null;
    },
    getUserByAccount: (provider_providerAccountId) => {
      log('getUserByAccount', provider_providerAccountId);
      const account = accounts.find(a => a.providerAccountId === provider_providerAccountId.providerAccountId);
      const user = users.find(u => u.id === account?.userId) ?? null;
      return user;
    },
    updateUser: (user) => {
      log('updateUser', user);
      let u = users.find(u => u.id === user.id) ?? user;
      Object.assign(u, user);
      return u as AdapterUser;
    },
    deleteUser: (id) => {
      log('deleteUser', id);
      const user = users.find(u => u.id === id);
      users.splice(users.findIndex(u => u.id === id), 1);
      return user;
    },
    createSession: (data) => {
      log('createSession', data);
      sessions.push(data);
      return data;
    },
    updateSession: (data) => {
      log('updateSession', data);
      let s = sessions.find(s => s.sessionToken === data.sessionToken) ?? data;
      Object.assign(s, data);
      return s as AdapterSession;
    },
    deleteSession: (sessionToken) => {
      log('deleteSession', sessionToken);
      const session = sessions.find(s => s.sessionToken === sessionToken);
      sessions.splice(sessions.findIndex(s => s.sessionToken === sessionToken), 1);
      return session;
    },
    linkAccount: (data) => {
      log('linkAccount', data);
      let a = data as AdapterAccount;
      a.id = 'accountId_' + getId();
      accounts.push(a);
      return a;
    },
    unlinkAccount: (provider_providerAccountId) => {
      log('unlinkAccount', provider_providerAccountId);
      const account = accounts.find(a => a.providerAccountId === provider_providerAccountId.providerAccountId);
      accounts.splice(accounts.findIndex(a => a.providerAccountId === provider_providerAccountId.providerAccountId), 1);
      return account;
    },
    getSessionAndUser: (sessionToken) => {
      log('getSessionAndUser', sessionToken);
      const session = sessions.find(s => s.sessionToken === sessionToken);
      const user = users.find(u => u.id === session?.userId) ?? null;
      return (session && user) ? { session, user } : null;
    },
    createVerificationToken: (data) => {
      log('createVerificationToken', data);
      verificationTokens.push(data);
      return data;
    },
    useVerificationToken: (identifier_token) => {
      log('useVerificationToken', identifier_token);
      const token = verificationTokens.find(t => t.identifier === identifier_token.identifier && t.token === identifier_token.token);
      verificationTokens.splice(verificationTokens.findIndex(t => t.identifier === identifier_token.identifier && t.token === identifier_token.token), 1);
      return token ?? null;
    }
  }
}