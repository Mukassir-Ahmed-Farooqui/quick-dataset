import { useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Loader2, RotateCw } from 'lucide-react'
import { Select } from '@/components/ui/input'
import { useProviderModels, useUpdateProvider } from '@/hooks/useProviders'
import { providersApi } from '@/api/providers'
import { toast } from '@/lib/toast'
import type { LLMKeyOut } from '@/types/api'

interface ModelPickerProps {
  keyData: LLMKeyOut
}

/** Dropdown of the models this key can use, saved as the key's selected_model. */
export default function ModelPicker({ keyData }: ModelPickerProps) {
  const qc = useQueryClient()
  const { data, isLoading, isError, error, isFetching } = useProviderModels(keyData.id)
  const updateProvider = useUpdateProvider()

  const selected = keyData.selected_model ?? ''
  const models = data?.models ?? []
  const defaultModel = data?.default_model
  const selectedMissing = !!selected && !!data && !models.some((m) => m.id === selected)

  const handleChange = async (value: string) => {
    try {
      await updateProvider.mutateAsync({ id: keyData.id, data: { selected_model: value } })
      toast({ title: 'Model saved', description: value || `Using provider default (${defaultModel ?? 'default'})` })
    } catch (err) {
      toast({
        title: 'Could not save model',
        description: err instanceof Error ? err.message : 'Please try again.',
        variant: 'destructive',
      })
    }
  }

  const handleRefresh = async () => {
    try {
      const fresh = await providersApi.models(keyData.id, true)
      qc.setQueryData(['providers', 'models', keyData.id], fresh)
    } catch (err) {
      toast({
        title: 'Could not refresh models',
        description: err instanceof Error ? err.message : 'Please try again.',
        variant: 'destructive',
      })
    }
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label htmlFor={`model-${keyData.id}`} className="text-xs font-medium text-ink">
          Model
        </label>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={isFetching}
          className="text-muted hover:text-ink disabled:opacity-50"
          aria-label="Refresh model list"
          title="Refresh model list"
        >
          {isFetching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCw className="h-3.5 w-3.5" />}
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-1.5 text-xs text-muted h-9">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Loading models…
        </div>
      ) : isError ? (
        <div className="text-xs text-error">
          {error instanceof Error ? error.message : 'Could not load models for this key.'}
        </div>
      ) : (
        <Select
          id={`model-${keyData.id}`}
          value={selected}
          disabled={updateProvider.isPending}
          onChange={(e) => handleChange(e.target.value)}
          className="text-xs font-mono"
        >
          <option value="">Provider default{defaultModel ? ` (${defaultModel})` : ''}</option>
          {selectedMissing && <option value={selected}>{selected} (unavailable)</option>}
          {models.map((m) => (
            <option key={m.id} value={m.id}>
              {m.id}
            </option>
          ))}
        </Select>
      )}

      {selectedMissing && (
        <div className="flex items-start gap-1.5 text-xs text-warning">
          <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>This model is no longer offered. Calls fall back to {defaultModel}. Pick another.</span>
        </div>
      )}
    </div>
  )
}
