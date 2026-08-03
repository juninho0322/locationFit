import type { CellBase, Matrix } from 'react-spreadsheet';

export type SheetCell = CellBase<string>;
export type SheetData = Matrix<SheetCell>;

const makeEmptyCell = (): SheetCell => ({ value: '' });

export const createSheetData = (rows: number, columns: number): SheetData =>
  Array.from({ length: rows }, () =>
    Array.from({ length: columns }, () => makeEmptyCell()),
  );
