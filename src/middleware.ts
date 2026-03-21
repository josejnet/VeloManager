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
      authorized: ({ token }) => !!token,
    },
  }
)

export const config = {
  matcher: [
    '/admin/:path*',
    '/socio/:path*',
    '/superadmin/((?!login).*)',
    '/api/clubs/:path*',
    '/api/notifications/:path*',
    '/api/superadmin/:path*',
    '/api/profile',
  ],
}
