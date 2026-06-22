import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { toast } from '@/lib/toast'
import FormField from '@/components/forms/FormField'

const registerSchema = z.object({
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(64)
    .regex(/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, hyphens, and underscores'),
  email: z.string().email('Enter a valid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Must contain at least one number'),
  confirm_password: z.string(),
}).refine(
  (data) => data.password === data.confirm_password,
  { message: "Passwords don't match", path: ['confirm_password'] },
)

type RegisterForm = z.infer<typeof registerSchema>

type Strength = 'weak' | 'fair' | 'strong'

function getStrength(password: string): Strength {
  if (password.length < 6) return 'weak'
  if (password.length < 10) return 'fair'
  const hasUpper = /[A-Z]/.test(password)
  const hasNumber = /[0-9]/.test(password)
  const hasSpecial = /[^A-Za-z0-9]/.test(password)
  const score = [hasUpper, hasNumber, hasSpecial].filter(Boolean).length
  if (score === 3) return 'strong'
  if (score >= 2 && password.length >= 10) return 'fair'
  return 'fair'
}

const strengthConfig: Record<Strength, { label: string; segments: 1 | 2 | 3; color: string }> = {
  weak: { label: 'Weak', segments: 1, color: 'bg-error' },
  fair: { label: 'Fair', segments: 2, color: 'bg-warning' },
  strong: { label: 'Strong', segments: 3, color: 'bg-success' },
}

export default function RegisterPage() {
  const navigate = useNavigate()
  const { register: registerUser } = useAuth()
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
  })

  const passwordValue = watch('password') || ''
  const strength = getStrength(passwordValue)
  const config = strengthConfig[strength]

  const onSubmit = async (data: RegisterForm) => {
    try {
      await registerUser({
        email: data.email,
        password: data.password,
        username: data.username,
      })
      toast({ title: 'Account created', description: 'Welcome to Dataset Factory.' })
      navigate('/dashboard', { replace: true })
    } catch (err) {
      toast({
        title: 'Registration failed',
        description: err instanceof Error ? err.message : 'Please try again.',
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
            Dataset Factory
          </p>
          <h1 className="text-3xl font-semibold text-white tracking-tight mt-2">
            Join thousands of teams
          </h1>
          <p className="text-base text-white/70 mt-3 max-w-xs leading-relaxed">
            Building smarter datasets for their RAG pipelines.
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
            Create an account
          </h2>
          <p className="text-sm text-body-muted mt-1 mb-8">
            Get started with Quick Dataset.
          </p>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <FormField label="Username" error={errors.username?.message} required>
              <input
                type="text"
                placeholder="janesmith"
                {...register('username')}
                className="w-full border border-hairline rounded-md px-4 py-2.5 text-sm text-ink placeholder:text-muted
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action focus-visible:border-action
                  transition-colors"
              />
            </FormField>

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

            <FormField
              label="Password"
              error={errors.password?.message}
              required
              hint={passwordValue ? undefined : 'At least 8 characters, one uppercase letter, one number'}
            >
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Create a password"
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
              {passwordValue && (
                <div className="mt-2 space-y-1">
                  <div className="flex gap-1">
                    {[1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className={`h-1 flex-1 rounded-full transition-colors ${
                          i <= config.segments ? config.color : 'bg-hairline'
                        }`}
                      />
                    ))}
                  </div>
                  <p className={`text-xs ${config.color.replace('bg-', 'text-')}`}>
                    {config.label}
                  </p>
                </div>
              )}
            </FormField>

            <FormField label="Confirm password" error={errors.confirm_password?.message} required>
              <div className="relative">
                <input
                  type={showConfirm ? 'text' : 'password'}
                  placeholder="Re-enter your password"
                  {...register('confirm_password')}
                  className="w-full border border-hairline rounded-md px-4 py-2.5 pr-10 text-sm text-ink placeholder:text-muted
                    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action focus-visible:border-action
                    transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-ink transition-colors"
                  aria-label={showConfirm ? 'Hide password' : 'Show password'}
                  tabIndex={-1}
                >
                  {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
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
              {isSubmitting ? 'Creating account\u2026' : 'Create account'}
            </button>
          </form>

          <p className="text-center text-sm text-body-muted mt-8">
            Already have an account?{' '}
            <Link to="/login" className="text-action hover:underline font-medium">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
