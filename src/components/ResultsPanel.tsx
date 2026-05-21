import type { FitResult } from '../types';
import { formatOrientationDimensions } from '../utils/fitCalculator';

interface ResultsPanelProps {
  result: FitResult | null;
}

const ResultRow = ({ label, value }: { label: string; value: string | number }) => (
  <div className="flex items-center justify-between gap-4 border-b border-slate-800 py-2 text-sm">
    <span className="text-slate-400">{label}</span>
    <span className="text-right font-semibold text-slate-100">{value}</span>
  </div>
);

export function ResultsPanel({ result }: ResultsPanelProps) {
  if (!result) {
    return (
      <p className="rounded-md border border-dashed border-slate-700 px-3 py-4 text-sm text-slate-400">
        Add or select a location to calculate capacity.
      </p>
    );
  }

  return (
    <div>
      <div
        className={`rounded-md border px-3 py-3 text-sm font-semibold ${
          result.fits
            ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-200'
            : 'border-red-400/40 bg-red-400/10 text-red-200'
        }`}
      >
        {result.message}
      </div>

      <div className="mt-4">
        <ResultRow
          label="Best orientation used"
          value={result.orientation ? formatOrientationDimensions(result.orientation) : 'None'}
        />
        <ResultRow label="Boxes across width" value={result.boxesAcrossWidth} />
        <ResultRow label="Boxes across depth" value={result.boxesAcrossDepth} />
        <ResultRow label="Boxes across height" value={result.boxesAcrossHeight} />
        <ResultRow label="Total location capacity" value={result.totalCapacity} />
        <ResultRow label="Location volume" value={`${result.locationVolume} cm3`} />
        <ResultRow
          label="Loaded box volume"
          value={`${result.usedWidth} W x ${result.usedDepth} D x ${result.usedHeight} H cm`}
        />
        <ResultRow label="Volume used" value={`${result.usedVolume} cm3 (${result.volumeUtilization}%)`} />
        <ResultRow label="Boxes plotted in shelf" value={result.boxesThatFit} />
        <ResultRow label="Units per box" value={result.requestedQuantity} />
        <ResultRow label="Total units stored" value={result.totalUnits} />
      </div>
    </div>
  );
}
