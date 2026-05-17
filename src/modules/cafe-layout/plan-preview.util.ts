/** Simplified plan geometry for mobile booking preview (canvas px, 200 px = 1 m). */

export const PLAN_PX_PER_M = 200;

export type PlanPreviewBounds = {
  minX: number;
  minY: number;
  width: number;
  height: number;
};

export type PlanPreviewWall = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

export type PlanPreviewFurniture = {
  x: number;
  y: number;
  widthM: number;
  heightM: number;
  rotationDeg?: number;
  kind: string;
  name?: string;
  shape?: 'rect' | 'rounded' | 'oval';
  variant?: string;
  sofaStyle?: string;
  stairKind?: string;
  pairId?: string;
  pairRole?: 'up' | 'down';
  id?: string;
};

export type PlanPreviewSegment = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

export type PlanPreviewZone = {
  roomId: string;
  name: string;
  points: Array<{ x: number; y: number }>;
  /** Zone on plan without linked cafe room — visible only, not bookable */
  unassigned?: boolean;
};

export type PlanPreviewPayload = {
  planFieldM: { widthM: number; heightM: number };
  backgroundImage: {
    dataUrl: string;
    x: number;
    y: number;
    widthM: number;
    heightM: number;
    opacity?: number;
  } | null;
  bounds: PlanPreviewBounds;
  zones: PlanPreviewZone[];
  walls: PlanPreviewWall[];
  furniture: PlanPreviewFurniture[];
  openings: PlanPreviewSegment[];
};

type Point = { x: number; y: number };
type WallSeg = { id: string; start: Point; end: Point };
type Span = { wallId: string; fromPx: number; toPx: number };

function m2px(m: number) {
  return m * PLAN_PX_PER_M;
}

function readStrProp(
  props: Record<string, unknown>,
  key: string,
  fallback: string,
): string {
  const v = props[key];
  return typeof v === 'string' ? v : fallback;
}

function readStrPropFrom(
  props: Record<string, unknown>,
  g: Record<string, unknown>,
  propKey: string,
  geomKey: string,
  fallback: string,
): string {
  const fromProps = props[propKey];
  if (typeof fromProps === 'string') return fromProps;
  const fromGeom = g[geomKey];
  if (typeof fromGeom === 'string') return fromGeom;
  return fallback;
}

function wallLen(w: WallSeg) {
  return Math.hypot(w.end.x - w.start.x, w.end.y - w.start.y);
}

function pointOnWall(w: WallSeg, along: number): Point {
  const len = wallLen(w);
  if (len < 1e-6) return { ...w.start };
  const t = along / len;
  return {
    x: w.start.x + (w.end.x - w.start.x) * t,
    y: w.start.y + (w.end.y - w.start.y) * t,
  };
}

function spanSegment(
  walls: Map<string, WallSeg>,
  span: Span,
): PlanPreviewSegment | null {
  const w = walls.get(span.wallId);
  if (!w) return null;
  const a = pointOnWall(w, span.fromPx);
  const b = pointOnWall(w, span.toPx);
  return { x1: a.x, y1: a.y, x2: b.x, y2: b.y };
}

function pushBounds(
  b: PlanPreviewBounds | null,
  x: number,
  y: number,
  pad = 48,
): PlanPreviewBounds {
  if (!b) {
    return { minX: x - pad, minY: y - pad, width: pad * 2, height: pad * 2 };
  }
  const minX = Math.min(b.minX, x - pad);
  const minY = Math.min(b.minY, y - pad);
  const maxX = Math.max(b.minX + b.width, x + pad);
  const maxY = Math.max(b.minY + b.height, y + pad);
  return { minX, minY, width: maxX - minX, height: maxY - minY };
}

function expandBoundsForFurniture(
  b: PlanPreviewBounds,
  item: PlanPreviewFurniture,
) {
  const w = m2px(item.widthM);
  const h = m2px(item.heightM);
  let box = b;
  box = pushBounds(box, item.x - w / 2, item.y - h / 2, 0);
  box = pushBounds(box, item.x + w / 2, item.y + h / 2, 0);
  return pushBounds(box, item.x, item.y, 48);
}

function finalizeBounds(
  b: PlanPreviewBounds | null,
  fieldW: number,
  fieldH: number,
): PlanPreviewBounds {
  const fieldBox: PlanPreviewBounds = {
    minX: 0,
    minY: 0,
    width: fieldW,
    height: fieldH,
  };
  if (!b) return fieldBox;
  const minX = Math.min(b.minX, 0);
  const minY = Math.min(b.minY, 0);
  const maxX = Math.max(b.minX + b.width, fieldW);
  const maxY = Math.max(b.minY + b.height, fieldH);
  return {
    minX,
    minY,
    width: Math.max(400, maxX - minX),
    height: Math.max(300, maxY - minY),
  };
}

export function buildPlanPreviewPayload(
  elements: Array<{
    id?: string;
    elementType?: string;
    geometry?: unknown;
    props?: unknown;
    name?: string | null;
  }>,
  roomNames: Map<string, string>,
  planFieldM: { widthM: number; heightM: number },
  backgroundImage: PlanPreviewPayload['backgroundImage'],
): PlanPreviewPayload {
  const fieldW = planFieldM.widthM * PLAN_PX_PER_M;
  const fieldH = planFieldM.heightM * PLAN_PX_PER_M;
  let bounds: PlanPreviewBounds | null = null;
  const walls: PlanPreviewWall[] = [];
  const wallMap = new Map<string, WallSeg>();
  const furniture: PlanPreviewFurniture[] = [];
  const openings: PlanPreviewSegment[] = [];
  const zones: PlanPreviewZone[] = [];

  for (const el of elements) {
    const et = String(el.elementType || '');
    const g = (el.geometry || {}) as Record<string, unknown>;
    if (et === 'WALL') {
      const x1 = Number(g.x1);
      const y1 = Number(g.y1);
      const x2 = Number(g.x2);
      const y2 = Number(g.y2);
      if (![x1, y1, x2, y2].every(Number.isFinite)) continue;
      const id = String(el.id || '');
      wallMap.set(id, { id, start: { x: x1, y: y1 }, end: { x: x2, y: y2 } });
      walls.push({ x1, y1, x2, y2 });
      bounds = pushBounds(bounds, x1, y1, 0);
      bounds = pushBounds(bounds, x2, y2, 0);
    }
  }

  for (const el of elements) {
    const et = String(el.elementType || '');
    const g = (el.geometry || {}) as Record<string, unknown>;
    const props = (el.props || {}) as Record<string, unknown>;

    if (et === 'ROOM_ZONE') {
      const pointsRaw = g.points;
      if (!Array.isArray(pointsRaw)) continue;
      const points = pointsRaw
        .map((p) => {
          const pt = p as Record<string, unknown>;
          const x = Number(pt.x);
          const y = Number(pt.y);
          return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
        })
        .filter(Boolean) as Point[];
      if (points.length < 3) continue;
      const linkedRoomId =
        typeof props.roomId === 'string' && props.roomId.trim()
          ? props.roomId.trim()
          : null;
      zones.push({
        roomId: linkedRoomId ?? `zone-${String(el.id || zones.length)}`,
        name: linkedRoomId
          ? roomNames.get(linkedRoomId) || String(el.name || 'Комната')
          : String(el.name || 'Зона без комнаты'),
        points,
        unassigned: !linkedRoomId,
      });
      for (const p of points) bounds = pushBounds(bounds, p.x, p.y, 0);
      continue;
    }

    if (et === 'TABLE' || et === 'CHAIR' || et === 'STAIR') {
      const x = Number(g.x);
      const y = Number(g.y);
      const widthM = Number(g.widthM ?? props.widthM);
      const heightM = Number(g.heightM ?? props.heightM);
      if (![x, y, widthM, heightM].every(Number.isFinite)) continue;
      const item: PlanPreviewFurniture = {
        id: el.id ? String(el.id) : undefined,
        x,
        y,
        widthM,
        heightM,
        rotationDeg: Number(g.rotationDeg ?? props.rotationDeg) || 0,
        kind: et === 'TABLE' ? 'table' : et === 'CHAIR' ? 'chair' : 'stair',
        name: el.name ? String(el.name) : undefined,
        shape:
          et === 'TABLE' &&
          (g.shape === 'oval' || g.shape === 'rounded' || g.shape === 'rect')
            ? g.shape
            : et === 'TABLE'
              ? 'rect'
              : undefined,
        variant:
          et === 'CHAIR'
            ? readStrProp(props, 'variant', 'standard')
            : undefined,
        stairKind:
          et === 'STAIR'
            ? readStrPropFrom(props, g, 'kind', 'kind', 'rect')
            : undefined,
        pairId:
          et === 'STAIR' && typeof props.pairId === 'string'
            ? props.pairId
            : undefined,
        pairRole:
          et === 'STAIR' &&
          (props.pairRole === 'up' || props.pairRole === 'down')
            ? props.pairRole
            : undefined,
      };
      furniture.push(item);
      bounds = expandBoundsForFurniture(
        bounds ?? finalizeBounds(null, fieldW, fieldH),
        item,
      );
      continue;
    }

    if (
      ['SOFA', 'TOILET', 'SINK', 'CABINET', 'TV', 'WHITEBOARD'].includes(et)
    ) {
      const x = Number(g.x);
      const y = Number(g.y);
      const widthM = Number(g.widthM ?? props.widthM);
      const heightM = Number(g.heightM ?? props.heightM);
      if (![x, y, widthM, heightM].every(Number.isFinite)) continue;
      const kindMap: Record<string, string> = {
        SOFA: 'sofa',
        TOILET: 'toilet',
        SINK: 'sink',
        CABINET: 'cabinet',
        TV: props.mount === 'stand' ? 'tv_stand' : 'tv',
        WHITEBOARD: 'whiteboard',
      };
      const item: PlanPreviewFurniture = {
        x,
        y,
        widthM,
        heightM,
        rotationDeg: Number(props.rotationDeg) || 0,
        kind: kindMap[et] || 'fixture',
        name: el.name ? String(el.name) : undefined,
        sofaStyle:
          kindMap[et] === 'sofa'
            ? readStrProp(props, 'sofaStyle', 'standard')
            : undefined,
      };
      furniture.push(item);
      bounds = expandBoundsForFurniture(
        bounds ?? finalizeBounds(null, fieldW, fieldH),
        item,
      );
      continue;
    }

    if (et === 'WINDOW' || et === 'DOOR') {
      const spans = Array.isArray(g.spans) ? (g.spans as Span[]) : [];
      for (const span of spans) {
        const seg = spanSegment(wallMap, span);
        if (!seg) continue;
        openings.push(seg);
        bounds = pushBounds(bounds, seg.x1, seg.y1, 0);
        bounds = pushBounds(bounds, seg.x2, seg.y2, 0);
      }
    }
  }

  if (backgroundImage) {
    const bx = backgroundImage.x;
    const by = backgroundImage.y;
    const bw = m2px(backgroundImage.widthM);
    const bh = m2px(backgroundImage.heightM);
    bounds = pushBounds(bounds, bx - bw / 2, by - bh / 2, 0);
    bounds = pushBounds(bounds, bx + bw / 2, by + bh / 2, 0);
  }

  return {
    planFieldM,
    backgroundImage,
    bounds: finalizeBounds(bounds, fieldW, fieldH),
    zones,
    walls,
    furniture,
    openings,
  };
}

export type PlanPreviewRasterImage = {
  dataUrl: string;
  width: number;
  height: number;
};

export type PlanPreviewClientPayload = Omit<
  PlanPreviewPayload,
  'backgroundImage'
> & {
  rasterImage?: PlanPreviewRasterImage | null;
};

/** Booking/mobile API — full vectors for client SVG; optional JPEG not used when vectors present. */
export function planPreviewForClient(
  payload: PlanPreviewPayload | null,
  raster?: PlanPreviewRasterImage | null,
): PlanPreviewClientPayload | null {
  if (!payload) return null;
  const hasVectors =
    payload.walls.length > 0 ||
    payload.furniture.length > 0 ||
    payload.openings.length > 0;
  return {
    planFieldM: payload.planFieldM,
    bounds: payload.bounds,
    zones: payload.zones,
    walls: payload.walls,
    furniture: payload.furniture,
    openings: payload.openings,
    rasterImage: hasVectors ? null : (raster ?? null),
  };
}
