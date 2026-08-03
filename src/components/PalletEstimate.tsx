import { AlertTriangle, ChevronLeft, ChevronRight, LoaderCircle, Trash2 } from 'lucide-react';
import { jsPDF } from 'jspdf';
import { useEffect, useMemo, useState } from 'react';
import type { Location } from '../types';
import {
  calculatePalletEstimate,
  createLocationPalletType,
  type PackingMode,
  type PalletEstimateResult,
  type VolumeUnit,
} from '../utils/palletEstimator';
import type { SheetData } from '../utils/sheetData';
import { PalletEstimateViewer } from './PalletEstimateViewer';

interface PalletEstimateProps {
  locations: Location[];
  orderLines: SheetData;
  packConfig: SheetData;
  selectedLocation: Location | null;
}

const formatNumber = (value: number) =>
  Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, '');

const packConfigVolumeUnit: VolumeUnit = 'm3';
const packingModeOptions: Array<{ description: string; id: PackingMode; label: string }> = [
  {
    description: 'Groups same-size boxes first, then similar volumes, then smaller gap fillers.',
    id: 'box-size',
    label: 'By Box Size',
  },
  {
    description: 'Builds vertical columns from same-size boxes and fits those columns on the pallet base.',
    id: 'column-stack',
    label: 'Column Stack',
  },
  {
    description: 'Places individual boxes into the best available positions using rotations and support checks.',
    id: 'free-placement',
    label: 'Free Placement',
  },
];

const convertFromCubicCentimeters = (value: number, unit: VolumeUnit) => {
  if (unit === 'm3') {
    return value / 1_000_000;
  }

  if (unit === 'litres') {
    return value / 1000;
  }

  return value;
};

const formatVolume = (value: number, unit: VolumeUnit) =>
  `${formatNumber(convertFromCubicCentimeters(value, unit))} ${
    unit === 'm3' ? 'm3' : unit === 'litres' ? 'L' : 'cm3'
  }`;

function MetricCard({
  helper,
  label,
  value,
}: {
  helper?: string;
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-4">
      <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
      {helper && <p className="mt-2 text-xs text-slate-500">{helper}</p>}
    </div>
  );
}

function WarningList({
  items,
  title,
}: {
  items: Array<{ detail: string; sku: string }>;
  title: string;
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <section className="rounded-lg border border-amber-400/30 bg-amber-400/10 p-4">
      <div className="flex items-center gap-2 text-amber-100">
        <AlertTriangle className="h-4 w-4" aria-hidden="true" />
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      <div className="mt-3 max-h-52 overflow-auto text-sm">
        {items.map((item) => (
          <div
            key={`${title}-${item.sku}-${item.detail}`}
            className="flex justify-between gap-4 border-b border-amber-200/10 py-2 last:border-b-0"
          >
            <span className="font-semibold text-amber-50">{item.sku}</span>
            <span className="text-right text-amber-100/80">{item.detail}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

const getCellText = (data: SheetData, rowIndex: number, columnIndex: number) =>
  String(data[rowIndex]?.[columnIndex]?.value ?? '').trim();

const hasOrderLineData = (data: SheetData) =>
  data.some((_, rowIndex) => getCellText(data, rowIndex, 0) && getCellText(data, rowIndex, 2));

const hasPackConfigData = (data: SheetData) =>
  data.some(
    (_, rowIndex) =>
      getCellText(data, rowIndex, 0) &&
      getCellText(data, rowIndex, 1) &&
      getCellText(data, rowIndex, 2) &&
      getCellText(data, rowIndex, 3) &&
      getCellText(data, rowIndex, 4) &&
      getCellText(data, rowIndex, 5),
  );

export function PalletEstimate({
  locations,
  orderLines,
  packConfig,
  selectedLocation,
}: PalletEstimateProps) {
  const palletTypes = useMemo(
    () => locations.map((location) => createLocationPalletType(location)),
    [locations],
  );
  const selectedLocationPalletTypeId = selectedLocation ? `location-${selectedLocation.id}` : '';
  const [selectedPalletTypeId, setSelectedPalletTypeId] = useState(
    selectedLocationPalletTypeId || palletTypes[0]?.id || '',
  );
  const [viewMode, setViewMode] = useState<'all' | 'single'>('all');
  const [packingMode, setPackingMode] = useState<PackingMode>('box-size');
  const [selectedPalletIndex, setSelectedPalletIndex] = useState(0);
  const [estimate, setEstimate] = useState<PalletEstimateResult | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);

  useEffect(() => {
    if (selectedLocationPalletTypeId) {
      setSelectedPalletTypeId(selectedLocationPalletTypeId);
      return;
    }

    if (!palletTypes.some((palletType) => palletType.id === selectedPalletTypeId)) {
      setSelectedPalletTypeId(palletTypes[0]?.id ?? '');
    }
  }, [palletTypes, selectedLocationPalletTypeId, selectedPalletTypeId]);

  const selectedPalletType =
    palletTypes.find((palletType) => palletType.id === selectedPalletTypeId) ?? null;
  const hasRequiredOrderData = useMemo(() => hasOrderLineData(orderLines), [orderLines]);
  const hasRequiredPackData = useMemo(() => hasPackConfigData(packConfig), [packConfig]);
  const hasPalletSetup = palletTypes.length > 0 && selectedPalletType !== null;
  const canCalculate = hasPalletSetup && hasRequiredOrderData && hasRequiredPackData;
  const canCheck = canCalculate && !isCalculating;

  useEffect(() => {
    setEstimate(null);
    setSelectedPalletIndex(0);
    setIsCalculating(false);
  }, [orderLines, packConfig, selectedPalletTypeId]);

  const calculateEstimate = (mode: PackingMode) => {
    if (!canCalculate || !selectedPalletType) {
      return;
    }

    setIsCalculating(true);
    setSelectedPalletIndex(0);
    window.requestAnimationFrame(() => {
      window.setTimeout(() => {
        try {
          setEstimate(
            calculatePalletEstimate(
              orderLines,
              packConfig,
              selectedPalletType,
              packConfigVolumeUnit,
              'm',
              mode,
            ),
          );
        } finally {
          setIsCalculating(false);
        }
      }, 120);
    });
  };

  const pallets = estimate?.pallets ?? [];

  const checkPalletEstimate = () => {
    if (!canCheck) {
      return;
    }

    calculateEstimate(packingMode);
  };

  const changePackingMode = (mode: PackingMode) => {
    if (mode === packingMode || isCalculating) {
      return;
    }

    setPackingMode(mode);

    if (estimate && canCalculate) {
      calculateEstimate(mode);
    }
  };

  const deleteCurrentEstimate = () => {
    setEstimate(null);
    setSelectedPalletIndex(0);
    setViewMode('all');
  };

  const downloadPalletPlan = () => {
    if (!estimate) {
      return;
    }

    const doc = new jsPDF();
    const margin = 14;
    const pageHeight = doc.internal.pageSize.getHeight();
    let y = 16;

    const writeLine = (text: string, size = 10, gap = 6) => {
      if (y > pageHeight - 16) {
        doc.addPage();
        y = 16;
      }

      doc.setFontSize(size);
      doc.text(text, margin, y);
      y += gap;
    };

    writeLine('Pallet Plan', 16, 9);
    writeLine(`Pallet type: ${estimate.palletType.name}`);
    writeLine(`Pallets: ${estimate.pallets.length}`);
    writeLine(`Total boxes: ${estimate.totalBoxes}`);
    writeLine(`Total volume: ${formatVolume(estimate.totalVolume, packConfigVolumeUnit)}`);
    writeLine(`Restack method: ${packingModeOptions.find((option) => option.id === packingMode)?.label ?? packingMode}`);
    writeLine(`Utilization: ${estimate.utilization}%`, 10, 10);

    estimate.pallets.forEach((pallet) => {
      writeLine(`Pallet ${pallet.index} - ${formatVolume(pallet.usedVolume, packConfigVolumeUnit)}`, 12, 8);
      pallet.lines.forEach((line) => {
        writeLine(
          `${line.sku}: ${line.boxes} boxes${
            line.partialBoxes > 0 ? ` (${line.partialBoxes} partial)` : ''
          } | ${formatNumber(line.width)} x ${formatNumber(line.depth)} x ${formatNumber(
            line.height,
          )} cm | ${formatVolume(line.boxVolume, packConfigVolumeUnit)} / box | ${formatVolume(
            line.volume,
            packConfigVolumeUnit,
          )} total`,
          9,
          5,
        );
      });
      y += 3;
    });

    if (estimate.partialBoxSkus.length > 0) {
      writeLine('Partial box flags', 12, 8);
      estimate.partialBoxSkus.forEach((sku) => {
        writeLine(
          `${sku.sku}: ${formatNumber(sku.orderQuantity)} units / ratio ${formatNumber(
            sku.ratio,
          )} = ${formatNumber(sku.exactBoxes)} boxes`,
          9,
          5,
        );
      });
    }

    doc.save('pallet-plan.pdf');
  };

  useEffect(() => {
    setSelectedPalletIndex((currentIndex) =>
      Math.min(Math.max(0, currentIndex), Math.max(0, pallets.length - 1)),
    );
  }, [pallets.length]);

  const goToPreviousPallet = () => {
    setSelectedPalletIndex((currentIndex) => Math.max(0, currentIndex - 1));
    setViewMode('single');
  };

  const goToNextPallet = () => {
    setSelectedPalletIndex((currentIndex) =>
      Math.min(pallets.length - 1, currentIndex + 1),
    );
    setViewMode('single');
  };

  const warningItems = [
    ...(estimate?.missingPackConfigs ?? []).map((item) => ({
      sku: item.sku,
      detail: `Missing pack config for ${formatNumber(item.orderQuantity)} units`,
    })),
    ...(estimate?.invalidPackConfigs ?? []).map((item) => ({
      sku: item.packSku,
      detail: item.reason,
    })),
  ];

  return (
    <div className="grid gap-5 xl:grid-cols-[440px_1fr]">
      <aside className="space-y-4">
        <section className="rounded-lg border border-slate-800 bg-slate-950/60 p-4">
          <h2 className="text-base font-semibold">Pallet controls</h2>
          <div className="mt-4">
            <label className="text-xs font-semibold text-slate-300" htmlFor="pallet-type">
              Pallet type
            </label>
            <select
              id="pallet-type"
              className="mt-2 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-cyan-400"
              disabled={palletTypes.length === 0}
              value={selectedPalletTypeId}
              onChange={(event) => setSelectedPalletTypeId(event.target.value)}
            >
              {palletTypes.length === 0 ? (
                <option value="">No pallet setup saved</option>
              ) : (
                palletTypes.map((palletType) => (
                  <option key={palletType.id} value={palletType.id}>
                    {palletType.name}
                  </option>
                ))
              )}
            </select>
          </div>

          <div className="mt-4">
            <label className="text-xs font-semibold text-slate-300" htmlFor="packing-mode">
              Restack method
            </label>
            <select
              id="packing-mode"
              className="mt-2 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-cyan-400 disabled:cursor-not-allowed disabled:border-slate-800 disabled:text-slate-500"
              disabled={isCalculating}
              value={packingMode}
              onChange={(event) => changePackingMode(event.target.value as PackingMode)}
            >
              {packingModeOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
            <p className="mt-2 text-xs leading-5 text-slate-500">
              {packingModeOptions.find((option) => option.id === packingMode)?.description}
            </p>
          </div>

          <button
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-md bg-cyan-400 px-4 py-2 text-sm font-bold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
            disabled={!canCheck}
            type="button"
            onClick={checkPalletEstimate}
          >
            Check
          </button>

          <button
            className="mt-3 w-full rounded-md border border-slate-600 px-4 py-2 text-sm font-bold text-slate-100 transition hover:border-cyan-300 hover:text-cyan-200 disabled:cursor-not-allowed disabled:border-slate-800 disabled:text-slate-600"
            disabled={!estimate}
            type="button"
            onClick={downloadPalletPlan}
          >
            Show Pallet Plan
          </button>

          <button
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-md border border-slate-700 px-4 py-2 text-sm font-bold text-slate-100 transition hover:border-red-300/70 hover:text-red-100 disabled:cursor-not-allowed disabled:border-slate-800 disabled:text-slate-600"
            disabled={!estimate || isCalculating}
            type="button"
            onClick={deleteCurrentEstimate}
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            Delete Current Estimate
          </button>

          {!estimate && (
            <p className="mt-3 rounded-md border border-dashed border-slate-700 px-3 py-3 text-sm text-slate-400">
              {hasRequiredOrderData && hasRequiredPackData
                ? hasPalletSetup
                  ? 'Click Check to calculate pallets.'
                  : 'Add a pallet in Pallet Setup before calculating.'
                : 'Paste order line and pack config data before calculating.'}
            </p>
          )}

          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              className={`rounded-md border px-3 py-2 text-sm font-semibold transition ${
                viewMode === 'all'
                  ? 'border-cyan-400/60 bg-cyan-400/10 text-cyan-100'
                  : 'border-slate-700 text-slate-300 hover:border-cyan-400/60'
              }`}
              type="button"
              onClick={() => setViewMode('all')}
            >
              Show all
            </button>
            <button
              className={`rounded-md border px-3 py-2 text-sm font-semibold transition ${
                viewMode === 'single'
                  ? 'border-cyan-400/60 bg-cyan-400/10 text-cyan-100'
                  : 'border-slate-700 text-slate-300 hover:border-cyan-400/60'
              }`}
              type="button"
              onClick={() => setViewMode('single')}
            >
              Individual
            </button>
          </div>

          <div className="mt-3 grid grid-cols-[44px_1fr_44px] items-center gap-2">
            <button
              aria-label="Previous pallet"
              className="rounded-md border border-slate-700 p-2 text-slate-300 transition hover:border-cyan-400/60 hover:text-cyan-100 disabled:cursor-not-allowed disabled:border-slate-800 disabled:text-slate-600"
              disabled={selectedPalletIndex === 0 || pallets.length === 0}
              type="button"
              onClick={goToPreviousPallet}
            >
              <ChevronLeft className="h-5 w-5" aria-hidden="true" />
            </button>
            <div className="rounded-md border border-slate-800 px-3 py-2 text-center text-sm font-semibold text-slate-300">
              {pallets.length > 0
                ? `Pallet ${selectedPalletIndex + 1} of ${pallets.length}`
                : 'No pallets'}
            </div>
            <button
              aria-label="Next pallet"
              className="rounded-md border border-slate-700 p-2 text-slate-300 transition hover:border-cyan-400/60 hover:text-cyan-100 disabled:cursor-not-allowed disabled:border-slate-800 disabled:text-slate-600"
              disabled={selectedPalletIndex >= pallets.length - 1}
              type="button"
              onClick={goToNextPallet}
            >
              <ChevronRight className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </section>

        <div className="grid grid-cols-2 gap-3">
          <MetricCard label="Pallets" value={pallets.length} />
          <MetricCard
            helper="Box volume divided by total pallet capacity."
            label="Utilization"
            value={`${estimate?.utilization ?? 0}%`}
          />
          <MetricCard label="Boxes" value={estimate?.totalBoxes ?? 0} />
          <MetricCard label="Volume" value={formatVolume(estimate?.totalVolume ?? 0, packConfigVolumeUnit)} />
        </div>

        <WarningList items={warningItems} title="Pack config issues" />
        <WarningList
          title="Partial box flags"
          items={(estimate?.partialBoxSkus ?? []).map((sku) => ({
            sku: sku.sku,
            detail: `${formatNumber(sku.orderQuantity)} units / ratio ${formatNumber(
              sku.ratio,
            )} = ${formatNumber(sku.exactBoxes)} boxes`,
          }))}
        />
        <WarningList
          title="Oversized SKU boxes"
          items={(estimate?.oversizedSkus ?? []).map((sku) => ({
            sku: sku.sku,
            detail: `Box volume ${formatVolume(sku.boxVolume, packConfigVolumeUnit)} exceeds pallet volume ${formatVolume(
              estimate?.palletVolume ?? 0,
              packConfigVolumeUnit,
            )}`,
          }))}
        />
      </aside>

      <PalletEstimateViewer
        mode={viewMode}
        pallets={pallets}
        palletType={estimate?.palletType ?? selectedPalletType ?? { id: 'empty', name: 'No pallet setup', width: 120, depth: 100, height: 150 }}
        selectedPalletIndex={selectedPalletIndex}
        volumeUnit={packConfigVolumeUnit}
      />

      {isCalculating && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/70 backdrop-blur-sm">
          <div className="flex min-h-60 min-w-72 flex-col items-center justify-center gap-5 rounded-lg border border-cyan-400/40 bg-slate-950/95 px-10 py-9 shadow-2xl">
            <LoaderCircle className="h-24 w-24 animate-spin text-cyan-300" aria-hidden="true" />
            <span className="text-xl font-semibold text-cyan-100">Calculating</span>
          </div>
        </div>
      )}
    </div>
  );
}
