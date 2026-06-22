import AppRouter from '@/routes/AppRouter'
import { Toaster } from '@/components/ui/sonner'

export default function App() {
  return (
    <>
      <AppRouter />
      <Toaster />
    </>
  )
}
