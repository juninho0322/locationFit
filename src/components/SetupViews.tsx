import { useState, type FormEvent } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import {
  getLocationKind,
  getPalletFormat,
  setPalletFormat,
  locationDisplayLabel,
  locationDraftPreview,
  setLocationKind,
} from "../utils/locations";
import type {
  Location,
  LocationKind,
  PalletFormat,
  Order,
  Sku,
} from "../types";
import { dimensionsText, validDimensions, validSku } from "../utils/planning";
import { DimensionsFields, Empty, Field } from "./PlannerFields";
import { ThreeDViewer } from "./ThreeDViewer";

const blankSku: Sku = {
  id: "",
  code: "",
  description: "",
  unitsPerCase: 1,
  width: 0,
  depth: 0,
  height: 0,
};
const blankLocation: Location = {
  kind: "pick-face",
  id: "",
  name: "",
  type: "Pick face",
  countAs: "location",
  width: 0,
  depth: 0,
  height: 0,
};

export function SkuSetup({
  skus,
  orders,
  onChange,
}: {
  skus: Sku[];
  orders: Order[];
  onChange: (skus: Sku[]) => void;
}) {
  const [draft, setDraft] = useState<Sku>(blankSku);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!validSku(draft)) {
      setError(
        "Enter a SKU code, positive case dimensions and whole units per case.",
      );
      return;
    }
    if (
      skus.some(
        (item) =>
          item.id !== draft.id &&
          item.code.toUpperCase() === draft.code.trim().toUpperCase(),
      )
    ) {
      setError("This SKU code already exists. Edit the existing SKU instead.");
      return;
    }
    const item = {
      ...draft,
      code: draft.code.trim(),
      description: draft.description.trim(),
      id: draft.id || crypto.randomUUID(),
    };
    onChange(
      draft.id
        ? skus.map((sku) => (sku.id === draft.id ? item : sku))
        : [...skus, item],
    );
    setDraft(blankSku);
    setError("");
  };
  return (
    <div className="setup-grid">
      <form className="panel self-start" onSubmit={submit}>
        <div className="panel-heading">
          <Plus size={18} />
          <h3>{draft.id ? "Edit SKU" : "New SKU"}</h3>
        </div>
        <Field label="SKU code">
          <input
            required
            value={draft.code}
            placeholder="e.g. SKU-001"
            onChange={(event) =>
              setDraft({ ...draft, code: event.target.value })
            }
          />
        </Field>
        <Field label="Description">
          <input
            value={draft.description}
            placeholder="e.g. Cotton hand towels"
            onChange={(event) =>
              setDraft({ ...draft, description: event.target.value })
            }
          />
        </Field>
        <Field label="Units per case">
          <input
            required
            type="number"
            min="1"
            step="1"
            value={draft.unitsPerCase || ""}
            onChange={(event) =>
              setDraft({ ...draft, unitsPerCase: Number(event.target.value) })
            }
          />
        </Field>
        <p className="form-subtitle">Outer case dimensions</p>
        <DimensionsFields
          value={draft}
          onChange={(key, value) => setDraft({ ...draft, [key]: value })}
        />
        <p className="helper">
          Measure the full box, including packaging. All dimensions are in
          centimetres.
        </p>
        {error && (
          <p className="notice" role="alert">
            {error}
          </p>
        )}
        <button className="button primary" type="submit">
          {draft.id ? "Save changes" : "Add SKU"}
        </button>
        {draft.id && (
          <button
            type="button"
            className="button secondary"
            onClick={() => {
              setDraft(blankSku);
              setError("");
            }}
          >
            Cancel edit
          </button>
        )}
      </form>
      <section className="panel self-start">
        <div className="panel-heading spread">
          <h3>
            SKU library <span className="count">{skus.length}</span>
          </h3>
        </div>
        <Field label="Search SKUs">
          <input
            placeholder="Search code or description…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </Field>
        {skus.length ? (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>SKU / description</th>
                  <th>Units / case</th>
                  <th>Case W × D × H</th>
                  <th>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {skus
                  .filter((sku) =>
                    `${sku.code} ${sku.description}`
                      .toLowerCase()
                      .includes(search.toLowerCase()),
                  )
                  .map((sku) => {
                    const inUse = orders.some((order) =>
                      order.lines.some((line) => line.skuId === sku.id),
                    );
                    return (
                      <tr key={sku.id}>
                        <td>
                          <strong>{sku.code}</strong>
                          <small>{sku.description || "No description"}</small>
                        </td>
                        <td>{sku.unitsPerCase}</td>
                        <td>{dimensionsText(sku)}</td>
                        <td>
                          <div className="row-actions">
                            <button
                              className="icon-button"
                              aria-label={`Edit ${sku.code}`}
                              onClick={() => {
                                setDraft(sku);
                                setError("");
                              }}
                            >
                              <Pencil size={16} />
                            </button>
                            <button
                              className="icon-button danger"
                              aria-label={`Delete ${sku.code}`}
                              title={
                                inUse
                                  ? "Remove this SKU from saved orders before deleting"
                                  : "Delete SKU"
                              }
                              disabled={inUse}
                              onClick={() => {
                                onChange(
                                  skus.filter((item) => item.id !== sku.id),
                                );
                                if (draft.id === sku.id) setDraft(blankSku);
                              }}
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty title="Your products, ready to reuse">
            Save a SKU once, then select it in capacity checks and order lines.
          </Empty>
        )}
      </section>
    </div>
  );
}

export function LocationSetup({
  locations,
  selectedId,
  onSelect,
  onChange,
}: {
  locations: Location[];
  selectedId: string;
  onSelect: (id: string) => void;
  onChange: (locations: Location[]) => void;
}) {
  const [draft, setDraftValue] = useState<Location>(blankLocation);
  const [draftPreview, setDraftPreview] = useState(true);
  const setDraft = (next: Location) => {
    setDraftValue(next);
    setDraftPreview(true);
  };
  const preview = locationDraftPreview(draft);
  const [error, setError] = useState("");
  const selected =
    locations.find((location) => location.id === selectedId) ?? null;
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!draft.name.trim() || !validDimensions(draft)) {
      setError("Enter a name, location type and positive dimensions.");
      return;
    }
    const item = setLocationKind(
      {
        ...draft,
        name: draft.name.trim(),
        id: draft.id || crypto.randomUUID(),
      },
      getLocationKind(draft),
    );
    onChange(
      draft.id
        ? locations.map((location) =>
            location.id === draft.id ? item : location,
          )
        : [...locations, item],
    );
    onSelect(item.id);
    setDraft(blankLocation);
    setDraftPreview(false);
    setError("");
  };
  return (
    <div className="workspace-grid">
      <div className="space-y-4">
        <form className="panel" onSubmit={submit}>
          <div className="panel-heading">
            <Plus size={18} />
            <h3>{draft.id ? "Edit location" : "New location"}</h3>
          </div>
          <div className="preset-buttons">
            <button
              type="button"
              aria-pressed={getLocationKind(draft) === "pick-face"}
              onClick={() =>
                setDraft({
                  ...blankLocation,
                  name: "Small pick face",
                  width: 60,
                  depth: 40,
                  height: 40,
                })
              }
            >
              Pick face
            </button>
            <button
              type="button"
              aria-pressed={
                getLocationKind(draft) === "pallet" &&
                getPalletFormat(draft) === "uk"
              }
              onClick={() =>
                setDraft({
                  ...blankLocation,
                  palletFormat: "uk",
                  name: "UK pallet",
                  kind: "pallet",
                  type: "Pallet",
                  countAs: "pallet",
                  width: 120,
                  depth: 100,
                  height: 150,
                })
              }
            >
              UK pallet
            </button>
            <button
              type="button"
              aria-pressed={getLocationKind(draft) === "cage"}
              onClick={() =>
                setDraft({
                  ...blankLocation,
                  name: "Cage",
                  kind: "cage",
                  type: "Cage",
                  countAs: "cage",
                  width: 80,
                  depth: 70,
                  height: 160,
                })
              }
            >
              Cage
            </button>
          </div>
          <Field label="Location name">
            <input
              required
              placeholder="e.g. Aisle A / Bay 03"
              value={draft.name}
              onChange={(event) =>
                setDraft({ ...draft, name: event.target.value })
              }
            />
          </Field>
          <Field label="Location type">
            <select
              required
              value={getLocationKind(draft)}
              onChange={(event) =>
                setDraft(
                  setLocationKind(draft, event.target.value as LocationKind),
                )
              }
            >
              <option value="pick-face">Pick face — single SKU only</option>
              <option value="pallet">Pallet</option>
              <option value="cage">Cage</option>
            </select>
          </Field>
          {getLocationKind(draft) === "pallet" && (
            <Field label="Pallet footprint">
              <select
                value={getPalletFormat(draft)}
                onChange={(event) =>
                  setDraft(
                    setPalletFormat(draft, event.target.value as PalletFormat),
                  )
                }
              >
                <option value="uk">UK pallet · 120 × 100 cm</option>
                <option value="euro">Euro pallet · 120 × 80 cm</option>
                <option value="custom">Custom pallet · your dimensions</option>
              </select>
            </Field>
          )}
          <div className="selected-volume-type" role="status">
            <span>Selected type</span>
            <strong>{locationDisplayLabel(draft)}</strong>
          </div>
          <p className="location-rule">
            {getLocationKind(draft) === "pick-face"
              ? "One SKU per pick face. Available in capacity checks only."
              : "Available in single-SKU capacity checks and mixed-SKU order planning."}
          </p>
          <DimensionsFields
            value={draft}
            onChange={(key, value) => setDraft({ ...draft, [key]: value })}
          />
          <p className="helper">
            Enter the usable internal dimensions. The pallet base or cage wheels
            are shown below this space and do not reduce capacity.
          </p>
          {error && (
            <p role="alert" className="notice">
              {error}
            </p>
          )}
          <button type="submit" className="button primary">
            {draft.id ? "Save changes" : "Add location"}
          </button>
          {draft.id && (
            <button
              type="button"
              className="button secondary"
              onClick={() => {
                setDraft(blankLocation);
                setDraftPreview(false);
                setError("");
              }}
            >
              Cancel edit
            </button>
          )}
        </form>
        <section className="panel">
          <div className="panel-heading">
            <h3>
              Saved locations <span className="count">{locations.length}</span>
            </h3>
          </div>
          {!locations.length && (
            <p className="helper">
              Choose pick face, pallet or cage, then set your usable dimensions.
            </p>
          )}
          <div className="location-list">
            {locations.map((location) => (
              <div
                key={location.id}
                className={`location-card ${selectedId === location.id ? "selected" : ""}`}
              >
                <button
                  className="location-select"
                  onClick={() => {
                    onSelect(location.id);
                    setDraftPreview(false);
                  }}
                >
                  <strong>{location.name}</strong>
                  <small>
                    {locationDisplayLabel(location)} ·{" "}
                    {dimensionsText(location)}
                  </small>
                </button>
                <div className="row-actions">
                  <button
                    className="icon-button"
                    aria-label={`Edit ${location.name}`}
                    onClick={() => {
                      setDraft(location);
                      setError("");
                      onSelect(location.id);
                    }}
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    className="icon-button danger"
                    aria-label={`Delete ${location.name}`}
                    onClick={() => {
                      const remaining = locations.filter(
                        (item) => item.id !== location.id,
                      );
                      onChange(remaining);
                      if (selectedId === location.id)
                        onSelect(remaining[0]?.id ?? "");
                      if (draft.id === location.id) setDraft(blankLocation);
                    }}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
      <ThreeDViewer
        location={draftPreview ? preview.location : selected}
        result={null}
        previewLabel={
          draftPreview
            ? `${draft.id ? "Editing location" : "New location preview"}${preview.illustrative ? " · example size" : ""}`
            : "Saved location"
        }
      />
    </div>
  );
}
