export { default } from 'next-auth/middleware'

export const config = {
  matcher: [
    '/admin/:path*',
    '/socio/:path*',
    '/superadmin/:path*',
    '/api/clubs/:path*',
    '/api/notifications/:path*',
    '/api/superadmin/:path*',
  ],
}
