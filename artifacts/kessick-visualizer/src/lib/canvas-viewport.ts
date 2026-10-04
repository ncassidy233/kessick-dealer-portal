export interface CanvasSize {
  width: number;
  height: number;
}

export interface ImageSize {
  width: number;
  height: number;
}

export interface CanvasViewport {
  centerX: number;
  centerY: number;
  zoom: number;
}

export interface StageTransform {
  x: number;
  y: number;
  scale: number;
}

export const MIN_VIEWPORT_ZOOM = 0.65;
export const MAX_VIEWPORT_ZOOM = 10;

export function clampViewportZoom(zoom: number) {
  return Math.min(MAX_VIEWPORT_ZOOM, Math.max(MIN_VIEWPORT_ZOOM, zoom));
}

export function createFitViewport(image: ImageSize): CanvasViewport {
  return {
    centerX: image.width / 2,
    centerY: image.height / 2,
    zoom: 1,
  };
}

export function calculateFitScale(
  canvas: CanvasSize,
  image: ImageSize,
  padding = 16,
) {
  if (
    canvas.width <= 0 ||
    canvas.height <= 0 ||
    image.width <= 0 ||
    image.height <= 0
  ) {
    return 1;
  }

  const availableWidth = Math.max(1, canvas.width - padding * 2);
  const availableHeight = Math.max(1, canvas.height - padding * 2);
  return Math.min(availableWidth / image.width, availableHeight / image.height);
}

export function viewportToStageTransform(
  viewport: CanvasViewport,
  canvas: CanvasSize,
  image: ImageSize,
  padding = 16,
): StageTransform {
  const scale = calculateFitScale(canvas, image, padding) * viewport.zoom;

  return {
    x: canvas.width / 2 - viewport.centerX * scale,
    y: canvas.height / 2 - viewport.centerY * scale,
    scale,
  };
}

export function viewportFromStagePosition(
  position: { x: number; y: number },
  zoom: number,
  canvas: CanvasSize,
  image: ImageSize,
  padding = 16,
): CanvasViewport {
  const scale = calculateFitScale(canvas, image, padding) * zoom;

  return {
    centerX: (canvas.width / 2 - position.x) / scale,
    centerY: (canvas.height / 2 - position.y) / scale,
    zoom,
  };
}

export function zoomViewportAtPoint(
  viewport: CanvasViewport,
  pointer: { x: number; y: number },
  nextZoom: number,
  canvas: CanvasSize,
  image: ImageSize,
  padding = 16,
): CanvasViewport {
  const currentTransform = viewportToStageTransform(
    viewport,
    canvas,
    image,
    padding,
  );
  const scenePoint = {
    x: (pointer.x - currentTransform.x) / currentTransform.scale,
    y: (pointer.y - currentTransform.y) / currentTransform.scale,
  };
  const zoom = clampViewportZoom(nextZoom);
  const nextScale = calculateFitScale(canvas, image, padding) * zoom;

  return {
    centerX: scenePoint.x + (canvas.width / 2 - pointer.x) / nextScale,
    centerY: scenePoint.y + (canvas.height / 2 - pointer.y) / nextScale,
    zoom,
  };
}