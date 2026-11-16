export interface QuestionFilters {
  search: string
  status: '' | 'answered' | 'unanswered'
  documentId: string
  gaPairId: string
}

export const EMPTY_FILTERS: QuestionFilters = { search: '', status: '', documentId: '', gaPairId: '' }
