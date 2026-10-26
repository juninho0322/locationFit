import type { Location, LocationKind, PalletFormat } from "../types";

export const locationKindLabels: Record<LocationKind, string> = {
  "pick-face": "Pick face",
  pallet: "Pallet",
  cage: "Cage",
};

/** Resolve old saved records conservatively; unclassified volumes never enter mixed-order packing. */
export function getLocationKind(location: Location): LocationKind {
  if (
    location.kind === "pick-face" ||
    location.kind === "pallet" ||
    location.kind === "cage"
  )
    return location.kind;
  const type = (location.type ?? "").toLowerCase().replace(/[^a-z]/g, "");
  if (type.includes("pickface") || type === "shelf" || type === "tote")
    return "pick-face";
  if (type.includes("cage")) return "cage";
  if (type.includes("pallet")) return "pallet";
  if (!type && /pick[ -]?face|shelf|tote/.test(location.name.toLowerCase()))
    return "pick-face";
  if (location.countAs === "pallet" || location.countAs === "cage")
    return location.countAs;
  // Earlier versions stored only a name and dimensions.
  if (!type) {
    const name = location.name.toLowerCase();
    if (/pick[ -]?face|shelf|tote/.test(name)) return "pick-face";
    if (/\bcage\b/.test(name)) return "cage";
    if (/\bpallet\b/.test(name)) return "pallet";
  }
  return "pick-face";
}

export const canPlanOrders = (location: Location) =>
  getLocationKind(location) !== "pick-face";
export const locationTypeLabel = (location: Location) =>
  locationKindLabels[getLocationKind(location)];
export const locationNoun = (location: Location | null) =>
  location ? locationTypeLabel(location).toLowerCase() : "location";

export function setLocationKind(
  location: Location,
  kind: LocationKind,
): Location {
  return {
    ...location,
    kind,
    type: locationKindLabels[kind],
    countAs: kind === "pick-face" ? "location" : kind,
  };
}

export function defaultOrderLocationId(
  locations: Location[],
  preferredId: string,
) {
  return (
    locations.find(
      (location) => location.id === preferredId && canPlanOrders(location),
    )?.id ??
    locations.find(canPlanOrders)?.id ??
    ""
  );
}

export function getPalletFormat(location: Location): PalletFormat {
  if (location.palletFormat === "custom") return "custom";
  const sides = [location.width, location.depth].sort((a, b) => b - a);
  if (sides[0] === 120 && sides[1] === 100) return "uk";
  if (sides[0] === 120 && sides[1] === 80) return "euro";
  return "custom";
}

export function locationDisplayLabel(location: Location) {
  if (getLocationKind(location) !== "pallet")
    return locationTypeLabel(location);
  return { uk: "UK pallet", euro: "Euro pallet", custom: "Custom pallet" }[
    getPalletFormat(location)
  ];
}

export function setPalletFormat(
  location: Location,
  format: PalletFormat,
): Location {
  return {
    ...setLocationKind(location, "pallet"),
    palletFormat: format,
    ...(["UK pallet", "Euro pallet", "Custom pallet"].includes(location.name)
      ? {
          name: {
            uk: "UK pallet",
            euro: "Euro pallet",
            custom: "Custom pallet",
          }[format],
        }
      : {}),
    ...(format === "custom"
      ? {}
      : { width: 120, depth: format === "uk" ? 100 : 80 }),
  };
}

export function locationDraftPreview(draft: Location) {
  const kind = getLocationKind(draft);
  const defaults =
    kind === "pick-face"
      ? [60, 40, 40]
      : kind === "pallet"
        ? [120, 100, 150]
        : [80, 70, 160];
  const valid = (value: number) => Number.isFinite(value) && value > 0;
  const illustrative = ![draft.width, draft.depth, draft.height].every(valid);
  return {
    illustrative,
    location: {
      ...draft,
      id: draft.id || "draft-preview",
      name:
        draft.name.trim() || `New ${locationDisplayLabel(draft).toLowerCase()}`,
      palletFormat:
        kind === "pallet" ? getPalletFormat(draft) : draft.palletFormat,
      width: valid(draft.width) ? draft.width : defaults[0],
      depth: valid(draft.depth) ? draft.depth : defaults[1],
      height: valid(draft.height) ? draft.height : defaults[2],
    },
  };
}
