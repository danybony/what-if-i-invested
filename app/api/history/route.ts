import { NextResponse } from 'next/server'
import { UpstreamError, fetchHistory } from '@/lib/yahoo'

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams
  const symbol = params.get('symbol')?.trim()
  if (!symbol) {
    return NextResponse.json({ error: 'A symbol is required.' }, { status: 400 })
  }

  // 'YYYY-MM' or 'YYYY-MM-DD'; omitted means the full available history.
  const from = params.get('from')?.trim().slice(0, 7) || undefined
  if (from && !/^\d{4}-\d{2}$/.test(from)) {
    return NextResponse.json({ error: 'Invalid "from" month.' }, { status: 400 })
  }

  try {
    return NextResponse.json(await fetchHistory(symbol, from))
  } catch (error) {
    const status = error instanceof UpstreamError ? error.status : 502
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Could not load price history.' },
      { status }
    )
  }
}
