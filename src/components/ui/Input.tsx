'use client'
import { cn } from '@/lib/utils'
import { forwardRef, type InputHTMLAttributes } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, className, ...props }, ref) => (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      )}
      <input
        ref={ref}
        className={cn(
          'w-full px-3 py-2 text-sm border rounded-lg outline-none transition-colors',
          'placeholder:text-gray-400',
          error
            ? 'border-red-400 focus:ring-1 focus:ring-red-400'
            : 'border-gray-300 focus:border-primary focus:ring-1 focus:ring-primary',
          className
        )}
        {...props}
      />
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
      {hint && !error && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
    </div>
  )
)
Input.displayName = 'Input'

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  options: { value: string; label: string }[]
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, options, className, ...props }, ref) => (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      )}
      <select
        ref={ref}
        className={cn(
          'w-full px-3 py-2 text-sm border rounded-lg outline-none transition-colors bg-white',
          error
            ? 'border-red-400 focus:ring-1 focus:ring-red-400'
            : 'border-gray-300 focus:border-primary focus:ring-1 focus:ring-primary',
          className
        )}
        {...props}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  )
)
Select.displayName = 'Select'
