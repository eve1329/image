import React from 'react'

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'onChange'> {
  checked: boolean
  onChange: (checked: boolean) => void
  label?: React.ReactNode
  tone?: 'primary' | 'danger'
}

export function Checkbox({ checked, onChange, label, tone = 'primary', className, ...props }: CheckboxProps) {
  const toneClasses = tone === 'danger'
    ? 'border-red-400/40 checked:bg-red-500 checked:border-red-500 focus:ring-red-500/20'
    : 'border-white/15 checked:bg-cyan-500 checked:border-cyan-500 focus:ring-cyan-400/25'

  return (
    <label className={`flex items-center gap-2 cursor-pointer group ${className || ''}`}>
      <div className="relative flex items-center justify-center">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className={`peer appearance-none w-4 h-4 rounded-[4px] border bg-[hsl(var(--workbench-control))] focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-offset-[hsl(var(--workbench-board))] transition-all cursor-pointer ${toneClasses}`}
          {...props}
        />
        <svg className="absolute w-2.5 h-2.5 pointer-events-none opacity-0 peer-checked:opacity-100 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>
      {label && <span className="text-[13px] font-medium text-[hsl(var(--workbench-ink)/0.82)] group-hover:text-white transition-colors">{label}</span>}
    </label>
  )
}
