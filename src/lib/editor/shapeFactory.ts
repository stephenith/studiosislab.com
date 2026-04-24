import { Circle, Line, Polygon, Rect, Triangle } from "fabric";
import type { ShapeDefinition } from "@/data/shapes/catalog";

type PageSize = {
  w: number;
  h: number;
};

type FabricPoint = {
  x: number;
  y: number;
};

export function buildRegularPolygonPoints(sides: number, radius: number): FabricPoint[] {
  const clampedSides = Math.max(3, Math.floor(sides));
  const safeRadius = Math.max(1, radius);
  const points: FabricPoint[] = [];
  const step = (Math.PI * 2) / clampedSides;
  for (let index = 0; index < clampedSides; index += 1) {
    const angle = step * index - Math.PI / 2;
    points.push({
      x: safeRadius + Math.cos(angle) * safeRadius,
      y: safeRadius + Math.sin(angle) * safeRadius,
    });
  }
  return points;
}

export function buildStarPoints(spikes: number, outerRadius: number, innerRadius: number): FabricPoint[] {
  const clampedSpikes = Math.max(3, Math.floor(spikes));
  const safeOuter = Math.max(1, outerRadius);
  const safeInner = Math.max(1, Math.min(innerRadius, safeOuter - 1));
  const points: FabricPoint[] = [];
  const step = Math.PI / clampedSpikes;

  for (let index = 0; index < clampedSpikes * 2; index += 1) {
    const useOuter = index % 2 === 0;
    const radius = useOuter ? safeOuter : safeInner;
    const angle = step * index - Math.PI / 2;
    points.push({
      x: safeOuter + Math.cos(angle) * radius,
      y: safeOuter + Math.sin(angle) * radius,
    });
  }

  return points;
}

export function createShapeFromDefinition(def: ShapeDefinition, pageSize: PageSize): any {
  const centerX = pageSize.w / 2;
  const centerY = pageSize.h / 2;
  const baseStyle = {
    fill: def.defaultStyle.fill,
    stroke: def.defaultStyle.stroke,
    strokeWidth: def.defaultStyle.strokeWidth,
    opacity: def.defaultStyle.opacity,
    strokeUniform: true,
  };

  let shape: any;

  switch (def.kind) {
    case "rect": {
      const geometry = def.geometry as { width: number; height: number; cornerRadius?: number };
      shape = new Rect({
        left: centerX - geometry.width / 2,
        top: centerY - geometry.height / 2,
        width: geometry.width,
        height: geometry.height,
        rx: geometry.cornerRadius ?? 0,
        ry: geometry.cornerRadius ?? 0,
        ...baseStyle,
      });
      break;
    }
    case "circle": {
      const geometry = def.geometry as { radius: number };
      shape = new Circle({
        left: centerX - geometry.radius,
        top: centerY - geometry.radius,
        radius: geometry.radius,
        ...baseStyle,
      });
      break;
    }
    case "triangle": {
      const geometry = def.geometry as { width: number; height: number };
      shape = new Triangle({
        left: centerX - geometry.width / 2,
        top: centerY - geometry.height / 2,
        width: geometry.width,
        height: geometry.height,
        ...baseStyle,
      });
      break;
    }
    case "line": {
      const geometry = def.geometry as { x1: number; y1: number; x2: number; y2: number };
      shape = new Line([geometry.x1, geometry.y1, geometry.x2, geometry.y2], {
        left: centerX - (geometry.x2 - geometry.x1) / 2,
        top: centerY,
        fill: undefined,
        stroke: def.defaultStyle.stroke,
        strokeWidth: def.defaultStyle.strokeWidth,
        opacity: def.defaultStyle.opacity,
        strokeUniform: true,
      });
      break;
    }
    case "polygon": {
      const geometry = def.geometry as { sides: number; radius: number };
      const points = buildRegularPolygonPoints(geometry.sides, geometry.radius);
      shape = new Polygon(points, {
        left: centerX - geometry.radius,
        top: centerY - geometry.radius,
        ...baseStyle,
      });
      break;
    }
    case "star": {
      const geometry = def.geometry as { spikes: number; outerRadius: number; innerRadius: number };
      const points = buildStarPoints(geometry.spikes, geometry.outerRadius, geometry.innerRadius);
      shape = new Polygon(points, {
        left: centerX - geometry.outerRadius,
        top: centerY - geometry.outerRadius,
        ...baseStyle,
      });
      break;
    }
    default: {
      const _exhaustive: never = def.kind;
      throw new Error(`Unsupported shape kind: ${_exhaustive}`);
    }
  }

  shape.data = {
    ...(shape.data || {}),
    shapeId: def.id,
    shapeKind: def.kind,
  };

  return shape;
}
