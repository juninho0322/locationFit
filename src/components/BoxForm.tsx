import { useEffect, useState } from 'react';
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

export function BoxForm({ box, disabled = false, onChange }: BoxFormProps) {
  const [values, setValues] = useState<Record<keyof BoxDimensions, string>>({
    width: String(box.width),
    depth: String(box.depth),
    height: String(box.height),
    quantity: String(box.quantity),
  });

  useEffect(() => {
    setValues({
      width: String(box.width),
      depth: String(box.depth),
      height: String(box.height),
      quantity: String(box.quantity),
    });
  }, [box]);

  const updateBox = (key: keyof BoxDimensions, value: string) => {
    if (!/^\d*$/.test(value)) {
      return;
    }

    setValues((current) => ({
      ...current,
      [key]: value,
    }));

    if (value !== '') {
      onChange({
        ...box,
        [key]: Math.max(1, Number(value) || 1),
      });
    }
  };

  const normalizeBox = (key: keyof BoxDimensions) => {
    const value = Math.max(1, Number(values[key]) || 1);
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
            inputMode="numeric"
            pattern="[0-9]*"
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
