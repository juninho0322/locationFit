import type { Location, Order, Sku } from "../types";
import type { PalletEstimateResult } from "../types/packing";
import { packingMethods } from "./packingMethods";

type RecordValue = Record<string, unknown>;
const record = (value: unknown): value is RecordValue =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const strings = (value: RecordValue, keys: string[]) =>
  keys.every((key) => typeof value[key] === "string");
const numbers = (value: RecordValue, keys: string[]) =>
  keys.every(
    (key) => typeof value[key] === "number" && Number.isFinite(value[key]),
  );
const optionalString = (value: RecordValue, key: string) =>
  value[key] === undefined || typeof value[key] === "string";
const optionalChoice = (value: unknown, choices: string[]) =>
  value === undefined || choices.includes(value as string);
const arrayOf = (value: unknown, validate: (item: unknown) => boolean) =>
  Array.isArray(value) && value.every(validate);
const dimensions = (value: RecordValue) =>
  numbers(value, ["width", "depth", "height"]);
const kind = (value: unknown) =>
  optionalChoice(value, ["pick-face", "pallet", "cage"]);
const uniqueRecords = (value: unknown, validate: (item: unknown) => boolean) =>
  arrayOf(value, validate) &&
  new Set((value as Array<{ id: string }>).map((item) => item.id)).size ===
    (value as unknown[]).length;

const location = (value: unknown) =>
  record(value) &&
  strings(value, ["id", "name"]) &&
  dimensions(value) &&
  kind(value.kind) &&
  optionalString(value, "type") &&
  optionalChoice(value.countAs, ["location", "pallet", "cage"]) &&
  optionalChoice(value.palletFormat, ["uk", "euro", "custom"]);
const sku = (value: unknown) =>
  record(value) &&
  strings(value, ["id", "code", "description"]) &&
  dimensions(value) &&
  numbers(value, ["unitsPerCase"]);
const line = (value: unknown) =>
  record(value) &&
  strings(value, ["id", "skuId"]) &&
  optionalString(value, "description") &&
  numbers(value, ["quantity"]) &&
  (value.mode === "cases" || value.mode === "units");

const estimateSku = (value: unknown) =>
  record(value) &&
  strings(value, ["sku", "packSku"]) &&
  dimensions(value) &&
  numbers(value, [
    "orderQuantity",
    "ratio",
    "boxVolume",
    "exactBoxes",
    "fullBoxes",
    "partialBoxes",
    "boxesRequired",
    "totalVolume",
  ]) &&
  typeof value.hasPartialBox === "boolean";
const packedBox = (value: unknown) =>
  record(value) &&
  strings(value, ["id", "sku"]) &&
  dimensions(value) &&
  numbers(value, ["x", "y", "z", "volume"]) &&
  typeof value.isPartial === "boolean";
const packedLine = (value: unknown) =>
  record(value) &&
  strings(value, ["sku"]) &&
  dimensions(value) &&
  numbers(value, ["boxVolume", "boxes", "partialBoxes", "volume"]);
const packedPallet = (value: unknown) =>
  record(value) &&
  strings(value, ["id"]) &&
  numbers(value, ["index", "usedVolume", "remainingVolume"]) &&
  arrayOf(value.boxes, packedBox) &&
  arrayOf(value.lines, packedLine);

export function isPalletEstimate(
  value: unknown,
): value is PalletEstimateResult {
  if (!record(value) || !record(value.palletType)) return false;
  const type = value.palletType;
  return (
    typeof value.packingMethod === "string" &&
    value.packingMethod !== "auto" &&
    Object.prototype.hasOwnProperty.call(packingMethods, value.packingMethod) &&
    strings(type, ["id", "name"]) &&
    dimensions(type) &&
    kind(type.locationKind) &&
    optionalString(type, "displayLabel") &&
    numbers(value, [
      "palletVolume",
      "totalOrderQuantity",
      "totalBoxes",
      "totalVolume",
      "utilization",
    ]) &&
    arrayOf(value.pallets, packedPallet) &&
    [value.skus, value.oversizedSkus, value.partialBoxSkus].every((items) =>
      arrayOf(items, estimateSku),
    ) &&
    arrayOf(
      value.missingPackConfigs,
      (item) =>
        record(item) &&
        strings(item, ["sku"]) &&
        numbers(item, ["orderQuantity"]),
    ) &&
    arrayOf(
      value.invalidPackConfigs,
      (item) => record(item) && strings(item, ["sku", "packSku", "reason"]),
    )
  );
}

const order = (value: unknown) =>
  record(value) &&
  strings(value, ["id", "name", "locationId"]) &&
  uniqueRecords(value.lines, line) &&
  optionalString(value, "createdAt") &&
  optionalString(value, "updatedAt") &&
  optionalChoice(value.packingMode, Object.keys(packingMethods)) &&
  (value.savedPlan === undefined ||
    (record(value.savedPlan) &&
      strings(value.savedPlan, ["signature", "calculatedAt"]) &&
      isPalletEstimate(value.savedPlan.result)));

// Shape validation accepts unfinished order inputs. Business validation happens before calculating.
export const isLocations = (value: unknown): value is Location[] =>
  uniqueRecords(value, location);
export const isSkus = (value: unknown): value is Sku[] =>
  uniqueRecords(value, sku);
export const isOrders = (value: unknown): value is Order[] =>
  uniqueRecords(value, order);
