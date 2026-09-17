/**
 * Universal backend proxy — forwards every /api/* request server-side
 * to the FastAPI backend at 127.0.0.1:8000.
 *
 * This is more reliable than next.config.mjs rewrites (which can have
 * Turbopack edge-cases). The route runs on the Next.js server so there
 * are no CORS or IPv6 (localhost → ::1) issues.
 */
import { NextRequest, NextResponse } from "next/server"

const BACKEND = process.env.BACKEND_URL ?? "http://127.0.0.1:8000"

async function proxy(req: NextRequest, path: string[]): Promise<NextResponse> {
  const qs     = req.nextUrl.search          // ?foo=bar  (may be empty)
  const target = `${BACKEND}/api/${path.join("/")}${qs}`

  // Forward all relevant headers (drop host — the backend has its own)
  const fwdHeaders = new Headers()
  req.headers.forEach((value, key) => {
    if (!["host", "connection"].includes(key.toLowerCase())) {
      fwdHeaders.set(key, value)
    }
  })

  const hasBody = !["GET", "HEAD"].includes(req.method)
  const body    = hasBody ? await req.arrayBuffer() : undefined

  try {
    const backendRes = await fetch(target, {
      method:  req.method,
      headers: fwdHeaders,
      body,
    })

    const resBody    = await backendRes.arrayBuffer()
    const resHeaders = new Headers()

    // Copy response headers from backend
    backendRes.headers.forEach((value, key) => {
      if (!["transfer-encoding", "connection"].includes(key.toLowerCase())) {
        resHeaders.set(key, value)
      }
    })

    return new NextResponse(resBody, {
      status:     backendRes.status,
      statusText: backendRes.statusText,
      headers:    resHeaders,
    })
  } catch (err) {
    console.error("[Proxy] Backend unreachable:", err)
    return NextResponse.json(
      { detail: "Backend is not reachable. Make sure uvicorn is running on port 8000." },
      { status: 503 }
    )
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params
  return proxy(req, path)
}
export async function POST(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params
  return proxy(req, path)
}
export async function PUT(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params
  return proxy(req, path)
}
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params
  return proxy(req, path)
}
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params
  return proxy(req, path)
}
