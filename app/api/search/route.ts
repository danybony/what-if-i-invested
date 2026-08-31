import { NextResponse } from 'next/server'
import { UpstreamError, searchSymbols } from '@/lib/yahoo'

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get('q')?.trim() ?? ''
  if (query.length < 2) return NextResponse.json({ results: [] })

  try {
    return NextResponse.json({ results: await searchSymbols(query) })
  } catch (error) {
    const status = error instanceof UpstreamError ? error.status : 502
    return NextResponse.json(
      { results: [], error: error instanceof Error ? error.message : 'Search failed.' },
      { status }
    )
  }
}
