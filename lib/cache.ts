import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/**
 * Small read-through cache with a stale fallback.
 *
 * Historical monthly prices barely change, and our free upstream rate-limits
 * aggressively, so a stale answer is far better than an error page. Entries
 * live in the OS temp directory — writable both locally and on Vercel — and an
 * in-process map keeps the hot path off the disk entirely.
 */

const DIRECTORY = join(tmpdir(), 'what-if-i-invested-cache')

type Entry<T> = { value: T; fetchedAt: number }

const memory = new Map<string, Entry<unknown>>()

function fileFor(key: string): string {
  return join(DIRECTORY, `${createHash('sha1').update(key).digest('hex')}.json`)
}

async function read<T>(key: string): Promise<Entry<T> | null> {
  const inMemory = memory.get(key) as Entry<T> | undefined
  if (inMemory) return inMemory
  try {
    const entry = JSON.parse(await readFile(fileFor(key), 'utf8')) as Entry<T>
    memory.set(key, entry)
    return entry
  } catch {
    return null
  }
}

async function write<T>(key: string, value: T): Promise<void> {
  const entry: Entry<T> = { value, fetchedAt: Date.now() }
  memory.set(key, entry)
  try {
    await mkdir(DIRECTORY, { recursive: true })
    await writeFile(fileFor(key), JSON.stringify(entry), 'utf8')
  } catch {
    // A read-only filesystem is survivable — the in-process map still works.
  }
}

export type Cached<T> = { value: T; stale: boolean }

/**
 * Return a fresh value if one is cached, otherwise call `load`. If `load`
 * throws and any cached value exists — however old — hand that back marked
 * stale rather than failing.
 */
export async function cached<T>(
  key: string,
  ttlMs: number,
  load: () => Promise<T>
): Promise<Cached<T>> {
  const entry = await read<T>(key)
  if (entry && Date.now() - entry.fetchedAt < ttlMs) {
    return { value: entry.value, stale: false }
  }

  try {
    const value = await load()
    await write(key, value)
    return { value, stale: false }
  } catch (error) {
    if (entry) return { value: entry.value, stale: true }
    throw error
  }
}

/** Test/seed hook — primes the cache without going upstream. */
export async function seedCache<T>(key: string, value: T): Promise<void> {
  await write(key, value)
}
