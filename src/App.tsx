import { useEffect, useMemo, useState } from 'react';
import { BoxForm } from './components/BoxForm';
import { LocationForm } from './components/LocationForm';
import { LocationSelector } from './components/LocationSelector';
import { ResultsPanel } from './components/ResultsPanel';
import { ThreeDViewer } from './components/ThreeDViewer';
import { useLocalStorage } from './hooks/useLocalStorage';
import type { BoxDimensions, Location } from './types';
import { calculateBestFit } from './utils/fitCalculator';

function App() {
  const [locations, setLocations] = useLocalStorage<Location[]>('location-box-fit.locations', []);
  const [selectedLocationId, setSelectedLocationId] = useLocalStorage<string>(
    'location-box-fit.selectedLocationId',
    '',
  );
  const [box, setBox] = useState<BoxDimensions>({
    width: 30,
    depth: 20,
    height: 15,
    quantity: 24,
  });
  const [checkedBox, setCheckedBox] = useState<BoxDimensions | null>(null);

  useEffect(() => {
    if (!selectedLocationId && locations[0]) {
      setSelectedLocationId(locations[0].id);
    }
  }, [locations, selectedLocationId, setSelectedLocationId]);

  const selectedLocation = useMemo(
    () => locations.find((location) => location.id === selectedLocationId) ?? null,
    [locations, selectedLocationId],
  );

  const fitResult = useMemo(
    () => (selectedLocation && checkedBox ? calculateBestFit(selectedLocation, checkedBox) : null),
    [checkedBox, selectedLocation],
  );

  const isBoxPlotted = checkedBox !== null;

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

  const checkBoxFit = () => {
    setCheckedBox(box);
  };

  const clearBoxFit = () => {
    setCheckedBox(null);
  };

  return (
    <main className="min-h-screen bg-[#070b12] text-slate-100">
      <div className="mx-auto flex min-h-screen max-w-[1600px] flex-col gap-5 px-4 py-5 lg:px-6">
        <header className="flex flex-col justify-between gap-3 border-b border-slate-800 pb-5 md:flex-row md:items-end">
          <div>
            <p className="text-sm font-semibold uppercase text-cyan-300">Location Box Fit</p>
            <h1 className="mt-2 text-3xl font-semibold text-white md:text-4xl">
              Warehouse shelf box-fitting visualiser
            </h1>
          </div>
          <div className="grid grid-cols-3 gap-2 text-right text-xs text-slate-400">
            <span className="rounded-md border border-slate-800 px-3 py-2">
              Locations {locations.length}
            </span>
            <span className="rounded-md border border-slate-800 px-3 py-2">
              Capacity {fitResult?.totalCapacity ?? 0}
            </span>
            <span className="rounded-md border border-slate-800 px-3 py-2">
              Units {fitResult?.totalUnits ?? 0}
            </span>
          </div>
        </header>

        <div className="grid flex-1 gap-5 xl:grid-cols-[420px_1fr]">
          <aside className="space-y-4 overflow-y-auto xl:max-h-[calc(100vh-130px)]">
            <section className="rounded-lg border border-slate-800 bg-slate-950/60 p-4">
              <h2 className="text-base font-semibold">Location setup</h2>
              <div className="mt-4">
                <LocationForm onAddLocation={addLocation} />
              </div>
              <div className="mt-5">
                <LocationSelector
                  locations={locations}
                  selectedLocationId={selectedLocationId}
                  onSelectLocation={setSelectedLocationId}
                  onDeleteLocation={deleteLocation}
                />
              </div>
            </section>

            <section className="rounded-lg border border-slate-800 bg-slate-950/60 p-4">
              <h2 className="text-base font-semibold">Box setup</h2>
              <div className="mt-4">
                <BoxForm box={box} disabled={isBoxPlotted} onChange={setBox} />
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <button
                    className="rounded-md bg-cyan-400 px-4 py-2 text-sm font-bold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
                    disabled={!selectedLocation || isBoxPlotted}
                    type="button"
                    onClick={checkBoxFit}
                  >
                    Check fit
                  </button>
                  <button
                    className="rounded-md border border-slate-600 px-4 py-2 text-sm font-bold text-slate-100 transition hover:border-cyan-300 hover:text-cyan-200 disabled:cursor-not-allowed disabled:border-slate-800 disabled:text-slate-600"
                    disabled={!isBoxPlotted}
                    type="button"
                    onClick={clearBoxFit}
                  >
                    Clear
                  </button>
                </div>
                <p className="mt-3 text-xs text-slate-500">
                  Check locks these dimensions and plots the shelf. Clear unlocks the form.
                </p>
              </div>
            </section>

            <section className="rounded-lg border border-slate-800 bg-slate-950/60 p-4">
              <h2 className="text-base font-semibold">Results</h2>
              <div className="mt-4">
                <ResultsPanel result={fitResult} />
              </div>
            </section>
          </aside>

          <ThreeDViewer location={selectedLocation} result={fitResult} />
        </div>
      </div>
    </main>
  );
}

export default App;
