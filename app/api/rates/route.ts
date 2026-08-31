import { NextResponse } from 'next/server'
import { fetchDepositRates } from '@/lib/ecb'

export async function GET() {
  try {
    return NextResponse.json(await fetchDepositRates())
  } catch (error) {
    // The UI degrades to a manually typed bank rate rather than blanking out.
    return NextResponse.json(
      {
        monthlyRates: {},
        latest: null,
        source: 'ECB',
        error: error instanceof Error ? error.message : 'Could not load ECB rates.',
      },
      { status: 502 }
    )
  }
}
