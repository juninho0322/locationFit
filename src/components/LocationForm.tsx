import { FormEvent, useState } from 'react';
import type { Location } from '../types';

interface LocationFormProps {
  onAddLocation: (location: Location) => void;
}

const numberFields = [
  { key: 'width', label: 'Width (cm)' },
  { key: 'depth', label: 'Depth (cm)' },
  { key: 'height', label: 'Height (cm)' },
] as const;

export function LocationForm({ onAddLocation }: LocationFormProps) {
  const [name, setName] = useState('');
  const [dimensions, setDimensions] = useState({
    width: '120',
    depth: '80',
    height: '90',
  });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const width = Math.max(1, Number(dimensions.width) || 1);
    const depth = Math.max(1, Number(dimensions.depth) || 1);
    const height = Math.max(1, Number(dimensions.height) || 1);

    const locationName = name.trim() || `Location ${new Date().toLocaleTimeString()}`;
    onAddLocation({
      id: crypto.randomUUID(),
      name: locationName,
      width,
      depth,
      height,
    });
    setName('');
    setDimensions({
      width: String(width),
      depth: String(depth),
      height: String(height),
    });
  };

  const updateDimension = (key: keyof typeof dimensions, value: string) => {
    if (!/^\d*$/.test(value)) {
      return;
    }

    setDimensions((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const normalizeDimension = (key: keyof typeof dimensions) => {
    setDimensions((current) => ({
      ...current,
      [key]: String(Math.max(1, Number(current[key]) || 1)),
    }));
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div>
        <label className="text-xs font-semibold text-slate-300" htmlFor="location-name">
          Location name
        </label>
        <input
          id="location-name"
          className="mt-2 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-cyan-400"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Aisle A / Bay 03"
        />
      </div>

      <div className="grid grid-cols-3 gap-3">
        {numberFields.map((field) => (
          <div key={field.key}>
            <label className="text-xs font-semibold text-slate-300" htmlFor={`location-${field.key}`}>
              {field.label}
            </label>
            <input
              id={`location-${field.key}`}
              className="mt-2 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-cyan-400"
              inputMode="numeric"
              pattern="[0-9]*"
              type="text"
              value={dimensions[field.key]}
              onChange={(event) =>
                updateDimension(field.key, event.target.value)
              }
              onBlur={() => normalizeDimension(field.key)}
            />
          </div>
        ))}
      </div>

      <button
        className="w-full rounded-md bg-cyan-400 px-4 py-2 text-sm font-bold text-slate-950 transition hover:bg-cyan-300"
        type="submit"
      >
        Add location
      </button>
    </form>
  );
}
