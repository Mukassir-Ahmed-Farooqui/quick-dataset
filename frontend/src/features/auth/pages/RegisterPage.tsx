import { Link, useNavigate } from 'react-router-dom'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ArrowRight } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { toast, toastError } from '@/lib/toast'
import FormField from '@/components/common/FormField'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import AuthLayout from '../components/AuthLayout'
import PasswordInput from '../components/PasswordInput'

const registerSchema = z
  .object({
    username: z
      .string()
      .min(3, 'Username must be at least 3 characters')
      .max(64)
      .regex(/^[a-zA-Z0-9_-]+$/, 'Letters, numbers, hyphens and underscores only'),
    email: z.string().email('Enter a valid email address'),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
      .regex(/[0-9]/, 'Must contain at least one number'),
    confirm_password: z.string(),
  })
  .refine((d) => d.password === d.confirm_password, { message: "Passwords don't match", path: ['confirm_password'] })

type RegisterForm = z.infer<typeof registerSchema>
type Strength = 'weak' | 'fair' | 'strong'

function getStrength(pw: string): Strength {
  if (pw.length < 8) return 'weak'
  const score = [/[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((r) => r.test(pw)).length
  if (score === 3 && pw.length >= 10) return 'strong'
  return score >= 2 ? 'fair' : 'weak'
}

const strengthUi: Record<Strength, { label: string; segments: number; bar: string; text: string }> = {
  weak: { label: 'Weak', segments: 1, bar: 'bg-danger', text: 'text-danger' },
  fair: { label: 'Fair', segments: 2, bar: 'bg-warning', text: 'text-warning' },
  strong: { label: 'Strong', segments: 3, bar: 'bg-success', text: 'text-success' },
}

function StrengthMeter({ password }: { password: string }) {
  const s = strengthUi[getStrength(password)]
  return (
    <div className="flex items-center gap-3 pt-1" aria-live="polite">
      <div className="flex flex-1 gap-1">
        {[1, 2, 3].map((i) => (
          <span key={i} className={cn('h-0.5 flex-1 transition-colors', i <= s.segments ? s.bar : 'bg-line')} />
        ))}
      </div>
      <span className={cn('eyebrow text-[10px]', s.text)}>{s.label}</span>
    </div>
  )
}

export default function RegisterPage() {
  const navigate = useNavigate()
  const { register: registerUser } = useAuth()
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<RegisterForm>({ resolver: zodResolver(registerSchema) })
  const password = useWatch({ control, name: 'password' }) ?? ''

  const onSubmit = async (data: RegisterForm) => {
    try {
      await registerUser({ email: data.email, password: data.password, username: data.username })
      toast({ title: 'Account created', description: 'Welcome to Quick Dataset.' })
      navigate('/dashboard', { replace: true })
    } catch (err) {
      toastError('Registration failed', err)
    }
  }

  return (
    <AuthLayout
      eyebrow="Create account"
      title="Start building datasets"
      description="Free, local, and yours. Takes under a minute."
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-fg underline-offset-4 hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
        <FormField label="Username" htmlFor="username" error={errors.username?.message} required>
          <Input id="username" autoComplete="username" autoFocus placeholder="janesmith" aria-invalid={!!errors.username} {...register('username')} />
        </FormField>
        <FormField label="Email" htmlFor="email" error={errors.email?.message} required>
          <Input id="email" type="email" autoComplete="email" placeholder="you@example.com" aria-invalid={!!errors.email} {...register('email')} />
        </FormField>
        <FormField
          label="Password"
          htmlFor="password"
          error={errors.password?.message}
          required
          hint={password ? undefined : 'At least 8 characters, one uppercase letter, one number.'}
        >
          <PasswordInput id="password" autoComplete="new-password" placeholder="Create a password" aria-invalid={!!errors.password} {...register('password')} />
          {password && <StrengthMeter password={password} />}
        </FormField>
        <FormField label="Confirm password" htmlFor="confirm_password" error={errors.confirm_password?.message} required>
          <PasswordInput
            id="confirm_password"
            autoComplete="new-password"
            placeholder="Re-enter your password"
            aria-invalid={!!errors.confirm_password}
            {...register('confirm_password')}
          />
        </FormField>
        <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>
          {isSubmitting ? 'Creating account…' : 'Create account'}
          {!isSubmitting && <ArrowRight />}
        </Button>
      </form>
    </AuthLayout>
  )
}
