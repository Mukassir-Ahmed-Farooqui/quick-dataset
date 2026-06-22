import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { toast } from '@/lib/toast'
import FormField from '@/components/forms/FormField'

const loginSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
})

type LoginForm = z.infer<typeof loginSchema>

export default function LoginPage() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [showPassword, setShowPassword] = useState(false)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  })

  const onSubmit = async (data: LoginForm) => {
    try {
      await login(data)
      toast({ title: 'Welcome back', description: "You're now signed in." })
      navigate('/dashboard', { replace: true })
    } catch (err) {
      toast({
        title: 'Sign in failed',
        description: err instanceof Error ? err.message : 'Invalid email or password',
        variant: 'destructive',
      })
    }
  }

  return (
    <div className="flex min-h-screen">
      {/* Left panel — hidden on mobile */}
      <div className="hidden lg:flex lg:w-1/2 bg-deep-green flex-col items-center justify-center px-12">
        <div className="max-w-sm w-full">
          <p className="font-mono text-xs tracking-widest uppercase text-white/60">
            Quick Dataset
          </p>
          <h1 className="text-3xl font-semibold text-white tracking-tight mt-2">
            Build smarter datasets
          </h1>
          <p className="text-base text-white/70 mt-3 max-w-xs leading-relaxed">
            Create, manage, and export high-quality datasets for your RAG pipelines.
          </p>
          <div className="border border-white/10 rounded-xl p-6 mt-12 space-y-3">
            <div className="h-3 w-3/4 rounded bg-white/10" />
            <div className="h-3 w-1/2 rounded bg-white/10" />
            <div className="h-20 rounded bg-white/5 mt-4" />
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 bg-canvas flex items-center justify-center px-6 py-10 lg:px-12 lg:py-16">
        <div className="w-full max-w-sm">
          <h2 className="text-2xl font-semibold tracking-tight text-ink">
            Sign in
          </h2>
          <p className="text-sm text-body-muted mt-1 mb-8">
            Welcome back to Dataset Factory.
          </p>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <FormField label="Email" error={errors.email?.message} required>
              <input
                type="email"
                placeholder="you@example.com"
                {...register('email')}
                className="w-full border border-hairline rounded-md px-4 py-2.5 text-sm text-ink placeholder:text-muted
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action focus-visible:border-action
                  transition-colors"
              />
            </FormField>

            <FormField label="Password" error={errors.password?.message} required>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  {...register('password')}
                  className="w-full border border-hairline rounded-md px-4 py-2.5 pr-10 text-sm text-ink placeholder:text-muted
                    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action focus-visible:border-action
                    transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-ink transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </FormField>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-ink text-white rounded-pill px-6 py-2.5 text-sm font-medium
                hover:bg-ink/90 transition-colors
                focus-visible:ring-2 focus-visible:ring-action focus-visible:ring-offset-2
                disabled:opacity-60 disabled:cursor-not-allowed
                flex items-center justify-center gap-2"
            >
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {isSubmitting ? 'Signing in\u2026' : 'Sign in'}
            </button>
          </form>

          <p className="text-center text-sm text-body-muted mt-8">
            Don't have an account?{' '}
            <Link to="/register" className="text-action hover:underline font-medium">
              Register
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
