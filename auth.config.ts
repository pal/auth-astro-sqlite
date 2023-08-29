import Google from '@auth/core/providers/google';
import { SQLiteAdapter } from './src/sqlite-adapter';
import { MemoryAdapter } from './src/memory-adapter';

export default {
  providers: [
    Google({
      clientId: import.meta.env.GOOGLE_CLIENT_ID,
      clientSecret: import.meta.env.GOOGLE_CLIENT_SECRET
    }),
  ],
  adapter: SQLiteAdapter('demo.db'),
  session: { strategy: 'jwt' }
  // adapter: MemoryAdapter(),
}