import { useMemo, useState } from "react";
import type { Location, Sku } from "../types";
import { calculateBestFit } from "../utils/fitCalculator";
import {
  getLocationKind,
  locationNoun,
  locationTypeLabel,
} from "../utils/locations";
import { numberText, validDimensions } from "../utils/planning";
import {
  DimensionsFields,
  Field,
  LocationChoice,
  Metric,
} from "./PlannerFields";
import { ThreeDViewer } from "./ThreeDViewer";

export function CapacityCheck({
  locations,
  skus,
  locationId,
  onLocationChange,
  onSetup,
}: {
  locations: Location[];
  skus: Sku[];
  locationId: string;
  onLocationChange: (id: string) => void;
  onSetup: () => void;
}) {
  const [source, setSource] = useState<"saved" | "quick">(
    skus.length ? "saved" : "quick",
  );
  const [skuId, setSkuId] = useState(skus[0]?.id ?? "");
  const [box, setBox] = useState({
    width: 30,
    depth: 20,
    height: 20,
    unitsPerCase: 12,
  });
  const location = locations.find((item) => item.id === locationId) ?? null;
  const sku = skus.find((item) => item.id === skuId);
  const dimensions = source === "saved" ? sku : box;
  const result = useMemo(
    () =>
      location &&
      dimensions &&
      validDimensions(dimensions) &&
      Number.isSafeInteger(dimensions.unitsPerCase) &&
      dimensions.unitsPerCase > 0
        ? calculateBestFit(location, {
            ...dimensions,
            quantity: dimensions.unitsPerCase,
          })
        : null,
    [location, dimensions],
  );
  return (
    <div className="workspace-grid">
      <div className="space-y-4">
        <section className="panel">
          <div className="panel-heading">
            <span className="step">01</span>
            <h3>Choose your space</h3>
          </div>
          <LocationChoice
            locations={locations}
            value={locationId}
            onChange={onLocationChange}
          />
          {location && (
            <p className="helper">
              {locationTypeLabel(location)} · usable internal dimensions
              {getLocationKind(location) === "pick-face" &&
                " · Single SKU only"}
            </p>
          )}
          {!locations.length && (
            <button className="button secondary" onClick={onSetup}>
              Create your first location
            </button>
          )}
        </section>
        <section className="panel">
          <div className="panel-heading">
            <span className="step">02</span>
            <h3>Choose a case</h3>
          </div>
          <div className="segmented">
            <button
              className={source === "saved" ? "active" : ""}
              onClick={() => setSource("saved")}
            >
              Saved SKU
            </button>
            <button
              className={source === "quick" ? "active" : ""}
              onClick={() => setSource("quick")}
            >
              Quick dimensions
            </button>
          </div>
          {source === "saved" ? (
            <>
              <Field label="SKU">
                <select
                  value={skuId}
                  onChange={(event) => setSkuId(event.target.value)}
                >
                  <option value="">Select a SKU…</option>
                  {skus.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.code} · {item.description}
                    </option>
                  ))}
                </select>
              </Field>
              {sku && (
                <p className="helper">
                  {sku.width} × {sku.depth} × {sku.height} cm ·{" "}
                  {sku.unitsPerCase} units per case
                </p>
              )}
              {!skus.length && (
                <p className="helper">
                  Add a SKU in SKU setup, or use quick dimensions.
                </p>
              )}
            </>
          ) : (
            <>
              <DimensionsFields
                value={box}
                onChange={(key, value) => setBox({ ...box, [key]: value })}
              />
              <Field label="Units per case">
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={box.unitsPerCase || ""}
                  onChange={(event) =>
                    setBox({ ...box, unitsPerCase: Number(event.target.value) })
                  }
                />
              </Field>
            </>
          )}
        </section>
        <section className="panel result-panel" aria-live="polite">
          <p className="eyebrow">Capacity of one {locationNoun(location)}</p>
          {result ? (
            result.fits ? (
              <>
                <div className="metrics">
                  <Metric
                    accent
                    label="Cases fit"
                    value={numberText(result.totalCapacity)}
                  />
                  <Metric
                    label="Units fit"
                    value={numberText(
                      result.totalCapacity * dimensions!.unitsPerCase,
                    )}
                  />
                </div>
                <div className="utilization">
                  <span style={{ width: `${result.volumeUtilization}%` }} />
                </div>
                <p className="helper">
                  {result.volumeUtilization}% of the space used ·{" "}
                  {result.boxesAcrossHeight} layers
                </p>
                {result.totalCapacity > result.positions.length && (
                  <p className="helper">
                    Preview shows the first {result.positions.length} cases.
                    Capacity includes all cases.
                  </p>
                )}
              </>
            ) : (
              <p className="notice">
                This case does not fit in any orientation. Try a larger location
                or a smaller case.
              </p>
            )
          ) : (
            <p className="helper">
              Choose a location and enter valid case dimensions to see capacity.
            </p>
          )}
          <p className="fine-print">
            Best uniform grid across six rotations. Units stay inside cases.
            Actual capacity can vary with stacking and handling requirements.
          </p>
        </section>
      </div>
      <ThreeDViewer location={location} result={result} />
    </div>
  );
}
