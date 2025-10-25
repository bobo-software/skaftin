import React from 'react';

interface AppInputProps {
  value: string | Date;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  label: string;
  type?: 'text' | 'password' | 'email' | 'number' | 'date' | 'tel';
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  error?: string;
  className?: string;
  min?: number;
  max?: number;
  step?: number;
  pattern?: string;
  autoComplete?: string;
  name?: string;
}

const AppInputLabeled: React.FC<AppInputProps> = ({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  required = false,
  disabled = false,
  error,
  className = '',
  min,
  max,
  step,
  pattern,
  autoComplete
}) => {
  const inputId = label.toLowerCase().replace(/\s+/g, '-');

  // Format date value for input
  const formattedValue = type === 'date' && value instanceof Date
    ? value.toISOString().split('T')[0]
    : String(value);

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label
        htmlFor={inputId}
        className="text-sm font-medium text-slate-700"
      >
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>

      <input
        id={inputId}
        className={`
          w-full px-3 py-2
          bg-white border rounded-lg
          text-slate-700 text-sm
          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
          disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed
          ${error ? 'border-red-500' : 'border-slate-200'}
          ${disabled ? 'cursor-not-allowed' : ''}
        `}
        type={type}
        value={formattedValue}
        onChange={onChange}
        placeholder={placeholder || label}
        required={required}
        disabled={disabled}
        min={min}
        max={max}
        step={step}
        pattern={pattern}
        autoComplete={autoComplete}
        aria-invalid={error ? 'true' : 'false'}
        aria-describedby={error ? `${inputId}-error` : undefined}
      />

      {error && (
        <p
          id={`${inputId}-error`}
          className="text-sm text-red-500 mt-1"
        >
          {error}
        </p>
      )}
    </div>
  );
};

export default AppInputLabeled;
