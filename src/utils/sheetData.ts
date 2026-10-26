// Legacy spreadsheet cells remain supported for migration and the packing adapter.
// This data contract does not depend on the removed spreadsheet UI package.
export type SheetData = Array<Array<{ value: string } | undefined>>;
