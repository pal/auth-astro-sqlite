import Google from '@auth/core/providers/google';

export default {
  providers: [
    Google({
      clientId: import.meta.env.GOOGLE_CLIENT_ID,
      clientSecret: import.meta.env.GOOGLE_CLIENT_SECRET
    }),
  ]
}