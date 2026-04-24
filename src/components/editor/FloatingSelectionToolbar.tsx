"use client";

import { Copy, Trash2, MoreHorizontal } from "lucide-react";

const TOOLBAR_OFFSET_TOP = 50;

export interface FloatingSelectionToolbarProps {
  visible: boolean;
  position: { top: number; left: number } | null;
  isMultipleSelection?: boolean;
  canUngroupSelection?: boolean;
  canGroup?: boolean;
  canUngroup?: boolean;
  canDelete?: boolean;
  onGroup: () => void;
  onUngroup?: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onMore: () => void;
}

export function FloatingSelectionToolbar({
  visible,
  position,
  isMultipleSelection = false,
  canUngroupSelection = false,
  canGroup = false,
  canUngroup = false,
  canDelete = true,
  onGroup,
  onUngroup,
  onDuplicate,
  onDelete,
  onMore,
}: FloatingSelectionToolbarProps) {
  if (!visible || !position) return null;
  const showGroup = canGroup || isMultipleSelection;
  const showUngroup = canUngroup || canUngroupSelection;

  return (
    <div
      className="absolute z-50 flex items-center gap-0.5 rounded-xl bg-white px-1 py-1.5 shadow-[0_10px_25px_rgba(0,0,0,0.12)]"
      style={{
        top: position.top - TOOLBAR_OFFSET_TOP,
        left: position.left,
        transform: "translateX(-50%)",
      }}
    >
      {showGroup && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onGroup();
          }}
          className="rounded px-3 py-1 text-sm font-medium text-zinc-700 hover:bg-gray-100"
          title="Group"
        >
          Group
        </button>
      )}
      {showUngroup && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onUngroup?.();
          }}
          className="rounded px-3 py-1 text-sm font-medium text-zinc-700 hover:bg-gray-100"
          title="Ungroup"
        >
          Ungroup
        </button>
      )}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onDuplicate(); }}
        className="rounded-lg p-2 text-zinc-600 hover:bg-zinc-100"
        title="Duplicate"
      >
        <Copy size={18} />
      </button>
      {canDelete && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="rounded-lg p-2 text-zinc-600 hover:bg-zinc-100"
          title="Delete"
        >
          <Trash2 size={18} />
        </button>
      )}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onMore(); }}
        className="rounded-lg p-2 text-zinc-600 hover:bg-zinc-100"
        title="More options"
      >
        <MoreHorizontal size={18} />
      </button>
    </div>
  );
}
