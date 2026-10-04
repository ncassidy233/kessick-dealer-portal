import { SurveyPoint } from '@/types/survey';

export const distance = (p1: SurveyPoint, p2: SurveyPoint) => {
  return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
};

export const rectIntersect = (
  r1: { x: number; y: number; w: number; h: number },
  r2: { x: number; y: number; w: number; h: number }
) => {
  return !(r2.x > r1.x + r1.w || r2.x + r2.w < r1.x || r2.y > r1.y + r1.h || r2.y + r2.h < r1.y);
};

export const pointInRect = (
  pt: SurveyPoint,
  rect: { x: number; y: number; w: number; h: number }
) => {
  return pt.x >= rect.x && pt.x <= rect.x + rect.w && pt.y >= rect.y && pt.y <= rect.y + rect.h;
};

export const snapPoint = (
  pt: SurveyPoint,
  points: SurveyPoint[],
  threshold: number
): SurveyPoint => {
  let closest = pt;
  let minDist = threshold;
  for (const p of points) {
    const d = distance(pt, p);
    if (d < minDist) {
      minDist = d;
      closest = { x: p.x, y: p.y };
    }
  }
  return closest;
};
