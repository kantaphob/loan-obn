import { NextResponse, type NextRequest } from 'next/server'
import { SESSION_COOKIE, verifySessionToken } from '@/lib/auth/session'

export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname === '/login') {
    const requestedPath = request.nextUrl.searchParams.get('next')
    const safeNext = requestedPath && requestedPath.length <= 500 &&
      (requestedPath === '/dashboard' || requestedPath.startsWith('/dashboard/'))
      ? requestedPath
      : null
    const hasUnexpectedParams = [...request.nextUrl.searchParams.keys()].some((key) => key !== 'next')
    const invalidNext = requestedPath !== null && safeNext === null

    if (hasUnexpectedParams || invalidNext) {
      const cleanLoginUrl = request.nextUrl.clone()
      cleanLoginUrl.search = ''
      if (safeNext) cleanLoginUrl.searchParams.set('next', safeNext)
      return NextResponse.redirect(cleanLoginUrl)
    }
    return NextResponse.next()
  }

  const session = verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value)
  if (session) return NextResponse.next()

  const loginUrl = new URL('/login', request.url)
  loginUrl.searchParams.set('next', `${request.nextUrl.pathname}${request.nextUrl.search}`)
  const response = NextResponse.redirect(loginUrl)
  response.cookies.delete(SESSION_COOKIE)
  return response
}

export const config = {
  matcher: ['/dashboard/:path*', '/login'],
}
