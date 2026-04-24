export type TableCellModel = {
  row: number;
  col: number;
  text: string;
  fill?: string;
  align?: "left" | "center" | "right" | "justify";
  valign?: "top" | "middle" | "bottom";
  padding?: number;
  merged?: boolean;
};

export type TableModel = {
  role: "table";
  tableId: string;
  version: 1;
  rows: number;
  cols: number;
  rowHeights: number[];
  colWidths: number[];
  cells: TableCellModel[];
  border: {
    color: string;
    width: number;
  };
  minRowHeight: number;
  minColWidth: number;
};

const DEFAULT_CELL_WIDTH = 120;
const DEFAULT_CELL_HEIGHT = 48;
const DEFAULT_MIN_ROW_HEIGHT = 24;
const DEFAULT_MIN_COL_WIDTH = 48;

export function createTableModel(rows: number, cols: number): TableModel {
  const safeRows = Math.max(1, Math.floor(rows));
  const safeCols = Math.max(1, Math.floor(cols));
  const tableId = `tbl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const rowHeights = Array.from({ length: safeRows }, () => DEFAULT_CELL_HEIGHT);
  const colWidths = Array.from({ length: safeCols }, () => DEFAULT_CELL_WIDTH);
  const cells: TableCellModel[] = [];

  for (let row = 0; row < safeRows; row += 1) {
    for (let col = 0; col < safeCols; col += 1) {
      cells.push({
        row,
        col,
        text: "",
        align: "left",
        valign: "top",
        padding: 8,
      });
    }
  }

  return {
    role: "table",
    tableId,
    version: 1,
    rows: safeRows,
    cols: safeCols,
    rowHeights,
    colWidths,
    cells,
    border: {
      color: "#111827",
      width: 1,
    },
    minRowHeight: DEFAULT_MIN_ROW_HEIGHT,
    minColWidth: DEFAULT_MIN_COL_WIDTH,
  };
}
