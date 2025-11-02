import type { Detection, StumpJSON } from './types';
import { Stump, HaarFeature } from './haarFeature';

const WINDOW_SIZE = 24;

let stumps: Stump[] = [];

export function initializeStumps(stumpsJSON: StumpJSON[]): void {
  stumps = stumpsJSON.map(
    (stump) =>
      new Stump(
        new HaarFeature(
          stump.feature.Type,
          stump.feature.Width,
          stump.feature.Height,
          stump.feature.PosX,
          stump.feature.PosY
        ),
        stump.threshold,
        stump.error,
        stump.polarity,
        stump.amountOfSay
      )
  );
}

function detectFace(
  integralImage: number[][],
  squaredIntegralImage: number[][],
  posX: number,
  posY: number,
  scaleFactor: number
): Detection | null {
  const steps = [1, 10, 100, 500, 2000, 4000, 6000];
  let sumAlphaH = 0;
  let stageIndex = 0;

  for (let i = 0; i < 6000; i++) {
    const stump = stumps[i];
    if (!stump) break;

    const response = stump.feature.applyFeature(
      integralImage,
      squaredIntegralImage,
      posX,
      posY,
      scaleFactor
    );
    const scaledThreshold = stump.threshold * scaleFactor * scaleFactor;
    const h = stump.polarity * response <= stump.polarity * scaledThreshold ? 1 : -1;
    sumAlphaH += stump.amountOfSay * h;

    if (i + 1 === steps[stageIndex]) {
      if (sumAlphaH <= 0) return null;
      stageIndex++;
    }
  }

  return { x: posX, y: posY, scaleFactor, confidency: sumAlphaH };
}

export function findFaces(
  integralImage: number[][],
  squaredIntegralImage: number[][],
  width: number,
  height: number,
  stepSize: number = 2,
  maxScale: number = 3,
  scaleStep: number = 1
): Detection[] {
  const rawDetections: Detection[] = [];

  let scaleFactor = 1;
  while (scaleFactor <= maxScale) {
    const scaledWindowSize = Math.floor(WINDOW_SIZE * scaleFactor);
    const scaledStepSize = Math.floor(stepSize * scaleFactor);

    for (let startY = 0; startY < height - scaledWindowSize; startY += scaledStepSize) {
      for (let startX = 0; startX < width - scaledWindowSize; startX += scaledStepSize) {
        const detection = detectFace(
          integralImage,
          squaredIntegralImage,
          startX,
          startY,
          scaleFactor
        );
        if (detection) {
          rawDetections.push(detection);
        }
      }
    }
    scaleFactor += scaleStep;
  }

  return filterStrongestFaces(rawDetections, WINDOW_SIZE * 0.75);
}

function filterStrongestFaces(detections: Detection[], windowSize: number = WINDOW_SIZE / 2): Detection[] {
  const filtered: Detection[] = [];

  detections.forEach((face) => {
    let isMerged = false;
    for (let i = 0; i < filtered.length; i++) {
      const existingFace = filtered[i];
      if (!existingFace) continue;

      if (
        Math.abs(face.x - existingFace.x) < windowSize &&
        Math.abs(face.y - existingFace.y) < windowSize
      ) {
        if (face.confidency > existingFace.confidency) {
          filtered[i] = { ...face };
        }
        isMerged = true;
        break;
      }
    }
    if (!isMerged) filtered.push({ ...face });
  });

  return filtered;
}

export { WINDOW_SIZE };
