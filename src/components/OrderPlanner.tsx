import { useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  LoaderCircle,
  Plus,
  Trash2,
} from "lucide-react";
import type { Location, Order, Sku } from "../types";
import { createLocationPalletType } from "../utils/palletEstimator";
import { canPlanOrders, locationTypeLabel } from "../utils/locations";
import { locationNoun, numberText, summarizeOrder } from "../utils/planning";
import { Empty, Field, LocationChoice, Metric } from "./PlannerFields";
import { PalletEstimateViewer } from "./PalletEstimateViewer";
import { OrderCsvUpload } from "./OrderCsvUpload";
import { SavedOrders } from "./SavedOrders";
import { useOrderCalculation } from "../hooks/useOrderCalculation";

import { packingMethods, resolvePackingMode } from "../utils/packingMethods";

export function OrderPlanner({
  order,
  orders,
  skus,
  locations,
  onChange,
  onPlanReady,
  onSelect,
  onNew,
  onDelete,
}: {
  order: Order | undefined;
  orders: Order[];
  skus: Sku[];
  locations: Location[];
  onChange: (order: Order) => void;
  onPlanReady: (source: Order, plan: NonNullable<Order["savedPlan"]>) => void;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: () => void;
}) {
  const [exporting, setExporting] = useState(false);
  const packingMode = resolvePackingMode(order?.packingMode);
  const [error, setError] = useState("");
  const [view, setView] = useState<"all" | "single">("single");
  const [index, setIndex] = useState(0);
  const savedLocation =
    locations.find((item) => item.id === order?.locationId) ?? null;
  const location =
    savedLocation && canPlanOrders(savedLocation) ? savedLocation : null;
  const {
    plan,
    busy,
    error: calculationError,
    calculate,
    cancel,
  } = useOrderCalculation(order, skus, location, onPlanReady);
  const containerLabel = location ? locationTypeLabel(location) : "Pallet";
  const noun = locationNoun(location);
  const summary = useMemo(
    () =>
      order
        ? summarizeOrder(order, skus)
        : { rows: [], errors: [], units: 0, cases: 0 },
    [order, skus],
  );
  const selectedIndex = Math.min(
    index,
    Math.max(0, (plan?.pallets.length ?? 0) - 1),
  );
  const exportPlan = async () => {
    if (!plan || !order) return;
    setExporting(true);
    setError("");
    try {
      const { createOrderPlanPdf, orderPlanFilename } = await import(
        "../utils/orderPlanPdf"
      );
      createOrderPlanPdf(plan, order, skus).save(orderPlanFilename(order));
    } catch {
      setError("Unable to download the PDF. Please try again.");
    } finally {
      setExporting(false);
    }
  };
  if (!order)
    return (
      <section className="panel">
        <Empty title="Enter an order">
          Add SKUs manually or upload a CSV, then calculate the pallets and
          stacking layout.
        </Empty>
        <button className="button primary" onClick={onNew}>
          <Plus size={16} />
          New order
        </button>
      </section>
    );
  return (
    <div className="space-y-5">
      <SavedOrders
        orders={orders}
        selectedId={order.id}
        locations={locations}
        onSelect={onSelect}
      />
      <section className="panel">
        <div className="simple-order-heading">
          <Field label="Order number">
            <input
              value={order.name}
              placeholder="e.g. 1001"
              onChange={(event) =>
                onChange({ ...order, name: event.target.value })
              }
            />
          </Field>
          <LocationChoice
            usage="order"
            locations={locations}
            value={order.locationId}
            onChange={(locationId) => onChange({ ...order, locationId })}
          />
          <button className="button secondary" onClick={onNew}>
            <Plus size={16} />
            New order
          </button>
          <button
            className="icon-button danger"
            aria-label="Delete current order"
            onClick={onDelete}
          >
            <Trash2 size={17} />
          </button>
        </div>
        <OrderCsvUpload
          key={order.id}
          lines={order.lines}
          skus={skus}
          onReplace={(lines) => onChange({ ...order, lines })}
        />
        <div className="panel-heading spread">
          <h3>
            Order lines <span className="count">{order.lines.length}</span>
          </h3>
          <button
            className="button small secondary"
            disabled={!skus.length}
            onClick={() =>
              onChange({
                ...order,
                lines: [
                  ...order.lines,
                  {
                    id: crypto.randomUUID(),
                    skuId: skus[0].id,
                    quantity: 1,
                    mode: "cases",
                  },
                ],
              })
            }
          >
            <Plus size={16} />
            Add line
          </button>
        </div>
        {!order.lines.length ? (
          <Empty
            title={
              skus.length ? "Add your order lines" : "Set up your SKUs first"
            }
          >
            {skus.length
              ? "Select a SKU and enter units or full boxes, or upload your CSV."
              : "Save each SKU’s dimensions and units per box in SKU setup. Then enter or upload the order here."}
          </Empty>
        ) : (
          <div className="table-scroll">
            <table className="data-table order-table simple-order-table">
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Description</th>
                  <th>Quantity needed</th>
                  <th>Units or boxes</th>
                  <th>
                    <span className="sr-only">Remove</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {order.lines.map((line, rowIndex) => {
                  const sku = skus.find((item) => item.id === line.skuId);
                  const update = (patch: Partial<typeof line>) =>
                    onChange({
                      ...order,
                      lines: order.lines.map((item) =>
                        item.id === line.id ? { ...item, ...patch } : item,
                      ),
                    });
                  return (
                    <tr key={line.id}>
                      <td>
                        <select
                          aria-label={`SKU for line ${rowIndex + 1}`}
                          value={line.skuId}
                          onChange={(event) =>
                            update({
                              skuId: event.target.value,
                              description: undefined,
                            })
                          }
                        >
                          {!sku && (
                            <option value={line.skuId}>
                              Missing SKU: {line.skuId.replace(/^missing:/, "")}
                            </option>
                          )}
                          {skus.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.code}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <input
                          aria-label={`Description for line ${rowIndex + 1}`}
                          value={line.description ?? sku?.description ?? ""}
                          placeholder="Product description"
                          onChange={(event) =>
                            update({ description: event.target.value })
                          }
                        />
                      </td>
                      <td>
                        <input
                          aria-label={`Quantity for line ${rowIndex + 1}`}
                          type="number"
                          min="1"
                          step="1"
                          value={line.quantity || ""}
                          onChange={(event) =>
                            update({ quantity: Number(event.target.value) })
                          }
                        />
                      </td>
                      <td>
                        <select
                          aria-label={`Quantity type for line ${rowIndex + 1}`}
                          value={line.mode}
                          onChange={(event) =>
                            update({
                              mode: event.target.value as "cases" | "units",
                            })
                          }
                        >
                          <option value="cases">Full boxes</option>
                          <option value="units">Units</option>
                        </select>
                      </td>
                      <td>
                        <button
                          className="icon-button danger"
                          aria-label={`Remove line ${rowIndex + 1}`}
                          onClick={() =>
                            onChange({
                              ...order,
                              lines: order.lines.filter(
                                (item) => item.id !== line.id,
                              ),
                            })
                          }
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {order.savedPlan && !plan && !busy && (
          <p className="helper">
            This order or its setup has changed since the last calculation.
            Recalculate to update the saved layout.
          </p>
        )}
        <div className="stacking-settings">
          <label className="stacking-method-label" htmlFor="stacking-method">
            Stacking method
          </label>
          <select
            id="stacking-method"
            value={packingMode}
            aria-describedby="stacking-method-help"
            onChange={(event) =>
              onChange({
                ...order,
                packingMode: resolvePackingMode(event.target.value),
              })
            }
          >
            {Object.entries(packingMethods).map(([value, method]) => (
              <option key={value} value={value}>
                {method.label}
              </option>
            ))}
          </select>
          <p id="stacking-method-help" className="helper">
            {packingMethods[packingMode].description}
          </p>
        </div>
        <div className="calculate-order-bar">
          <div>
            <strong>
              {numberText(summary.units)} units · {numberText(summary.cases)}{" "}
              boxes to pack
            </strong>
            <p className="helper">
              Partial boxes use a full box footprint. Your selected stacking
              method is saved with this order.
            </p>
          </div>
          <button
            className="button primary"
            disabled={
              busy ||
              !location ||
              !order.lines.length ||
              !!summary.errors.length
            }
            onClick={() => {
              setIndex(0);
              setError("");
              calculate();
            }}
          >
            {busy ? (
              <>
                <LoaderCircle className="animate-spin" size={17} />
                Calculating layout…
              </>
            ) : (
              `Calculate ${noun}s & stacking`
            )}
          </button>
          {busy && (
            <button className="button secondary" onClick={cancel}>
              Cancel
            </button>
          )}
        </div>
        {!location && (
          <p className="helper">
            {savedLocation && !canPlanOrders(savedLocation)
              ? "This order references a pick face. Pick faces are single-SKU only; select a pallet or cage to calculate the order."
              : "Select a saved pallet or cage above before calculating. Add one in Location setup if none are available."}
          </p>
        )}
        {[...summary.errors, calculationError, error]
          .filter(Boolean)
          .map((message) => (
            <p role="alert" className="notice" key={message}>
              {message}
            </p>
          ))}
      </section>
      {plan && (
        <>
          <div className="order-result-metrics">
            <Metric
              accent
              label={`${containerLabel}s ${plan.oversizedSkus.length ? "for fitting SKUs" : "needed"}`}
              value={plan.pallets.length}
            />
            <Metric label="Boxes to pack" value={numberText(summary.cases)} />
            <Metric label="Units ordered" value={numberText(summary.units)} />
            <Metric label="Space used" value={`${plan.utilization}%`} />
          </div>
          {!!plan.oversizedSkus.length && (
            <div role="alert" className="notice">
              <strong>Order does not fully fit.</strong>
              <p>
                {plan.oversizedSkus.map((sku) => sku.sku).join(", ")} cannot fit
                this volume in any orientation. The plan includes only the other
                SKUs. Select a larger pallet or cage for the complete order.
              </p>
            </div>
          )}
          <div className="stacking-toolbar">
            <div>
              <strong>{packingMethods[plan.packingMethod].label}</strong>
              <p>
                {packingMode === "auto"
                  ? "Best result of three methods"
                  : "Selected method"}{" "}
                · Estimated layout
              </p>
            </div>
            <div className="segmented">
              <button
                className={view === "single" ? "active" : ""}
                onClick={() => setView("single")}
              >
                Individual
              </button>
              <button
                className={view === "all" ? "active" : ""}
                onClick={() => setView("all")}
              >
                Show all
              </button>
            </div>
            <div className="plan-pagination">
              <button
                className="icon-button"
                aria-label={`Previous ${noun}`}
                disabled={!selectedIndex}
                onClick={() => {
                  setIndex(selectedIndex - 1);
                  setView("single");
                }}
              >
                <ChevronLeft size={18} />
              </button>
              <span>
                {plan.pallets.length
                  ? `${containerLabel} ${selectedIndex + 1} of ${plan.pallets.length}`
                  : "No boxes fit"}
              </span>
              <button
                className="icon-button"
                aria-label={`Next ${noun}`}
                disabled={selectedIndex >= plan.pallets.length - 1}
                onClick={() => {
                  setIndex(selectedIndex + 1);
                  setView("single");
                }}
              >
                <ChevronRight size={18} />
              </button>
            </div>
            <button
              className="button secondary small"
              disabled={exporting}
              onClick={exportPlan}
            >
              {exporting ? "Preparing PDF…" : "Download plan (PDF)"}
            </button>
          </div>
        </>
      )}
      <PalletEstimateViewer
        key={plan ? "result" : "empty"}
        mode={view}
        pallets={plan?.pallets ?? []}
        palletType={
          location
            ? createLocationPalletType(location)
            : {
                id: "empty",
                name: "Select a pallet or cage",
                width: 120,
                depth: 100,
                height: 150,
              }
        }
        selectedPalletIndex={selectedIndex}
        volumeUnit="m3"
        locationLabel={containerLabel}
      />
    </div>
  );
}
