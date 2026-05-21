import { useState } from 'react';
import type { BoxDimensions } from '../types';

interface BoxFormProps {
  box: BoxDimensions;
  disabled?: boolean;
  onChange: (box: BoxDimensions) => void;
}

const fields = [
  { key: 'width', label: 'Box width (cm)' },
  { key: 'depth', label: 'Box depth (cm)' },
  { key: 'height', label: 'Box height (cm)' },
  { key: 'quantity', label: 'Units per box' },
] as const;

const decimalKeys = new Set<keyof BoxDimensions>(['width', 'depth', 'height']);
const decimalPattern = /^\d*\.?\d*$/;
const integerPattern = /^\d*$/;
const parseDimension = (value: string) => Number.parseFloat(value);
const isIncompleteDecimal = (value: string) =>
  value === '' || value === '.' || value.endsWith('.');

export function BoxForm({ box, disabled = false, onChange }: BoxFormProps) {
  const [values, setValues] = useState<Record<keyof BoxDimensions, string>>({
    width: String(box.width),
    depth: String(box.depth),
    height: String(box.height),
    quantity: String(box.quantity),
  });

  const updateBox = (key: keyof BoxDimensions, value: string) => {
    const pattern = decimalKeys.has(key) ? decimalPattern : integerPattern;
    if (!pattern.test(value)) {
      return;
    }

    setValues((current) => ({
      ...current,
      [key]: value,
    }));

    if (decimalKeys.has(key) && isIncompleteDecimal(value)) {
      return;
    }

    if (value !== '') {
      const parsedValue = decimalKeys.has(key)
        ? parseDimension(value)
        : Number.parseInt(value, 10);

      onChange({
        ...box,
        [key]: Math.max(decimalKeys.has(key) ? 0.01 : 1, parsedValue || 1),
      });
    }
  };

  const normalizeBox = (key: keyof BoxDimensions) => {
    const parsedValue = decimalKeys.has(key)
      ? parseDimension(values[key])
      : Number.parseInt(values[key], 10);
    const value = Math.max(decimalKeys.has(key) ? 0.01 : 1, parsedValue || 1);
    setValues((current) => ({
      ...current,
      [key]: String(value),
    }));
    onChange({
      ...box,
      [key]: value,
    });
  };

  return (
    <div className="grid grid-cols-2 gap-3">
      {fields.map((field) => (
        <div key={field.key}>
          <label className="text-xs font-semibold text-slate-300" htmlFor={`box-${field.key}`}>
            {field.label}
          </label>
          <input
            id={`box-${field.key}`}
            className="mt-2 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-cyan-400 disabled:cursor-not-allowed disabled:border-slate-800 disabled:bg-slate-900 disabled:text-slate-500"
            disabled={disabled}
            inputMode={decimalKeys.has(field.key) ? 'decimal' : 'numeric'}
            pattern={decimalKeys.has(field.key) ? '[0-9]*[.]?[0-9]*' : '[0-9]*'}
            type="text"
            value={values[field.key]}
            onChange={(event) => updateBox(field.key, event.target.value)}
            onBlur={() => normalizeBox(field.key)}
          />
        </div>
      ))}
    </div>
  );
}
