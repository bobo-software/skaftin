import React, { useState, useEffect, useRef } from 'react';
import { LuX } from 'react-icons/lu';

interface AppAutocompleteProps {
  label: string;
  options: any[];
  onSelect: (item: any) => void;
  onClear?: () => void;
  value?: string;
  displayValue?: string;
  accessor?: string;
  valueAccessor?: string;
  required?: boolean;
  disabled?: boolean;
  error?: string;
  className?: string;
  placeholder?: string;
  onChange?: (displayValue: string) => void;
}

const AppLabledAutocomplete: React.FC<AppAutocompleteProps> = ({
  label,
  options,
  onSelect,
  onClear,
  value = '',
  displayValue = '',
  accessor = 'name',
  valueAccessor = 'id',
  required = false,
  disabled = false,
  error,
  className = '',
  placeholder,
  onChange
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [filteredOptions, setFilteredOptions] = useState(options);
  const [selectedOption, setSelectedOption] = useState<any>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputId = label.toLowerCase().replace(/\s+/g, '-');

  // Update searchText when displayValue changes
  useEffect(() => {
    if (displayValue) {
      setSearchText(displayValue);
    } else {
      setSearchText('');
    }
  }, [displayValue]);

  // Update selectedOption when value changes
  useEffect(() => {
    if (value) {
      const option = options.find(opt => opt[valueAccessor] === value);
      setSelectedOption(option || null);
    } else {
      setSelectedOption(null);
    }
  }, [value, options, valueAccessor]);

  // Filter options based on search text
  useEffect(() => {
    if (!searchText) {
      setFilteredOptions(options);
      return;
    }

    const filtered = options.filter(option => {
      const optionValue = option[accessor];
      return optionValue && optionValue.toString().toLowerCase().includes(searchText.toLowerCase());
    });
    setFilteredOptions(filtered);
  }, [searchText, options, accessor]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleOptionSelect = (item: any) => {
    setSelectedOption(item);
    setSearchText(item[accessor]);
    setIsOpen(false);
    onSelect(item);
    onChange?.(item[accessor]);
  };

  const handleClear = () => {
    setSearchText('');
    setSelectedOption(null);
    setIsOpen(false);
    onClear && onClear();
    onChange?.('');
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setSearchText(newValue);
    onChange?.(newValue);
    setIsOpen(true);
  };

  return (
    <div className={`flex flex-col gap-1.5 ${className}`} ref={wrapperRef}>
      <label
        htmlFor={inputId}
        className="text-sm font-medium text-slate-700"
      >
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>

      <div className="relative">
        <div className={`
          flex items-center
          w-full px-3 py-2
          bg-white border rounded-lg
          text-slate-700 text-sm
          focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500
          disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed
          ${error ? 'border-red-500' : 'border-slate-200'}
          ${disabled ? 'cursor-not-allowed' : ''}
        `}>
          <input
            id={inputId}
            type="text"
            value={searchText}
            onChange={handleInputChange}
            onFocus={() => setIsOpen(true)}
            placeholder={placeholder || label}
            disabled={disabled}
            autoComplete="off"
            className="w-full outline-none bg-transparent"
            aria-invalid={error ? 'true' : 'false'}
            aria-describedby={error ? `${inputId}-error` : undefined}
          />
          {searchText && (
            <button
              onClick={handleClear}
              className="p-1 text-slate-400 hover:text-slate-600 transition-colors"
              type="button"
            >
              <LuX size={16} />
            </button>
          )}
        </div>

        {isOpen && filteredOptions.length > 0 && (
          <div className="absolute z-[500] w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-auto">
            {filteredOptions.map((item, index) => (
              <button
                key={index}
                onClick={() => handleOptionSelect(item)}
                className="w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 focus:bg-slate-50 focus:outline-none"
                type="button"
              >
                {item[accessor]}
              </button>
            ))}
          </div>
        )}
      </div>

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

export default AppLabledAutocomplete; 