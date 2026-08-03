import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Box,
  ChevronDown,
  ClipboardList,
  FileText,
  Grid3X3,
  PackageCheck,
  Trash2,
} from 'lucide-react';
import { LocationForm } from './components/LocationForm';
import { LocationSelector } from './components/LocationSelector';
import { PalletEstimate } from './components/PalletEstimate';
import { PasteSpreadsheet } from './components/PasteSpreadsheet';
import { ThreeDViewer } from './components/ThreeDViewer';
import { useLocalStorage } from './hooks/useLocalStorage';
import type { Location } from './types';
import { createSheetData, type SheetData } from './utils/sheetData';

type ViewId = 'pallet-estimate' | 'order-line' | 'pack-config' | 'pallet-setup' | 'documentation';

const navigationItems = [
  {
    id: 'pallet-estimate',
    label: 'Pallet Estimate',
    description: 'Estimate workspace',
    icon: PackageCheck,
  },
  {
    id: 'order-line',
    label: 'Order Line',
    description: 'Paste order rows',
    icon: ClipboardList,
  },
  {
    id: 'pack-config',
    label: 'Pack Config',
    description: 'Paste pack data',
    icon: Grid3X3,
  },
  {
    id: 'pallet-setup',
    label: 'Pallet Setup',
    description: 'Location dimensions',
    icon: Box,
  },
  {
    id: 'documentation',
    label: 'Documentation',
    description: 'Workflow logic',
    icon: FileText,
  },
] satisfies Array<{
  id: ViewId;
  label: string;
  description: string;
  icon: typeof PackageCheck;
}>;

const orderLineColumns = [
  'SKU',
  'Order',
  'Qty Order',
  '',
  '',
  '',
  '',
  '',
];

const packConfigColumns = [
  'SKU',
  'Width',
  'Height',
  'Depth',
  'Volume',
  'Ratio',
  '',
  '',
];

const sheetRows = 200;

type DocumentationTopicId =
  | 'workflow'
  | 'sku-matching'
  | 'box-quantity'
  | 'packing-logic'
  | 'restack-methods'
  | 'metrics'
  | 'viewport';

const documentationTopics: Array<{
  description: string;
  id: DocumentationTopicId;
  label: string;
}> = [
  { description: 'Setup, paste data, calculate, export.', id: 'workflow', label: 'Main Workflow' },
  { description: 'How order SKUs match pack SKUs.', id: 'sku-matching', label: 'SKU Matching' },
  { description: 'Ratio, boxes, and partial boxes.', id: 'box-quantity', label: 'Box Quantity Logic' },
  { description: 'Rotations, support, consolidation.', id: 'packing-logic', label: 'Pallet Packing Logic' },
  { description: 'By Box Size, Column Stack, Free Placement.', id: 'restack-methods', label: 'Restack Methods' },
  { description: 'Pallets, utilization, and volume.', id: 'metrics', label: 'Metrics' },
  { description: '3D view, right click, PDF plan.', id: 'viewport', label: '3D Viewport' },
];

function App() {
  const [activeView, setActiveView] = useState<ViewId>('pallet-estimate');
  const [activeDocumentationTopic, setActiveDocumentationTopic] =
    useState<DocumentationTopicId>('workflow');
  const [locations, setLocations] = useLocalStorage<Location[]>('location-box-fit.locations', []);
  const [selectedLocationId, setSelectedLocationId] = useLocalStorage<string>(
    'location-box-fit.selectedLocationId',
    '',
  );
  const [orderLines, setOrderLines] = useLocalStorage<SheetData>(
    'location-box-fit.orderLines',
    createSheetData(sheetRows, orderLineColumns.length),
  );
  const [packConfig, setPackConfig] = useLocalStorage<SheetData>(
    'location-box-fit.packConfig',
    createSheetData(sheetRows, packConfigColumns.length),
  );

  useEffect(() => {
    if (!selectedLocationId && locations[0]) {
      setSelectedLocationId(locations[0].id);
    }
  }, [locations, selectedLocationId, setSelectedLocationId]);

  const selectedLocation = useMemo(
    () => locations.find((location) => location.id === selectedLocationId) ?? null,
    [locations, selectedLocationId],
  );

  const filledOrderRows = useMemo(
    () => countFilledRows(orderLines),
    [orderLines],
  );
  const filledPackRows = useMemo(
    () => countFilledRows(packConfig),
    [packConfig],
  );

  const addLocation = (location: Location) => {
    setLocations((current) => [...current, location]);
    setSelectedLocationId(location.id);
  };

  const deleteLocation = (locationId: string) => {
    setLocations((current) => current.filter((location) => location.id !== locationId));
    if (selectedLocationId === locationId) {
      const nextLocation = locations.find((location) => location.id !== locationId);
      setSelectedLocationId(nextLocation?.id ?? '');
    }
  };

  const renderActiveView = () => {
    if (activeView === 'order-line') {
      return (
        <WorkspacePanel
          eyebrow="Order Line"
          title="Order line sheet"
          aside={`${filledOrderRows} pasted rows`}
          action={
            <IconButton
              label="Clear order line sheet"
              onClick={() => setOrderLines(createSheetData(sheetRows, orderLineColumns.length))}
            />
          }
        >
          <PasteSpreadsheet
            columns={orderLineColumns}
            data={orderLines}
            rows={sheetRows}
            onChange={setOrderLines}
          />
        </WorkspacePanel>
      );
    }

    if (activeView === 'pack-config') {
      return (
        <WorkspacePanel
          eyebrow="Pack Config"
          title="Pack configuration sheet"
          aside={`${filledPackRows} pasted rows`}
          action={
            <IconButton
              label="Clear pack config sheet"
              onClick={() => setPackConfig(createSheetData(sheetRows, packConfigColumns.length))}
            />
          }
        >
          <PasteSpreadsheet
            columns={packConfigColumns}
            data={packConfig}
            rows={sheetRows}
            onChange={setPackConfig}
          />
        </WorkspacePanel>
      );
    }

    if (activeView === 'pallet-estimate') {
      return (
        <WorkspacePanel
          eyebrow="Pallet Estimate"
          title="Pallet estimate"
          aside={`${filledOrderRows} order rows / ${filledPackRows} pack rows`}
        >
          <PalletEstimate
            locations={locations}
            orderLines={orderLines}
            packConfig={packConfig}
            selectedLocation={selectedLocation}
          />
        </WorkspacePanel>
      );
    }

    if (activeView === 'documentation') {
      return (
        <WorkspacePanel
          eyebrow="Documentation"
          title={documentationTopics.find((topic) => topic.id === activeDocumentationTopic)?.label ?? 'Software logic'}
          aside="Documentation"
        >
          <DocumentationView activeTopic={activeDocumentationTopic} />
        </WorkspacePanel>
      );
    }

    return (
      <WorkspacePanel
        eyebrow="Pallet Setup"
        title="Location dimension setup"
        aside={selectedLocation ? selectedLocation.name : 'No location selected'}
      >
        <div className="grid gap-5 xl:grid-cols-[390px_1fr]">
          <aside className="space-y-4">
            <section className="rounded-lg border border-slate-800 bg-slate-950/60 p-4">
              <h2 className="text-base font-semibold">Location setup</h2>
              <div className="mt-4">
                <LocationForm onAddLocation={addLocation} />
              </div>
              <div className="mt-5">
                <LocationSelector
                  locations={locations}
                  selectedLocationId={selectedLocationId}
                  onDeleteLocation={deleteLocation}
                  onSelectLocation={setSelectedLocationId}
                />
              </div>
            </section>
          </aside>

          <ThreeDViewer location={selectedLocation} result={null} />
        </div>
      </WorkspacePanel>
    );
  };

  return (
    <main className="min-h-screen bg-[#070b12] text-slate-100">
      <div className="mx-auto flex min-h-screen max-w-[1700px] gap-5 px-4 py-5 lg:px-6">
        <aside className="hidden w-[280px] shrink-0 flex-col rounded-lg border border-slate-800 bg-slate-950/80 p-4 md:flex">
          <div>
            <p className="text-sm font-semibold uppercase text-cyan-300">Location Box Fit</p>
            <h1 className="mt-2 text-2xl font-semibold text-white">Warehouse planner</h1>
          </div>

          <nav className="mt-8 space-y-2">
            {navigationItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeView === item.id;
              const isDocumentation = item.id === 'documentation';

              return (
                <div key={item.id}>
                  <button
                    className={`flex w-full items-center gap-3 rounded-md border px-3 py-3 text-left transition ${
                      isActive
                        ? 'border-cyan-400/60 bg-cyan-400/10 text-cyan-100'
                        : 'border-transparent text-slate-300 hover:border-slate-700 hover:bg-slate-900'
                    }`}
                    type="button"
                    onClick={() => setActiveView(item.id)}
                  >
                    <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold">{item.label}</span>
                      <span className="block truncate text-xs text-slate-500">
                        {item.description}
                      </span>
                    </span>
                    {isDocumentation && (
                      <ChevronDown
                        className={`h-4 w-4 shrink-0 transition ${isActive ? 'rotate-180' : ''}`}
                        aria-hidden="true"
                      />
                    )}
                  </button>

                  {isDocumentation && isActive && (
                    <div className="ml-8 mt-2 space-y-1 border-l border-slate-800 pl-3">
                      {documentationTopics.map((topic) => {
                        const isTopicActive = activeDocumentationTopic === topic.id;

                        return (
                          <button
                            key={topic.id}
                            className={`w-full rounded-md px-3 py-2 text-left text-sm transition ${
                              isTopicActive
                                ? 'bg-cyan-400/10 font-semibold text-cyan-100'
                                : 'text-slate-400 hover:bg-slate-900 hover:text-slate-100'
                            }`}
                            type="button"
                            onClick={() => {
                              setActiveView('documentation');
                              setActiveDocumentationTopic(topic.id);
                            }}
                          >
                            <span className="block truncate">{topic.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>

          <div className="mt-auto grid gap-2 text-xs text-slate-400">
            <span className="rounded-md border border-slate-800 px-3 py-2">
              Locations {locations.length}
            </span>
            <span className="rounded-md border border-slate-800 px-3 py-2">
              Order rows {filledOrderRows}
            </span>
            <span className="rounded-md border border-slate-800 px-3 py-2">
              Pack rows {filledPackRows}
            </span>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col gap-5">
          <header className="flex flex-col justify-between gap-3 border-b border-slate-800 pb-5 lg:flex-row lg:items-end">
            <div>
              <p className="text-sm font-semibold uppercase text-cyan-300">Location Box Fit</p>
              <h1 className="mt-2 text-3xl font-semibold text-white md:text-4xl">
                Warehouse pallet planning workspace
              </h1>
            </div>

            <nav className="grid grid-cols-2 gap-2 md:hidden">
              {navigationItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeView === item.id;

                return (
                  <button
                    key={item.id}
                    className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-semibold transition ${
                      isActive
                        ? 'border-cyan-400/60 bg-cyan-400/10 text-cyan-100'
                        : 'border-slate-800 text-slate-300'
                    }`}
                    type="button"
                    onClick={() => setActiveView(item.id)}
                  >
                    <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                    {item.label}
                  </button>
                );
              })}
            </nav>
          </header>

          {renderActiveView()}
        </div>
      </div>
    </main>
  );
}

function countFilledRows(data: SheetData) {
  return data.filter((row) =>
    row.some((cell) => String(cell?.value ?? '').trim().length > 0),
  ).length;
}

interface WorkspacePanelProps {
  action?: ReactNode;
  aside?: string;
  children: ReactNode;
  eyebrow: string;
  title: string;
}

function WorkspacePanel({ action, aside, children, eyebrow, title }: WorkspacePanelProps) {
  return (
    <section className="min-w-0 flex-1">
      <div className="mb-4 flex flex-col justify-between gap-2 md:flex-row md:items-end">
        <div>
          <p className="text-xs font-semibold uppercase text-cyan-300">{eyebrow}</p>
          <h2 className="mt-1 text-2xl font-semibold text-white">{title}</h2>
        </div>
        <div className="flex items-center gap-2">
          {action}
          {aside && (
            <div className="rounded-md border border-slate-800 px-3 py-2 text-xs font-semibold text-slate-300">
              {aside}
            </div>
          )}
        </div>
      </div>
      {children}
    </section>
  );
}

function IconButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      aria-label={label}
      className="rounded-md border border-slate-800 p-2 text-slate-300 transition hover:border-cyan-400/60 hover:bg-cyan-400/10 hover:text-cyan-100"
      title={label}
      type="button"
      onClick={onClick}
    >
      <Trash2 className="h-4 w-4" aria-hidden="true" />
    </button>
  );
}

function DocumentationView({ activeTopic }: { activeTopic: DocumentationTopicId }) {
  const renderTopic = () => {
    if (activeTopic === 'workflow') {
      return (
        <DocumentationSection title="Main Workflow">
          <DocumentationPoint
            title="1. Pallet Setup"
            text="Create every pallet type or loading location that can be used for estimation. Pallet Estimate only uses pallets saved here."
          />
          <DocumentationPoint
            title="2. Order Line"
            text="Paste order data from Excel. The required fields are SKU and Qty Order. Other pasted columns can stay in the sheet but are ignored by the calculation."
          />
          <DocumentationPoint
            title="3. Pack Config"
            text="Paste pack setup from Excel. Required fields are SKU, Width, Height, Depth, Volume, and Ratio. Dimensions are always metres and the pasted Volume column is expected to be cubic metres."
          />
          <DocumentationPoint
            title="4. Pallet Estimate"
            text="Select one saved pallet type, click Check, then the app calculates pallet count, builds the 3D load plan, flags partial boxes, and enables PDF export."
          />
        </DocumentationSection>
      );
    }

    if (activeTopic === 'sku-matching') {
      return (
        <DocumentationSection title="SKU Matching">
          <DocumentationPoint
            title="Order SKU"
            text="Order Line uses the SKU exactly as pasted in the SKU column."
          />
          <DocumentationPoint
            title="Pack Config SKU"
            text="Pack Config SKU has one extra character at the beginning. The app removes the first character before matching it to the Order Line SKU."
          />
          <DocumentationPoint
            title="Missing Matches"
            text="If an ordered SKU cannot be found in Pack Config after removing that first character, it appears in Pack config issues."
          />
        </DocumentationSection>
      );
    }

    if (activeTopic === 'box-quantity') {
      return (
        <DocumentationSection title="Box Quantity Logic">
          <DocumentationPoint
            title="Ratio"
            text="Ratio means units per box. Boxes required equals Qty Order divided by Ratio, rounded up to the next full box."
          />
          <DocumentationPoint
            title="Partial Boxes"
            text="If Qty Order divided by Ratio is not a whole number, the final box is marked as partial and drawn in a different color."
          />
          <DocumentationPoint
            title="Total Boxes"
            text="Total boxes is the sum of all full boxes plus any partial boxes required across every SKU."
          />
        </DocumentationSection>
      );
    }

    if (activeTopic === 'packing-logic') {
      return (
        <DocumentationSection title="Pallet Packing Logic">
          <DocumentationPoint
            title="1. Box Data Preparation"
            text="For every matched SKU, the app calculates how many boxes are needed from Qty Order and Ratio. It creates one box record for each full box and one extra partial box when the order quantity does not divide evenly by the ratio."
          />
          <DocumentationPoint
            title="2. Physical Dimensions"
            text="Pack Config dimensions are treated as metres and converted to centimetres for the packing engine. The 3D boxes and utilization use Width x Height x Depth, so the visual stack and the percentages are based on the real carton size, not only the pasted Volume value."
          />
          <DocumentationPoint
            title="3. Box Rotations"
            text="Each box can be turned in any direction. The engine checks all valid rotations: width/depth/height can swap positions as long as the rotated box still fits inside the selected pallet dimensions."
          />
          <DocumentationPoint
            title="4. Support Rule"
            text="Boxes on the first layer can sit directly on the pallet floor. Boxes above the floor must have their center supported by boxes underneath and at least 50% of their footprint covered. This prevents floating boxes while still allowing practical bridge-style stacking for better fill."
          />
          <DocumentationPoint
            title="5. Final Consolidation"
            text="After the selected restack method builds a plan, the app double checks any pallet below 50% utilization. It tries to move all boxes from that weak pallet into the already-built pallets using the same 3D fit, rotation, height, overlap, and support rules. If every box fits elsewhere, the weak pallet is removed."
          />
          <DocumentationPoint
            title="6. One-Fewer-Pallet Repack"
            text="The app also tries a full rebuild into one fewer pallet. If every box still fits, it keeps that tighter plan and tries again. This helps catch cases where a better arrangement is possible only after rebuilding the pallet set."
          />
          <DocumentationPoint
            title="7. Pallet Order"
            text="After packing and consolidation, pallets are sorted so the fuller pallets appear first and the least-filled leftover pallet appears last. This makes the individual pallet navigation easier to understand."
          />
          <DocumentationPoint
            title="8. Why Gaps Can Still Exist"
            text="A pallet can still show visible empty space even when utilization is high. Empty volume is not always usable because the remaining gaps may not match any available box size, orientation, support requirement, or pallet height limit."
          />
        </DocumentationSection>
      );
    }

    if (activeTopic === 'restack-methods') {
      return (
        <DocumentationSection title="Restack Methods">
          <DocumentationPoint
            title="By Box Size"
            text="This is the default method. It starts with boxes that have the same dimensions and volume, because those boxes usually create the cleanest base and the most predictable stacks. After that it tries similar-volume boxes, then smaller boxes that can cover leftover gaps."
          />
          <DocumentationPoint
            title="When To Use By Box Size"
            text="Use this first for real warehouse planning. It normally gives the most practical result when many SKUs share the same carton size, because the pallet is built around stable families of boxes before mixing in smaller cartons."
          />
          <DocumentationPoint
            title="Column Stack"
            text="This method builds vertical columns from boxes with the same physical size. It chooses orientations, stacks boxes upward while they fit within pallet height, then fits those complete columns across the pallet floor. It is useful when you want cleaner vertical stacks and stronger layer support."
          />
          <DocumentationPoint
            title="Column Stack Trade Off"
            text="Column Stack can sometimes use more pallets because it protects the column structure instead of freely mixing every box into every gap. It is a stricter, more organized packing style."
          />
          <DocumentationPoint
            title="Free Placement"
            text="This method treats each box individually. It checks candidate spaces created by pallet edges, existing box edges, open floor points, and stacked positions, then places the next box where it fits best using valid rotations, overlap checks, pallet height, and the support rule."
          />
          <DocumentationPoint
            title="When To Use Free Placement"
            text="Use this to test if a more flexible mixed arrangement can reduce the pallet count. It may create a less tidy-looking stack than By Box Size or Column Stack, but it can find placements that the more structured methods skip."
          />
          <DocumentationPoint
            title="Recalculating"
            text="The first Check builds the plan using the selected method. By Box Size is selected by default. After a plan exists, choosing another restack method automatically recalculates the pallet total, utilization, 3D view, and PDF plan."
          />
        </DocumentationSection>
      );
    }

    if (activeTopic === 'metrics') {
      return (
        <DocumentationSection title="What The Metrics Mean">
          <DocumentationPoint
            title="Pallets"
            text="The number of pallets needed for all calculated boxes using the selected pallet setup."
          />
          <DocumentationPoint
            title="Utilization"
            text="Total physical box volume divided by total capacity of all estimated pallets. It is an overall volume percentage, not a guarantee that every visible gap is removed."
          />
          <DocumentationPoint
            title="Volume"
            text="The total physical volume of all boxes placed into the pallet plan, shown in m3. This is calculated from Width x Height x Depth after converting metres to centimetres."
          />
          <DocumentationPoint
            title="3D Pallet Percentage"
            text="The fixed label at the top of the viewport shows the selected pallet number and that pallet's volume utilization."
          />
        </DocumentationSection>
      );
    }

    return (
      <DocumentationSection title="3D Viewport">
        <DocumentationPoint
          title="Show All"
          text="Displays the calculated pallet set together."
        />
        <DocumentationPoint
          title="Individual"
          text="Displays one pallet at a time. Use the arrows to move through pallets."
        />
        <DocumentationPoint
          title="Right Click"
          text="Right click a pallet to open the pallet detail modal with SKUs, box counts, partial boxes, and volumes."
        />
        <DocumentationPoint
          title="PDF Plan"
          text="Show Pallet Plan downloads a PDF with the pallet breakdown after an estimate has been calculated."
        />
      </DocumentationSection>
    );
  };

  return (
    <section>{renderTopic()}</section>
  );
}

function DocumentationSection({ children, title }: { children: ReactNode; title: string }) {
  return (
    <section className="rounded-lg border border-slate-800 bg-slate-950/60 p-4">
      <h3 className="text-base font-semibold text-cyan-100">{title}</h3>
      <div className="mt-4 space-y-3">{children}</div>
    </section>
  );
}

function DocumentationPoint({ text, title }: { text: string; title: string }) {
  return (
    <div className="rounded-md border border-slate-800 bg-slate-950 px-3 py-3">
      <p className="text-sm font-semibold text-slate-100">{title}</p>
      <p className="mt-1 text-sm leading-6 text-slate-400">{text}</p>
    </div>
  );
}

export default App;
