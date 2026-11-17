import type { LLMProvider } from '@/types/api'

export const PROVIDERS: { value: LLMProvider; label: string; placeholder: string }[] = [
  { value: 'openai', label: 'OpenAI', placeholder: 'sk-…' },
  { value: 'openrouter', label: 'OpenRouter', placeholder: 'sk-or-…' },
  { value: 'groq', label: 'Groq', placeholder: 'gsk_…' },
  { value: 'gemini', label: 'Gemini', placeholder: 'AIza…' },
]

export function providerLabel(p: string) {
  return PROVIDERS.find((x) => x.value === p)?.label ?? p
}
