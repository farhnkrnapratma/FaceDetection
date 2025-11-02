import type { ProcessedImage } from './types';

// Reusable arrays to prevent memory churn (allocated once and reused every frame)
let cachedIntegralMatrix: number[][] | null = null;
let cachedSquaredIntegralMatrix: number[][] | null = null;
let cachedWidth = 0;
let cachedHeight = 0;

export function processImageData(
  pixels: Uint8ClampedArray,
  width: number,
  height: number
): ProcessedImage {
  // Reuse cached arrays if dimensions match, otherwise reallocate
  if (
    !cachedIntegralMatrix ||
    !cachedSquaredIntegralMatrix ||
    cachedWidth !== width ||
    cachedHeight !== height
  ) {
    cachedIntegralMatrix = Array(height + 1)
      .fill(0)
      .map(() => Array(width + 1).fill(0));
    cachedSquaredIntegralMatrix = Array(height + 1)
      .fill(0)
      .map(() => Array(width + 1).fill(0));
    cachedWidth = width;
    cachedHeight = height;
    console.log(`Allocated integral image arrays: ${width}×${height}`);
  }

  const integralMatrix = cachedIntegralMatrix;
  const squaredIntegralMatrix = cachedSquaredIntegralMatrix;

  // Zero out arrays for reuse (faster than recreating)
  for (let y = 0; y <= height; y++) {
    for (let x = 0; x <= width; x++) {
      integralMatrix[y]![x] = 0;
      squaredIntegralMatrix[y]![x] = 0;
    }
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = (y * width + x) * 4;
      const grayValue = (pixels[index]! + pixels[index + 1]! + pixels[index + 2]!) / 3;
      const normalizedValue = grayValue / 255;

      const above = integralMatrix[y]![x + 1]!;
      const left = integralMatrix[y + 1]![x]!;
      const aboveLeft = integralMatrix[y]![x]!;

      const aboveSq = squaredIntegralMatrix[y]![x + 1]!;
      const leftSq = squaredIntegralMatrix[y + 1]![x]!;
      const aboveLeftSq = squaredIntegralMatrix[y]![x]!;

      integralMatrix[y + 1]![x + 1] = normalizedValue + above + left - aboveLeft;
      squaredIntegralMatrix[y + 1]![x + 1] =
        normalizedValue * normalizedValue + aboveSq + leftSq - aboveLeftSq;
    }
  }

  return { integralMatrix, squaredIntegralMatrix };
}
