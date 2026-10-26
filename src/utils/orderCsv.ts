import type { OrderLine, Sku } from "../types";
import { validSku } from "./planning";

// RFC-style quoted fields, escaped quotes, CRLF and multiline descriptions.
export function parseCsv(source: string): string[][] {
  const text = source.replace(/^\uFEFF/, "");
  const firstLine = text.split(/\r?\n/, 1)[0];
  const outsideQuotes = firstLine.replace(/"(?:[^"]|"")*"/g, "");
  const delimiter =
    (outsideQuotes.match(/;/g)?.length ?? 0) >
    (outsideQuotes.match(/,/g)?.length ?? 0)
      ? ";"
      : ",";
  const rows: string[][] = [];
  let row: string[] = [],
    field = "",
    quoted = false,
    closed = false;
  const finishField = () => {
    row.push(field.trim());
    field = "";
    closed = false;
  };
  const finishRow = () => {
    finishField();
    if (row.some(Boolean)) rows.push(row);
    row = [];
  };
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
          closed = true;
        }
      } else field += char;
    } else if (char === delimiter) finishField();
    else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i++;
      finishRow();
    } else if (char === '"') {
      if (field.trim() || closed)
        throw new Error(
          "Invalid CSV quoting. Put quotes around the complete field.",
        );
      field = "";
      quoted = true;
    } else if (closed && char.trim())
      throw new Error("Unexpected text after a quoted CSV field.");
    else if (!closed) field += char;
  }
  if (quoted) throw new Error("The CSV has an unclosed quoted field.");
  if (field || row.length || closed) finishRow();
  return rows;
}

const headerKey = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]/g, "");
const aliases: Record<string, string> = {
  skucode: "sku",
  code: "sku",
  desc: "description",
  descrip: "description",
  qty: "quantity",
  quantityneeded: "quantity",
  unitsneeded: "units",
  unit: "units",
  boxesneeded: "boxes",
  fullboxes: "boxes",
  cases: "boxes",
  fullcases: "boxes",
  box: "boxes",
  orderedas: "type",
  quantitytype: "type",
  uom: "type",
};
const normalizedHeader = (value: string) =>
  aliases[headerKey(value)] ?? headerKey(value);
const quantity = (value: string, row: number) => {
  if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)))
    throw new Error(
      `CSV row ${row}: quantities must be whole numbers, with no separators.`,
    );
  return Number(value);
};

export function importOrderCsv(source: string, skus: Sku[]): OrderLine[] {
  const [rawHeaders, ...rows] = parseCsv(source);
  if (!rawHeaders || !rows.length)
    throw new Error("The CSV needs a header and at least one order row.");
  if (rows.length > 5000) throw new Error("Import up to 5,000 rows at a time.");
  const headers = rawHeaders.map(normalizedHeader);
  if (new Set(headers).size !== headers.length)
    throw new Error("The CSV has duplicate column headers.");
  if (!headers.includes("sku")) throw new Error("The CSV needs a SKU column.");
  const columns = headers.includes("units") || headers.includes("boxes");
  if (!columns && !(headers.includes("quantity") && headers.includes("type")))
    throw new Error(
      "Add Units and/or Boxes columns, or Quantity and Type (units or boxes).",
    );
  if (columns && (headers.includes("quantity") || headers.includes("type")))
    throw new Error(
      "Use either Units/Boxes columns or Quantity/Type columns, not both.",
    );
  const lookup = new Map(
    skus.map((sku) => [sku.code.trim().toUpperCase(), sku]),
  );
  const lines: OrderLine[] = [];
  const errors: string[] = [];
  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    try {
      if (row.length !== headers.length)
        throw new Error(
          `CSV row ${rowNumber}: expected ${headers.length} fields, found ${row.length}.`,
        );
      const cell = (key: string) => row[headers.indexOf(key)] ?? "";
      const code = cell("sku");
      if (!code) throw new Error(`CSV row ${rowNumber}: SKU is missing.`);
      const sku = lookup.get(code.toUpperCase());
      if (!sku || !validSku(sku))
        throw new Error(
          `CSV row ${rowNumber}: ${code} needs valid dimensions and units per case in SKU setup before importing.`,
        );
      const description = cell("description") || sku.description;
      const add = (count: number, mode: "units" | "cases") => {
        if (count > 0)
          lines.push({
            id: crypto.randomUUID(),
            skuId: sku.id,
            description,
            quantity: count,
            mode,
          });
      };
      if (columns) {
        const units = cell("units") ? quantity(cell("units"), rowNumber) : 0;
        const boxes = cell("boxes") ? quantity(cell("boxes"), rowNumber) : 0;
        if (!units && !boxes)
          throw new Error(
            `CSV row ${rowNumber}: enter units or boxes greater than zero.`,
          );
        add(units, "units");
        add(boxes, "cases");
      } else {
        const count = quantity(cell("quantity"), rowNumber);
        const type = headerKey(cell("type"));
        if (!count)
          throw new Error(
            `CSV row ${rowNumber}: quantity must be greater than zero.`,
          );
        if (["unit", "units", "singleunits"].includes(type))
          add(count, "units");
        else if (
          ["box", "boxes", "case", "cases", "fullboxes", "fullcases"].includes(
            type,
          )
        )
          add(count, "cases");
        else
          throw new Error(`CSV row ${rowNumber}: Type must be units or boxes.`);
      }
    } catch (error) {
      errors.push(
        error instanceof Error
          ? error.message
          : `CSV row ${rowNumber} is invalid.`,
      );
    }
  });
  // An invalid file never partially replaces the current order.
  if (errors.length)
    throw new Error(
      errors.slice(0, 12).join("\n") +
        (errors.length > 12
          ? `\n… and ${errors.length - 12} more row errors.`
          : ""),
    );
  return lines;
}

export function orderCsvTemplate(sku?: Sku) {
  const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;
  return (
    "SKU,Description,Units,Boxes\r\n" +
    `${escape(sku?.code ?? "SKU-001")},${escape(sku?.description ?? "Product description")},,2\r\n`
  );
}
