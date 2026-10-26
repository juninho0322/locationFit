import type { ReactNode } from "react";
import type { Location } from "../types";
import { canPlanOrders, locationDisplayLabel } from "../utils/locations";
import { dimensionsText } from "../utils/planning";

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
export function DimensionsFields({
  value,
  onChange,
}: {
  value: { width: number; depth: number; height: number };
  onChange: (key: "width" | "depth" | "height", value: number) => void;
}) {
  return (
    <div className="dimension-fields">
      {(["width", "depth", "height"] as const).map((key) => (
        <Field key={key} label={`${key[0].toUpperCase() + key.slice(1)} (cm)`}>
          <input
            type="number"
            min="0.01"
            step="any"
            required
            value={value[key] || ""}
            onChange={(event) => onChange(key, Number(event.target.value))}
          />
        </Field>
      ))}
    </div>
  );
}
export function LocationChoice({
  usage = "capacity",
  locations,
  value,
  onChange,
}: {
  usage?: "capacity" | "order";
  locations: Location[];
  value: string;
  onChange: (id: string) => void;
}) {
  const available =
    usage === "order" ? locations.filter(canPlanOrders) : locations;
  return (
    <Field label={usage === "order" ? "Pallet or cage" : "Location"}>
      <select
        value={available.some((location) => location.id === value) ? value : ""}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">
          {usage === "order"
            ? "Select a pallet or cage…"
            : "Select a location…"}
        </option>
        {available.map((location) => (
          <option key={location.id} value={location.id}>
            {location.name} · {locationDisplayLabel(location)} ·{" "}
            {dimensionsText(location)}
          </option>
        ))}
      </select>
    </Field>
  );
}
export function Metric({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string | number;
  accent?: boolean;
}) {
  return (
    <div className={`metric ${accent ? "metric-accent" : ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
export function Empty({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="empty-state">
      <strong>{title}</strong>
      <p>{children}</p>
    </div>
  );
}
