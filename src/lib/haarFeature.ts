import { FeatureType, type FeatureTypeValue } from './types';

export class Stump {
  feature: HaarFeature;
  threshold: number;
  error: number;
  polarity: number;
  amountOfSay: number;

  constructor(
    feature: HaarFeature,
    threshold: number,
    error: number,
    polarity: number,
    amountOfSay: number
  ) {
    this.feature = feature;
    this.threshold = threshold;
    this.error = error;
    this.polarity = polarity;
    this.amountOfSay = amountOfSay;
  }
}

export class HaarFeature {
  type: FeatureTypeValue;
  width: number;
  height: number;
  posX: number;
  posY: number;

  constructor(
    type: FeatureTypeValue,
    width: number,
    height: number,
    posX: number,
    posY: number
  ) {
    this.type = type;
    this.width = width;
    this.height = height;
    this.posX = posX;
    this.posY = posY;
  }

  applyFeature(
    integralImage: number[][],
    squaredIntegralImage: number[][],
    posX: number,
    posY: number,
    scaleFactor: number
  ): number {
    const combinedX = Math.floor(this.posX * scaleFactor) + posX;
    const combinedY = Math.floor(this.posY * scaleFactor) + posY;
    const scaledWidth = Math.round(this.width * scaleFactor);
    const scaledHeight = Math.round(this.height * scaleFactor);

    const sum = this.getRegionSum(integralImage, combinedX, combinedY, scaledWidth, scaledHeight);
    const squaredSum = this.getRegionSum(squaredIntegralImage, combinedX, combinedY, scaledWidth, scaledHeight);

    const area = scaledWidth * scaledHeight;
    const mean = sum / area;
    const variance = squaredSum / area - mean * mean;
    const stdDev = Math.sqrt(Math.max(variance, 1e-6));

    const { white, black } = this.calculateRegions(integralImage, combinedX, combinedY, scaledWidth, scaledHeight);
    const rawFeatureValue = black - white;

    return variance > 0 ? rawFeatureValue / stdDev : rawFeatureValue;
  }

  calculateRegions(
    integralImage: number[][],
    combinedX: number,
    combinedY: number,
    scaledWidth: number,
    scaledHeight: number
  ): { white: number; black: number } {
    const totalSum = this.getRegionSum(integralImage, combinedX, combinedY, scaledWidth, scaledHeight);

    let blackSum: number;
    switch (this.type) {
      case FeatureType.EdgeHorizontal:
        blackSum = this.getRegionSum(
          integralImage,
          combinedX + Math.floor(scaledWidth / 2),
          combinedY,
          Math.floor(scaledWidth / 2),
          scaledHeight
        );
        break;
      case FeatureType.EdgeVertical:
        blackSum = this.getRegionSum(
          integralImage,
          combinedX,
          combinedY + Math.floor(scaledHeight / 2),
          scaledWidth,
          Math.floor(scaledHeight / 2)
        );
        break;
      case FeatureType.ThreeHorizontal:
        blackSum = this.getRegionSum(
          integralImage,
          combinedX + Math.floor(scaledWidth / 3),
          combinedY,
          Math.floor(scaledWidth / 3),
          scaledHeight
        );
        break;
      case FeatureType.ThreeVertical:
        blackSum = this.getRegionSum(
          integralImage,
          combinedX,
          combinedY + Math.floor(scaledHeight / 3),
          scaledWidth,
          Math.floor(scaledHeight / 3)
        );
        break;
      case FeatureType.FourBottomToTop:
        blackSum =
          this.getRegionSum(
            integralImage,
            combinedX + Math.floor(scaledWidth / 2),
            combinedY,
            Math.floor(scaledWidth / 2),
            Math.floor(scaledHeight / 2)
          ) +
          this.getRegionSum(
            integralImage,
            combinedX,
            combinedY + Math.floor(scaledHeight / 2),
            Math.floor(scaledWidth / 2),
            Math.floor(scaledHeight / 2)
          );
        break;
      case FeatureType.FourTopToBottom:
        blackSum =
          this.getRegionSum(
            integralImage,
            combinedX,
            combinedY,
            Math.floor(scaledWidth / 2),
            Math.floor(scaledHeight / 2)
          ) +
          this.getRegionSum(
            integralImage,
            combinedX + Math.floor(scaledWidth / 2),
            combinedY + Math.floor(scaledHeight / 2),
            Math.floor(scaledWidth / 2),
            Math.floor(scaledHeight / 2)
          );
        break;
      default:
        blackSum = 0;
    }

    const whiteSum = totalSum - blackSum;

    // Adjusts weight for three-rectangle features
    if (this.type === FeatureType.ThreeHorizontal || this.type === FeatureType.ThreeVertical) {
      blackSum *= 2;
    }

    return { white: whiteSum, black: blackSum };
  }

  getRegionSum(matrix: number[][], x: number, y: number, w: number, h: number): number {
    return (
      (matrix[y + h]?.[x + w] ?? 0) -
      (x > 0 ? matrix[y + h]?.[x] ?? 0 : 0) -
      (y > 0 ? matrix[y]?.[x + w] ?? 0 : 0) +
      (x > 0 && y > 0 ? matrix[y]?.[x] ?? 0 : 0)
    );
  }
}
