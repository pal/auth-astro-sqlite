import type { Adapter, AdapterAccount, AdapterSession, AdapterUser, VerificationToken } from "@auth/core/adapters"
import chalk from 'chalk';

const log = (func: string, ...args: any[]) => console.log(chalk.blue(`MemoryAdapter.${func}(${args})`));
const getId = () => Math.random().toString(36).slice(2);

// In-memory database
const users = [] as AdapterUser[];
const accounts = [] as AdapterAccount[];
const sessions = [] as AdapterSession[];
const verificationTokens = [] as VerificationToken[];

export function MemoryAdapter(): Adapter {
  return {
    createUser: (data) => {
      log('createUser', JSON.stringify(data));
      let u = data as AdapterUser;
      u.id = 'userId_' + getId();
      users.push(u);
      log('createUser#return', JSON.stringify(u));
      return u;
    },
    getUser: (id) => {
      log('getUser', id);
      const rv = users.find(u => u.id === id) ?? null;
      log('getUser#return', rv);
      return rv;
    },
    getUserByEmail: (email) => {
      log('getUserByEmail', email);
      const rv = users.find(u => u.email === email) ?? null;
      log('getUserByEmail#return', JSON.stringify(rv));
      return rv;
    },
    getUserByAccount: (provider_providerAccountId) => {
      log('getUserByAccount', JSON.stringify(provider_providerAccountId));
      const account = accounts.find(a => a.providerAccountId === provider_providerAccountId.providerAccountId);
      const user = users.find(u => u.id === account?.userId) ?? null;
      log('getUserByAccount#return', JSON.stringify(user));
      return user;
    },
    updateUser: (user) => {
      log('updateUser', JSON.stringify(user));
      let u = users.find(u => u.id === user.id) ?? user;
      Object.assign(u, user);
      log('updateUser#return', JSON.stringify(u));
      return u as AdapterUser;
    },
    deleteUser: (id) => {
      log('deleteUser', id);
      const user = users.find(u => u.id === id);
      users.splice(users.findIndex(u => u.id === id), 1);
      log('deleteUser#return', user);
      return user;
    },
    createSession: (data) => {
      log('createSession', JSON.stringify(data));
      sessions.push(data);
      log('createSession#return', JSON.stringify(data));
      return data;
    },
    updateSession: (data) => {
      log('updateSession', data);
      let s = sessions.find(s => s.sessionToken === data.sessionToken) ?? data;
      Object.assign(s, data);
      log('updateSession#return', s);
      return s as AdapterSession;
    },
    deleteSession: (sessionToken) => {
      log('deleteSession', sessionToken);
      const session = sessions.find(s => s.sessionToken === sessionToken);
      sessions.splice(sessions.findIndex(s => s.sessionToken === sessionToken), 1);
      log('deleteSession#return', session);
      return session;
    },
    linkAccount: (data) => {
      log('linkAccount', JSON.stringify(data));
      let a = data as AdapterAccount;
      a.id = 'accountId_' + getId();
      accounts.push(a);
      log('linkAccount#return', JSON.stringify(a));
      return a;
    },
    unlinkAccount: (provider_providerAccountId) => {
      log('unlinkAccount', JSON.stringify(provider_providerAccountId));
      const account = accounts.find(a => a.providerAccountId === provider_providerAccountId.providerAccountId);
      accounts.splice(accounts.findIndex(a => a.providerAccountId === provider_providerAccountId.providerAccountId), 1);
      log('unlinkAccount#return', JSON.stringify(account));
      return account;
    },
    getSessionAndUser: (sessionToken) => {
      log('getSessionAndUser', JSON.stringify(sessionToken));
      const session = sessions.find(s => s.sessionToken === sessionToken);
      const user = users.find(u => u.id === session?.userId) ?? null;
      const rv = (session && user) ? { session, user } : null;
      log('getSessionAndUser#return', JSON.stringify(rv));
      return rv;
    },
    createVerificationToken: (data) => {
      log('createVerificationToken', data);
      verificationTokens.push(data);
      log('createVerificationToken#return', data);
      return data;
    },
    useVerificationToken: (identifier_token) => {
      log('useVerificationToken', identifier_token);
      const token = verificationTokens.find(t => t.identifier === identifier_token.identifier && t.token === identifier_token.token);
      verificationTokens.splice(verificationTokens.findIndex(t => t.identifier === identifier_token.identifier && t.token === identifier_token.token), 1);
      const rv = token ?? null;
      log('useVerificationToken#return', rv);
      return rv;
    }
  }
}