import type { ChunkStrategy } from '@/types/api'

export interface ChunkConfig {
  strategy: ChunkStrategy
  chunkSize: number
  chunkOverlap: number
}

export const DEFAULT_CHUNK_CONFIG: ChunkConfig = { strategy: 'recursive', chunkSize: 500, chunkOverlap: 50 }

export const STRATEGIES: { value: ChunkStrategy; label: string; desc: string }[] = [
  { value: 'recursive', label: 'Recursive', desc: 'Paragraphs → sentences → characters. Best default.' },
  { value: 'markdown', label: 'Markdown', desc: 'Splits on headings; keeps sections together.' },
  { value: 'token', label: 'Token', desc: 'Fixed token windows with overlap.' },
]

/** Returns a human error, or null when the config can be sent. */
export function validateChunkConfig(c: ChunkConfig): string | null {
  if (!Number.isFinite(c.chunkSize) || c.chunkSize < 50) return 'Chunk size must be at least 50.'
  if (c.chunkSize > 8000) return 'Chunk size can be at most 8,000.'
  if (!Number.isFinite(c.chunkOverlap) || c.chunkOverlap < 0) return 'Overlap cannot be negative.'
  if (c.chunkOverlap >= c.chunkSize) return 'Overlap must be smaller than the chunk size.'
  return null
}
