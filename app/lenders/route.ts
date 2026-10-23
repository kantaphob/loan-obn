export function GET(request: Request) {
  return Response.redirect(new URL('/dashboard/lenders', request.url), 307)
}
