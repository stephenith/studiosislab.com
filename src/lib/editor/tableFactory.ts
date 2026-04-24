import { Group, Rect, Textbox } from "fabric";
import type { TableModel } from "@/lib/editor/tableModel";

const CELL_TEXT_PADDING_X = 8;
const CELL_TEXT_PADDING_Y = 6;

function getCellLeft(model: TableModel, row: number, col: number) {
  let left = 0;
  for (let i = 0; i < col; i += 1) left += model.colWidths[i] ?? 0;
  return left;
}

function getCellTop(model: TableModel, row: number) {
  let top = 0;
  for (let i = 0; i < row; i += 1) top += model.rowHeights[i] ?? 0;
  return top;
}

export function renderTableFromModel(model: TableModel): Group {
  const children: any[] = [];

  for (let row = 0; row < model.rows; row += 1) {
    for (let col = 0; col < model.cols; col += 1) {
      const cellLeft = getCellLeft(model, row, col);
      const cellTop = getCellTop(model, row);
      const cellWidth = model.colWidths[col] ?? 0;
      const cellHeight = model.rowHeights[row] ?? 0;
      const cellModel = model.cells.find((cell) => cell.row === row && cell.col === col);

      const rect = new Rect({
        left: cellLeft,
        top: cellTop,
        width: cellWidth,
        height: cellHeight,
        fill: cellModel?.fill ?? "#ffffff",
        stroke: model.border.color,
        strokeWidth: model.border.width,
        strokeUniform: true,
        selectable: false,
        evented: false,
      }) as any;
      rect.data = {
        role: "table-cell-rect",
        tableId: model.tableId,
        row,
        col,
      };

      const text = new Textbox(cellModel?.text ?? "", {
        left: cellLeft + CELL_TEXT_PADDING_X,
        top: cellTop + CELL_TEXT_PADDING_Y,
        width: Math.max(8, cellWidth - CELL_TEXT_PADDING_X * 2),
        height: Math.max(8, cellHeight - CELL_TEXT_PADDING_Y * 2),
        fontSize: 16,
        lineHeight: 1.2,
        fill: "#111827",
        editable: true,
        evented: true,
        selectable: true,
        lockMovementX: true,
        lockMovementY: true,
        lockRotation: true,
        lockScalingX: true,
        lockScalingY: true,
      }) as any;
      text.data = {
        role: "table-cell-text",
        tableId: model.tableId,
        row,
        col,
      };

      children.push(rect, text);
    }
  }

  const tableGroup = new Group(children, {
    left: 0,
    top: 0,
    selectable: true,
    evented: true,
    subTargetCheck: true,
    objectCaching: true,
  }) as any;

  tableGroup.data = {
    ...model,
    role: "table",
    tableId: model.tableId,
  };

  return tableGroup;
}
