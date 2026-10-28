// Route handlers run without a Next request store in persistence integration tests.
export async function connection() {}
export { NextResponse } from 'next/dist/server/web/spec-extension/response.js'
