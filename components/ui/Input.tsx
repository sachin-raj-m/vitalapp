import React from 'react';
import { cn } from '@/lib/cn';

const fieldBase =
  'w-full rounded-md border bg-white px-3 text-[15px] text-gray-900 placeholder:text-gray-400 transition-colors ' +
  'focus:outline-none focus:ring-0 disabled:bg-gray-100 disabled:text-gray-500';

const fieldState = (error?: string) =>
  error
    ? 'border-red-500 focus:border-red-600'
    : 'border-gray-300 hover:border-gray-400 focus:border-gray-900';

interface FieldShellProps {
  id: string;
  label?: string;
  error?: string;
  helperText?: string;
  children: React.ReactNode;
}

const FieldShell = ({ id, label, error, helperText, children }: FieldShellProps) => (
  <div className="space-y-1.5">
    {label && (
      <label htmlFor={id} className="block text-[13px] font-medium text-gray-800">
        {label}
      </label>
    )}
    {children}
    {error && <p id={`${id}-error`} className="text-[13px] text-red-700">{error}</p>}
    {helperText && !error && <p className="text-[13px] text-gray-500">{helperText}</p>}
  </div>
);

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Input: React.FC<InputProps> = ({ label, error, helperText, className, ...props }) => {
  const generatedId = React.useId();
  const id = props.id || props.name || generatedId;

  return (
    <FieldShell id={id} label={label} error={error} helperText={helperText}>
      <input
        id={id}
        aria-invalid={!!error || undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={cn(fieldBase, 'h-10', fieldState(error), className)}
        {...props}
      />
    </FieldShell>
  );
};

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  helperText?: string;
  options: { value: string | number; label: string }[];
}

export const Select: React.FC<SelectProps> = ({ label, error, helperText, options, className, ...props }) => {
  const generatedId = React.useId();
  const id = props.id || props.name || generatedId;

  return (
    <FieldShell id={id} label={label} error={error} helperText={helperText}>
      <div className="relative">
        <select
          id={id}
          aria-invalid={!!error || undefined}
          className={cn(fieldBase, 'h-10 appearance-none pr-9', fieldState(error), className)}
          {...props}
        >
          {options.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <svg
          aria-hidden
          viewBox="0 0 16 16"
          className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-500"
        >
          <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </FieldShell>
  );
};

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Textarea: React.FC<TextareaProps> = ({ label, error, helperText, className, ...props }) => {
  const generatedId = React.useId();
  const id = props.id || props.name || generatedId;

  return (
    <FieldShell id={id} label={label} error={error} helperText={helperText}>
      <textarea
        id={id}
        aria-invalid={!!error || undefined}
        className={cn(fieldBase, 'min-h-[96px] py-2.5 leading-relaxed', fieldState(error), className)}
        {...props}
      />
    </FieldShell>
  );
};
