import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export default withAuth(
  function middleware(req: NextRequest) {
    // Inject the current pathname as a header so server layouts can read it
    const response = NextResponse.next()
    response.headers.set('x-pathname', req.nextUrl.pathname)
    return response
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        if (!token) return false
        // Super-admin routes require SUPER_ADMIN role (guards against SOCIO/CLUB_ADMIN guessing URL)
        if (req.nextUrl.pathname.startsWith('/superadmin')) {
          return (token as { role?: string }).role === 'SUPER_ADMIN'
        }
        return true
      },
    },
  }
)

export const config = {
  matcher: [
    '/admin/:path*',
    '/socio/:path*',
    '/clubs/:path*',
    '/superadmin/((?!login).*)',
    '/api/clubs/:path*',
    '/api/notifications/:path*',
    '/api/superadmin/:path*',
    '/api/tickets/:path*',
    '/api/dashboard/:path*',
    '/api/profile',
  ],
}
