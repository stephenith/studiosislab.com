export type ShapeKind =
  | "rect"
  | "circle"
  | "triangle"
  | "line"
  | "polygon"
  | "star";

type ShapeStyle = {
  fill?: string;
  stroke: string;
  strokeWidth: number;
  opacity: number;
};

type RectGeometry = {
  width: number;
  height: number;
  cornerRadius?: number;
};

type CircleGeometry = {
  radius: number;
};

type TriangleGeometry = {
  width: number;
  height: number;
};

type LineGeometry = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

type PolygonGeometry = {
  sides: number;
  radius: number;
};

type StarGeometry = {
  spikes: number;
  outerRadius: number;
  innerRadius: number;
};

export type ShapeDefinition = {
  id: string;
  label: string;
  kind: ShapeKind;
  category: "basic" | "polygon";
  defaultStyle: ShapeStyle;
  geometry: RectGeometry | CircleGeometry | TriangleGeometry | LineGeometry | PolygonGeometry | StarGeometry;
  inspector: {
    fill: boolean;
    stroke: boolean;
    strokeWidth: boolean;
    opacity: boolean;
    cornerRadius?: boolean;
  };
};

export const shapeCatalog: ShapeDefinition[] = [
  {
    id: "rectangle",
    label: "Rectangle",
    kind: "rect",
    category: "basic",
    defaultStyle: {
      fill: "rgba(17,24,39,0.1)",
      stroke: "#111827",
      strokeWidth: 2,
      opacity: 1,
    },
    geometry: {
      width: 360,
      height: 240,
      cornerRadius: 0,
    },
    inspector: {
      fill: true,
      stroke: true,
      strokeWidth: true,
      opacity: true,
      cornerRadius: true,
    },
  },
  {
    id: "circle",
    label: "Circle",
    kind: "circle",
    category: "basic",
    defaultStyle: {
      fill: "rgba(17,24,39,0.1)",
      stroke: "#111827",
      strokeWidth: 2,
      opacity: 1,
    },
    geometry: {
      radius: 120,
    },
    inspector: {
      fill: true,
      stroke: true,
      strokeWidth: true,
      opacity: true,
    },
  },
  {
    id: "triangle",
    label: "Triangle",
    kind: "triangle",
    category: "basic",
    defaultStyle: {
      fill: "rgba(17,24,39,0.1)",
      stroke: "#111827",
      strokeWidth: 2,
      opacity: 1,
    },
    geometry: {
      width: 280,
      height: 240,
    },
    inspector: {
      fill: true,
      stroke: true,
      strokeWidth: true,
      opacity: true,
    },
  },
  {
    id: "line",
    label: "Line",
    kind: "line",
    category: "basic",
    defaultStyle: {
      stroke: "#111827",
      strokeWidth: 2,
      opacity: 1,
    },
    geometry: {
      x1: 0,
      y1: 0,
      x2: 300,
      y2: 0,
    },
    inspector: {
      fill: false,
      stroke: true,
      strokeWidth: true,
      opacity: true,
    },
  },
  {
    id: "polygon-5",
    label: "Pentagon",
    kind: "polygon",
    category: "polygon",
    defaultStyle: {
      fill: "rgba(17,24,39,0.1)",
      stroke: "#111827",
      strokeWidth: 2,
      opacity: 1,
    },
    geometry: {
      sides: 5,
      radius: 120,
    },
    inspector: {
      fill: true,
      stroke: true,
      strokeWidth: true,
      opacity: true,
    },
  },
  {
    id: "star-5",
    label: "Star",
    kind: "star",
    category: "polygon",
    defaultStyle: {
      fill: "rgba(17,24,39,0.1)",
      stroke: "#111827",
      strokeWidth: 2,
      opacity: 1,
    },
    geometry: {
      spikes: 5,
      outerRadius: 120,
      innerRadius: 60,
    },
    inspector: {
      fill: true,
      stroke: true,
      strokeWidth: true,
      opacity: true,
    },
  },
];

export function getShapeDefinitionById(shapeId: string): ShapeDefinition | undefined {
  return shapeCatalog.find((shape) => shape.id === shapeId);
}

export function getShapeCapabilities(type?: string, shapeKind?: string) {
  const normalizedType = String(type || "").toLowerCase();
  const normalizedKind = String(shapeKind || "").toLowerCase();
  const directKind = normalizedKind || normalizedType;
  const fromKind = shapeCatalog.find((shape) => shape.kind === directKind);
  if (fromKind) return fromKind.inspector;
  if (normalizedType === "polygon") {
    return {
      fill: true,
      stroke: true,
      strokeWidth: true,
      opacity: true,
      cornerRadius: false,
    };
  }
  if (normalizedType === "line") {
    return {
      fill: false,
      stroke: true,
      strokeWidth: true,
      opacity: true,
      cornerRadius: false,
    };
  }
  return {
    fill: true,
    stroke: true,
    strokeWidth: true,
    opacity: true,
    cornerRadius: normalizedType === "rect",
  };
}
