export const FeatureType = {
  EdgeHorizontal: 0,
  EdgeVertical: 1,
  ThreeHorizontal: 2,
  ThreeVertical: 3,
  FourBottomToTop: 4,
  FourTopToBottom: 5,
} as const;

export type FeatureTypeValue = (typeof FeatureType)[keyof typeof FeatureType];

export interface Feature {
  Type: FeatureTypeValue;
  Width: number;
  Height: number;
  PosX: number;
  PosY: number;
}

export interface StumpJSON {
  feature: Feature;
  threshold: number;
  error: number;
  polarity: number;
  amountOfSay: number;
}

export interface Detection {
  x: number;
  y: number;
  scaleFactor: number;
  confidency: number;
}

export interface ProcessedImage {
  integralMatrix: number[][];
  squaredIntegralMatrix: number[][];
}
