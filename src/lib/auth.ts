import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import GoogleProvider from 'next-auth/providers/google'
import GitHubProvider from 'next-auth/providers/github'
import { compare, hash } from 'bcryptjs'
import { prisma } from '@/lib/prisma'

export const authOptions: NextAuthOptions = {
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  providers: [
    // ── Email + Password ──────────────────────────────────────────────────
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        const user = await prisma.user.findUnique({
          where: { email: credentials.email.toLowerCase() },
        })

        if (!user || !user.password) return null

        const passwordValid = await compare(credentials.password, user.password)
        if (!passwordValid) return null

        return { id: user.id, email: user.email, name: user.name, role: user.role }
      },
    }),

    // ── Google OAuth ──────────────────────────────────────────────────────
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [GoogleProvider({
          clientId: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        })]
      : []),

    // ── GitHub OAuth ──────────────────────────────────────────────────────
    ...(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET
      ? [GitHubProvider({
          clientId: process.env.GITHUB_CLIENT_ID,
          clientSecret: process.env.GITHUB_CLIENT_SECRET,
        })]
      : []),
  ],

  callbacks: {
    async signIn({ user, account }) {
      if (!account || account.type === 'credentials') return true

      // OAuth sign-in: create or link account
      const email = user.email?.toLowerCase()
      if (!email) return false

      let dbUser = await prisma.user.findUnique({ where: { email } })

      if (!dbUser) {
        dbUser = await prisma.user.create({
          data: {
            email,
            name: user.name ?? email.split('@')[0],
            password: null, // OAuth users have no password
          },
        })
      }

      // Check if this OAuth account is already linked to a DIFFERENT user (account takeover prevention)
      const existingOAuth = await prisma.oAuthAccount.findUnique({
        where: {
          provider_providerAccountId: {
            provider: account.provider,
            providerAccountId: account.providerAccountId,
          },
        },
      })
      if (existingOAuth && existingOAuth.userId !== dbUser.id) {
        // This provider account is linked to a different user — deny login
        return false
      }

      // Upsert OAuth account link
      await prisma.oAuthAccount.upsert({
        where: {
          provider_providerAccountId: {
            provider: account.provider,
            providerAccountId: account.providerAccountId,
          },
        },
        create: {
          userId: dbUser.id,
          provider: account.provider,
          providerAccountId: account.providerAccountId,
          accessToken: account.access_token,
          refreshToken: account.refresh_token,
          expiresAt: account.expires_at,
        },
        update: {
          accessToken: account.access_token,
          refreshToken: account.refresh_token,
          expiresAt: account.expires_at,
        },
      })

      // Inject DB user id so jwt callback gets it
      user.id = dbUser.id
      return true
    },

    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        // Fetch role from DB
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: { role: true },
        })
        token.role = dbUser?.role ?? 'SOCIO'
      }
      return token
    },

    async session({ session, token }) {
      if (session.user) {
        (session.user as { id: string }).id = token.id as string;
        (session.user as { role: string }).role = token.role as string
      }
      return session
    },
  },
}
