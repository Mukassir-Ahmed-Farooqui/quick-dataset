import { useState } from 'react'
import FormField from '@/components/common/FormField'
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select } from '@/components/ui/input'
import { useCreateGAPair } from '@/hooks/useGAPairs'
import { sonnerToast, toastError } from '@/lib/toast'
import type { DocumentOut } from '@/types/api'
import GAPairEditor, { toUpdate } from './GAPairEditor'

const EMPTY = { genre_title: '', genre_description: '', audience_title: '', audience_description: '' }

export default function AddPairDialog({ projectId, docs, open, onOpenChange }: { projectId: string; docs: DocumentOut[]; open: boolean; onOpenChange: (o: boolean) => void }) {
  const create = useCreateGAPair(projectId)
  const [docId, setDocId] = useState('')
  const documentId = docId || docs[0]?.id || ''

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a GA pair</DialogTitle>
          <DialogDescription>Write your own genre × audience lens for one document.</DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <FormField label="Document" htmlFor="ga-add-doc">
            <Select id="ga-add-doc" value={documentId} onChange={(e) => setDocId(e.target.value)}>
              {docs.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.filename}
                </option>
              ))}
            </Select>
          </FormField>
          <GAPairEditor
            idPrefix="ga-add"
            initial={EMPTY}
            submitLabel="Add pair"
            saving={create.isPending}
            onCancel={() => onOpenChange(false)}
            onSave={(v) => {
              const u = toUpdate(v)
              create.mutate(
                { document_id: documentId, genre_title: u.genre_title!, audience_title: u.audience_title!, genre_description: u.genre_description, audience_description: u.audience_description },
                {
                  onSuccess: () => {
                    sonnerToast.success('Pair added')
                    onOpenChange(false)
                  },
                  onError: (err) => toastError('Could not add pair', err),
                },
              )
            }}
          />
        </DialogBody>
      </DialogContent>
    </Dialog>
  )
}
