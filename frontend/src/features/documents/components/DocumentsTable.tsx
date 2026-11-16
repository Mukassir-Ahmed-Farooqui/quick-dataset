import { FileText, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tooltip } from '@/components/ui/tooltip'
import { formatBytes, timeAgo } from '@/lib/format'
import type { DocumentOut } from '@/types/api'
import DocumentStatusBadge from './DocumentStatusBadge'

interface DocumentsTableProps {
  docs: DocumentOut[]
  selected: Set<string>
  onToggle: (id: string) => void
  onToggleAll: () => void
  onDelete: (doc: DocumentOut) => void
}

export default function DocumentsTable({ docs, selected, onToggle, onToggleAll, onDelete }: DocumentsTableProps) {
  const all = docs.length > 0 && docs.every((d) => selected.has(d.id))
  const some = !all && docs.some((d) => selected.has(d.id))

  return (
    <div className="border border-line">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-10 pr-0">
              <Checkbox checked={all} indeterminate={some} onChange={onToggleAll} aria-label="Select all documents" />
            </TableHead>
            <TableHead>File</TableHead>
            <TableHead className="hidden sm:table-cell">Type</TableHead>
            <TableHead className="hidden sm:table-cell">Size</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="hidden md:table-cell">Uploaded</TableHead>
            <TableHead className="w-10">
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {docs.map((d) => (
            <TableRow key={d.id} data-state={selected.has(d.id) ? 'selected' : undefined} className="group">
              <TableCell className="w-10 pr-0">
                <Checkbox checked={selected.has(d.id)} onChange={() => onToggle(d.id)} aria-label={`Select ${d.filename}`} />
              </TableCell>
              <TableCell className="max-w-0 w-full">
                <div className="flex items-center gap-2.5">
                  <FileText className="size-4 shrink-0 text-fg-muted" strokeWidth={1.5} />
                  <div className="min-w-0">
                    <p className="truncate font-medium" title={d.filename}>
                      {d.filename}
                    </p>
                    {d.processing_status === 'failed' && d.parse_error && (
                      <p className="truncate font-mono text-[11px] text-danger" title={d.parse_error}>
                        {d.parse_error}
                      </p>
                    )}
                  </div>
                </div>
              </TableCell>
              <TableCell className="hidden font-mono text-xs uppercase text-fg-muted sm:table-cell">{d.file_type}</TableCell>
              <TableCell className="hidden whitespace-nowrap font-mono text-xs text-fg-muted sm:table-cell">{formatBytes(d.file_size)}</TableCell>
              <TableCell>
                <DocumentStatusBadge status={d.processing_status} />
              </TableCell>
              <TableCell className="hidden whitespace-nowrap text-xs text-fg-muted md:table-cell">{timeAgo(d.created_at)}</TableCell>
              <TableCell className="w-10">
                <Tooltip content="Delete">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => onDelete(d)}
                    aria-label={`Delete ${d.filename}`}
                    className="text-fg-muted hover:text-danger sm:opacity-0 sm:focus-visible:opacity-100 sm:group-hover:opacity-100"
                  >
                    <Trash2 />
                  </Button>
                </Tooltip>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
