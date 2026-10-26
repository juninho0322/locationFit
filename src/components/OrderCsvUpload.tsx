import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import { Download, Upload } from "lucide-react";
import type { OrderLine, Sku } from "../types";
import { importOrderCsv, orderCsvTemplate } from "../utils/orderCsv";

export function OrderCsvUpload({
  lines,
  skus,
  onReplace,
}: {
  lines: OrderLine[];
  skus: Sku[];
  onReplace: (lines: OrderLine[]) => void;
}) {
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const fileInput = useRef<HTMLInputElement>(null);
  const currentLines = useRef(lines);
  const replaceLines = useRef(onReplace);
  useLayoutEffect(() => {
    currentLines.current = lines;
    replaceLines.current = onReplace;
  }, [lines, onReplace]);
  const [error, setError] = useState("");
  const [reading, setReading] = useState(false);
  const [lastImport, setLastImport] = useState<{
    before: OrderLine[];
    after: OrderLine[];
    name: string;
  } | null>(null);
  const upload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const before = lines;
    setError("");
    setReading(true);
    try {
      if (file.size > 2 * 1024 * 1024)
        throw new Error("Choose a CSV file smaller than 2 MB.");
      const text = await file.text();
      if (!active.current) return;
      const after = importOrderCsv(text, skus);
      if (currentLines.current !== before)
        throw new Error(
          "Order lines changed while the CSV was loading. Upload the file again.",
        );
      replaceLines.current(after);
      setLastImport({ before, after, name: file.name });
    } catch (error) {
      if (!active.current) return;
      setError(
        error instanceof Error ? error.message : "Unable to read this CSV.",
      );
    } finally {
      if (active.current) setReading(false);
    }
  };
  const template = () => {
    const url = URL.createObjectURL(
      new Blob([orderCsvTemplate(skus[0])], { type: "text/csv;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "order-template.csv";
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <div className="csv-import">
      <div className="csv-actions">
        <input
          ref={fileInput}
          aria-label="Order CSV file"
          className="sr-only"
          type="file"
          accept=".csv,text/csv"
          onChange={upload}
          disabled={reading}
        />
        <button
          className="button secondary small"
          disabled={reading}
          onClick={() => fileInput.current?.click()}
        >
          <Upload size={15} />
          {reading ? "Reading CSV…" : "Upload CSV"}
        </button>
        <button className="button small secondary" onClick={template}>
          <Download size={15} />
          CSV template
        </button>
        <span>SKU, Description, Units, Boxes — fill in units or boxes.</span>
      </div>
      <p className="helper">
        CSV upload replaces the order lines. Dimensions and units per box come
        from SKU setup.
      </p>
      {lastImport && lines === lastImport.after && (
        <p className="import-success" role="status">
          Imported {lastImport.after.length} lines from {lastImport.name}.{" "}
          <button
            onClick={() => {
              onReplace(lastImport.before);
              setLastImport(null);
            }}
          >
            Undo import
          </button>
        </p>
      )}
      {error && (
        <p role="alert" className="notice whitespace-pre-line">
          {error}
        </p>
      )}
    </div>
  );
}
