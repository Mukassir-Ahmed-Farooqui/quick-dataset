import { Plug } from 'lucide-react'
import PageHeader from '@/components/common/PageHeader'
import EmptyState from '@/components/common/EmptyState'
import { Button } from '@/components/ui/button'

export default function ProvidersPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Providers"
        description="Manage your LLM API keys. Keys are encrypted at rest."
        action={<Button>Add Key</Button>}
      />
      <EmptyState
        icon={Plug}
        title="No API keys configured"
        description="Add your first LLM provider key to enable generation. Supports OpenRouter, OpenAI, Groq, and Gemini."
        action={<Button>Add API Key</Button>}
      />
    </div>
  )
}
