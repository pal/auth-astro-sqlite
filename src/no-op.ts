import type { Adapter } from "@auth/core/adapters"

const fake = (func: string, ...args: any[]) => { console.log(`NoOpAdapter.${func}(${args})`); return func as any; };

export function NoOpAdapter(): Adapter {
  return {
    createUser: (data) => fake('createUser', data),
    getUser: (id) => fake('getUser', id),
    getUserByEmail: (email) => fake('getUserByEmail', email),
    getUserByAccount: (provider_providerAccountId) => fake('getUserByAccount', provider_providerAccountId),
    updateUser: ({ id, ...data }) => fake('updateUser', id, data),
    deleteUser: (id) => fake('deleteUser', id),
    linkAccount: (data) => fake('linkAccount', data),
    unlinkAccount: (provider_providerAccountId) => fake('unlinkAccount', provider_providerAccountId),
    getSessionAndUser: (sessionToken) => fake('getSessionAndUser', sessionToken),
    createSession: (data) => fake('createSession', data),
    updateSession: (data) => fake('updateSession', data),
    deleteSession: (sessionToken) => fake('deleteSession', sessionToken),
    createVerificationToken: (data) => fake('createVerificationToken', data),
    useVerificationToken: (identifier_token) => fake('useVerificationToken', identifier_token),
  }
}