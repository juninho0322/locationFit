import {
  useMemo,
  useState,
  type ClipboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent,
} from 'react';
import Spreadsheet, {
  type ColumnIndicatorProps,
  type Point,
  type RowIndicatorProps,
  type RowProps,
  type TableProps,
} from 'react-spreadsheet';
import type { SheetData } from '../utils/sheetData';

interface PasteSpreadsheetProps {
  columns: string[];
  data: SheetData;
  onChange: (data: SheetData) => void;
  rows?: number;
}

const normalizeSheetData = (data: SheetData, rows: number, columns: number): SheetData =>
  Array.from({ length: rows }, (_, rowIndex) =>
    Array.from({ length: columns }, (_, columnIndex) => ({
      value: data[rowIndex]?.[columnIndex]?.value ?? '',
    })),
  );

const rowLabels = (rows: number) => Array.from({ length: rows }, (_, index) => String(index + 1));
const defaultColumnWidth = 140;
const minimumColumnWidth = 76;
const rowIndicatorWidth = 52;

export function PasteSpreadsheet({
  columns,
  data,
  onChange,
  rows = 50,
}: PasteSpreadsheetProps) {
  const [activeCell, setActiveCell] = useState<Point>({ row: 0, column: 0 });
  const [columnWidths, setColumnWidths] = useState(() =>
    Array.from({ length: columns.length }, () => defaultColumnWidth),
  );
  const [selectedRows, setSelectedRows] = useState<Set<number>>(() => new Set());
  const [lastSelectedRow, setLastSelectedRow] = useState<number | null>(null);
  const normalizedData = normalizeSheetData(data, rows, columns.length);

  const visibleColumnWidths = useMemo(
    () =>
      Array.from(
        { length: columns.length },
        (_, index) => columnWidths[index] ?? defaultColumnWidth,
      ),
    [columnWidths, columns.length],
  );

  const startResize = (columnIndex: number, startX: number) => {
    const startWidth = visibleColumnWidths[columnIndex] ?? defaultColumnWidth;

    const updateWidth = (clientX: number) => {
      const nextWidth = Math.max(minimumColumnWidth, startWidth + clientX - startX);
      setColumnWidths((current) => {
        const nextWidths = [...current];
        nextWidths[columnIndex] = nextWidth;
        return nextWidths;
      });
    };

    const handlePointerMove = (moveEvent: globalThis.PointerEvent) => {
      updateWidth(moveEvent.clientX);
    };

    const handleMouseMove = (moveEvent: globalThis.MouseEvent) => {
      updateWidth(moveEvent.clientX);
    };

    const stopResize = () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', stopResize);
      window.removeEventListener('pointercancel', stopResize);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', stopResize);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', stopResize);
    window.addEventListener('pointercancel', stopResize);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', stopResize);
  };

  const resizeColumnWithPointer = (
    columnIndex: number,
    event: PointerEvent<HTMLSpanElement>,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    startResize(columnIndex, event.clientX);
  };

  const resizeColumnWithMouse = (columnIndex: number, event: ReactMouseEvent<HTMLSpanElement>) => {
    event.preventDefault();
    event.stopPropagation();
    startResize(columnIndex, event.clientX);
  };

  const selectRow = (row: number, event: ReactMouseEvent) => {
    setSelectedRows((current) => {
      if (event.shiftKey && lastSelectedRow !== null) {
        const start = Math.min(lastSelectedRow, row);
        const end = Math.max(lastSelectedRow, row);
        return new Set(Array.from({ length: end - start + 1 }, (_, index) => start + index));
      }

      if (event.metaKey || event.ctrlKey) {
        const nextRows = new Set(current);
        if (nextRows.has(row)) {
          nextRows.delete(row);
        } else {
          nextRows.add(row);
        }
        return nextRows;
      }

      return new Set([row]);
    });
    setLastSelectedRow(row);
  };

  const ResizableTable = ({ children, columns: columnCount }: TableProps) => (
    <table className="Spreadsheet__table">
      <colgroup>
        <col style={{ width: rowIndicatorWidth }} />
        {Array.from({ length: columnCount }, (_, index) => (
          <col key={index} style={{ width: visibleColumnWidths[index] }} />
        ))}
      </colgroup>
      <tbody>{children}</tbody>
    </table>
  );

  const ResizableColumnIndicator = ({
    column,
    label,
    onSelect,
    selected,
  }: ColumnIndicatorProps) => (
    <th
      className={`Spreadsheet__header ${
        selected ? 'Spreadsheet__header--selected' : ''
      }`}
      onClick={(event) => onSelect(column, event.shiftKey)}
      tabIndex={0}
    >
      <span className="Spreadsheet__header-label">{label}</span>
      <span
        aria-label={`Resize ${label || `column ${column + 1}`}`}
        className="Spreadsheet__resize-handle"
        role="separator"
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
        onMouseDown={(event) => resizeColumnWithMouse(column, event)}
        onPointerDown={(event) => resizeColumnWithPointer(column, event)}
      />
    </th>
  );

  const SelectableRowIndicator = ({
    label,
    onSelect,
    row,
    selected,
  }: RowIndicatorProps) => (
    <th
      aria-label={`Select row ${label ?? row + 1}`}
      className={`Spreadsheet__header Spreadsheet__row-indicator ${
        selected || selectedRows.has(row) ? 'Spreadsheet__header--selected' : ''
      }`}
      onClick={(event) => {
        onSelect(row, event.shiftKey);
        selectRow(row, event);
      }}
      tabIndex={0}
    >
      {label}
    </th>
  );

  const SelectableRow = ({ children, row }: RowProps) => (
    <tr
      className={selectedRows.has(row) ? 'Spreadsheet__row--selected' : ''}
      onClick={(event) => selectRow(row, event)}
    >
      {children}
    </tr>
  );

  const pasteExcelData = (event: ClipboardEvent<HTMLDivElement>) => {
    const pastedText = event.clipboardData.getData('text/plain');
    if (!pastedText.trim()) {
      return;
    }

    const pastedRows = pastedText
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .split('\n')
      .filter((row) => row.length > 0)
      .map((row) => row.split('\t'));

    if (pastedRows.length === 0) {
      return;
    }

    event.preventDefault();

    const nextData = normalizeSheetData(normalizedData, rows, columns.length);
    pastedRows.forEach((pastedRow, rowOffset) => {
      pastedRow.forEach((value, columnOffset) => {
        const rowIndex = activeCell.row + rowOffset;
        const columnIndex = activeCell.column + columnOffset;

        if (rowIndex < rows && columnIndex < columns.length) {
          nextData[rowIndex][columnIndex] = { value };
        }
      });
    });

    onChange(nextData);
  };

  return (
    <div
      className="warehouse-spreadsheet overflow-auto rounded-lg border border-slate-800 bg-slate-950"
      onPaste={pasteExcelData}
    >
      <Spreadsheet
        columnLabels={columns}
        data={normalizedData}
        darkMode
        rowLabels={rowLabels(rows)}
        ColumnIndicator={ResizableColumnIndicator}
        Row={SelectableRow}
        RowIndicator={SelectableRowIndicator}
        Table={ResizableTable}
        onActivate={setActiveCell}
        onChange={(nextData) => onChange(normalizeSheetData(nextData, rows, columns.length))}
      />
    </div>
  );
}
