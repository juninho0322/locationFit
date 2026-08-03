import type {
  PackingMode,
  PalletEstimateResult,
  PalletType,
  VolumeUnit,
} from '../utils/palletEstimator';
import type { SheetData } from '../utils/sheetData';

interface CalculationAuditProps {
  estimate: PalletEstimateResult | null;
  orderLines: SheetData;
  packConfig: SheetData;
  packingMode: PackingMode;
  selectedPalletType: PalletType | null;
}

const packConfigVolumeUnit: VolumeUnit = 'm3';

const packingModeLabels: Record<PackingMode, string> = {
  'box-size': 'By Box Size',
  'column-stack': 'Column Stack',
  'free-placement': 'Free Placement',
};

const formatNumber = (value: number) =>
  Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, '');

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

const formatPalletDimensions = (palletType: PalletType) =>
  `${formatNumber(palletType.width)} x ${formatNumber(palletType.depth)} x ${formatNumber(
    palletType.height,
  )} cm`;

const getCellText = (data: SheetData, rowIndex: number, columnIndex: number) =>
  String(data[rowIndex]?.[columnIndex]?.value ?? '').trim();

const countRowsWithCells = (data: SheetData, columnIndexes: number[]) =>
  data.filter((_, rowIndex) =>
    columnIndexes.some((columnIndex) => getCellText(data, rowIndex, columnIndex)),
  ).length;

export function CalculationAudit({
  estimate,
  orderLines,
  packConfig,
  packingMode,
  selectedPalletType,
}: CalculationAuditProps) {
  const palletType = estimate?.palletType ?? selectedPalletType;
  const palletVolume = estimate?.palletVolume ?? (
    palletType ? palletType.width * palletType.depth * palletType.height : 0
  );
  const theoreticalMinimumPallets =
    estimate && palletVolume > 0 ? Math.ceil(estimate.totalVolume / palletVolume) : 0;
  const orderRowsWithData = countRowsWithCells(orderLines, [0, 2]);
  const packRowsWithData = countRowsWithCells(packConfig, [0, 1, 2, 3, 4, 5]);
  const auditSnapshot = {
    invalidPackConfigs: estimate?.invalidPackConfigs.length ?? 0,
    matchedSkus: estimate?.skus.length ?? 0,
    missingPackConfigs: estimate?.missingPackConfigs.length ?? 0,
    orderRowsWithData,
    oversizedSkus: estimate?.oversizedSkus.length ?? 0,
    packRowsWithData,
    palletCapacityM3: convertFromCubicCentimeters(palletVolume, packConfigVolumeUnit),
    palletDimensionsCm: palletType
      ? { depth: palletType.depth, height: palletType.height, width: palletType.width }
      : null,
    pallets: estimate?.pallets.length ?? 0,
    restackMethod: packingModeLabels[packingMode],
    theoreticalMinimumPallets,
    totalBoxes: estimate?.totalBoxes ?? 0,
    totalBoxVolumeM3: convertFromCubicCentimeters(estimate?.totalVolume ?? 0, packConfigVolumeUnit),
    totalOrderQuantity: estimate?.totalOrderQuantity ?? 0,
  };

  const copyAudit = () => {
    void navigator.clipboard?.writeText(JSON.stringify(auditSnapshot, null, 2));
  };

  return (
    <section className="max-w-3xl rounded-lg border border-slate-800 bg-slate-950/60 p-4">
      <h3 className="text-base font-semibold text-cyan-100">Calculation audit</h3>
      <div className="mt-4 space-y-2 text-sm">
        <AuditRow label="Selected pallet" value={palletType ? palletType.name : 'No pallet selected'} />
        <AuditRow label="Pallet dimensions" value={palletType ? formatPalletDimensions(palletType) : '-'} />
        <AuditRow label="Pallet capacity" value={formatVolume(palletVolume, packConfigVolumeUnit)} />
        <AuditRow label="Restack method" value={packingModeLabels[packingMode]} />
        <AuditRow label="Total box volume" value={formatVolume(estimate?.totalVolume ?? 0, packConfigVolumeUnit)} />
        <AuditRow label="Order rows read" value={orderRowsWithData} />
        <AuditRow label="Pack rows read" value={packRowsWithData} />
        <AuditRow label="Matched SKUs" value={estimate?.skus.length ?? 0} />
        <AuditRow label="Total boxes" value={estimate?.totalBoxes ?? 0} />
        <AuditRow
          label="Missing / invalid pack rows"
          value={estimate ? `${estimate.missingPackConfigs.length} / ${estimate.invalidPackConfigs.length}` : '0 / 0'}
        />
        <AuditRow label="Volume minimum pallets" value={theoreticalMinimumPallets} isLast />
      </div>
      <button
        className="mt-4 w-full rounded-md border border-slate-700 px-3 py-2 text-sm font-semibold text-slate-200 transition hover:border-cyan-400/60 hover:text-cyan-100"
        type="button"
        onClick={copyAudit}
      >
        Copy Audit
      </button>
      <p className="mt-3 text-xs leading-5 text-slate-500">
        Use this view to compare localhost and deployed results. If pallet dimensions, capacity,
        total volume, total boxes, or rows read differ, the pallet total will differ.
      </p>
    </section>
  );
}

function AuditRow({
  isLast = false,
  label,
  value,
}: {
  isLast?: boolean;
  label: string;
  value: number | string;
}) {
  return (
    <div className={`flex justify-between gap-4 ${isLast ? '' : 'border-b border-slate-800 pb-2'}`}>
      <span className="text-slate-500">{label}</span>
      <span className="text-right font-semibold text-slate-200">{value}</span>
    </div>
  );
}
