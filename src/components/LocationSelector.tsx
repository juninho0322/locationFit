import type { Location } from '../types';

interface LocationSelectorProps {
  locations: Location[];
  selectedLocationId: string;
  onSelectLocation: (locationId: string) => void;
  onDeleteLocation: (locationId: string) => void;
}

export function LocationSelector({
  locations,
  selectedLocationId,
  onSelectLocation,
  onDeleteLocation,
}: LocationSelectorProps) {
  if (locations.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-slate-700 px-3 py-4 text-sm text-slate-400">
        No saved locations yet.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <label className="text-xs font-semibold text-slate-300" htmlFor="saved-location">
        Saved locations
      </label>
      <div className="flex gap-2">
        <select
          id="saved-location"
          className="min-w-0 flex-1 rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-cyan-400"
          value={selectedLocationId}
          onChange={(event) => onSelectLocation(event.target.value)}
        >
          {locations.map((location) => (
            <option key={location.id} value={location.id}>
              {location.name} - {location.width} x {location.depth} x {location.height} cm
            </option>
          ))}
        </select>
        <button
          className="rounded-md border border-red-500/40 px-3 py-2 text-sm font-semibold text-red-200 transition hover:bg-red-500/10"
          type="button"
          onClick={() => onDeleteLocation(selectedLocationId)}
        >
          Delete
        </button>
      </div>
    </div>
  );
}
