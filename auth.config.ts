import Google from '@auth/core/providers/google';
import { MemoryAdapter } from './src/memory-adapter';

export default {
  providers: [
    Google({
      clientId: import.meta.env.GOOGLE_CLIENT_ID,
      clientSecret: import.meta.env.GOOGLE_CLIENT_SECRET
    }),
  ],
  adapter: MemoryAdapter(),
}