import { useRef, useState, useEffect, useCallback } from 'react';
import { initializeStumps, findFaces, WINDOW_SIZE } from '@/lib/faceDetection';
import { processImageData } from '@/lib/imageProcessing';
import type { Detection, StumpJSON } from '@/lib/types';

interface UseFaceDetectionOptions {
  stumpsData: StumpJSON[];
  detectionThreshold?: number;
  stepSize?: number;
  maxScale?: number;
  scaleStep?: number;
}

export function useFaceDetection({
  stumpsData,
  detectionThreshold = 300,
  stepSize = 1.5,
  maxScale = 5,
  scaleStep = 0.25,
}: UseFaceDetectionOptions) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const detectionCanvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [uploadedImage, setUploadedImage] = useState<HTMLImageElement | null>(null);
  const [imageTransform, setImageTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [detections, setDetections] = useState<Detection[]>([]);
  const animationFrameRef = useRef<number>();
  const permissionCheckTimeoutRef = useRef<number>();

  // Store canvas contexts in refs to avoid calling getContext every frame
  const canvasCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  const detectionCtxRef = useRef<CanvasRenderingContext2D | null>(null);

  // Store frequently changing values in refs to stabilize animation loop
  const imageTransformRef = useRef(imageTransform);
  const detectionThresholdRef = useRef(detectionThreshold);
  const stepSizeRef = useRef(stepSize);
  const maxScaleRef = useRef(maxScale);
  const scaleStepRef = useRef(scaleStep);

  // Keep refs in sync with state
  useEffect(() => {
    imageTransformRef.current = imageTransform;
  }, [imageTransform]);

  useEffect(() => {
    detectionThresholdRef.current = detectionThreshold;
    stepSizeRef.current = stepSize;
    maxScaleRef.current = maxScale;
    scaleStepRef.current = scaleStep;
  }, [detectionThreshold, stepSize, maxScale, scaleStep]);

  // Initialize stumps data
  useEffect(() => {
    if (stumpsData.length > 0) {
      initializeStumps(stumpsData);
      console.log(`Initialized ${stumpsData.length} stumps for face detection`);
    } else {
      console.warn('No training data loaded! Please add stumpsJSON to src/lib/stumpsData.ts');
    }
  }, [stumpsData]);

  // Initialize canvas contexts once to avoid calling getContext every frame
  useEffect(() => {
    if (canvasRef.current && !canvasCtxRef.current) {
      canvasCtxRef.current = canvasRef.current.getContext('2d', { willReadFrequently: true });
    }
    if (detectionCanvasRef.current && !detectionCtxRef.current) {
      detectionCtxRef.current = detectionCanvasRef.current.getContext('2d', { willReadFrequently: true });
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Stop camera if active
      if (videoRef.current?.srcObject) {
        const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
        tracks.forEach((track) => track.stop());
        videoRef.current.srcObject = null;
      }
      // Clear video element
      if (videoRef.current) {
        videoRef.current = null;
      }
      // Clear permission check timeout
      if (permissionCheckTimeoutRef.current) {
        clearTimeout(permissionCheckTimeoutRef.current);
      }
      // Clear animation frame
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  // Toggle camera
  const toggleCamera = useCallback(async () => {
    if (cameraEnabled) {
      // Stop all media tracks
      if (videoRef.current?.srcObject) {
        const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
        tracks.forEach((track) => track.stop());
        // Clear srcObject to release MediaStream reference
        videoRef.current.srcObject = null;
      }
      // Clear any pending permission check timeouts
      if (permissionCheckTimeoutRef.current) {
        clearTimeout(permissionCheckTimeoutRef.current);
        permissionCheckTimeoutRef.current = undefined;
      }
      setCameraEnabled(false);
    } else {
      try {
        // Check if getUserMedia is supported
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error(
            'Camera access is not supported. Please use HTTPS or access the app through a secure connection.'
          );
        }

        // Check if we're in a secure context (required for mobile browsers)
        if (!window.isSecureContext) {
          throw new Error(
            'Camera access requires a secure connection (HTTPS). This app must be served over HTTPS to access the camera on mobile devices.'
          );
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: 'user', // Use front camera on mobile
          },
          audio: false,
        });
        if (!videoRef.current) {
          videoRef.current = document.createElement('video');
        }
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraEnabled(true);
      } catch (err) {
        const error = err as Error;
        const errorMessage = error.message;
        const errorName = error.name;

        // Handle AbortError - Firefox shows permission prompt but throws this error
        // We'll retry automatically after user grants permission
        if (errorName === 'AbortError' || errorMessage.includes('aborted by the user agent')) {
          console.log('Camera permission prompt displayed, will retry when granted...');

          // Poll for permission being granted and retry
          const checkPermission = async () => {
            try {
              const stream = await navigator.mediaDevices.getUserMedia({
                video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
                audio: false,
              });
              if (!videoRef.current) {
                videoRef.current = document.createElement('video');
              }
              videoRef.current.srcObject = stream;
              await videoRef.current.play();
              setCameraEnabled(true);
              permissionCheckTimeoutRef.current = undefined;
              console.log('Camera started after permission granted');
            } catch (retryErr) {
              // If still AbortError or permission pending, retry after delay
              const retryError = retryErr as Error;
              if (retryError.name === 'AbortError' || retryError.message.includes('aborted')) {
                permissionCheckTimeoutRef.current = setTimeout(checkPermission, 500) as unknown as number;
              }
              // For other errors, silently fail (user can click button again)
            }
          };

          // Start polling after short delay
          permissionCheckTimeoutRef.current = setTimeout(checkPermission, 500) as unknown as number;
          return;
        }

        console.error('Camera error:', err);

        // Provide user-friendly error messages
        if (errorName === 'NotAllowedError' || errorMessage.includes('Permission denied')) {
          alert(
            'Camera Permission Denied\n\n' +
            'Please allow camera access:\n' +
            '• Click the camera icon in the address bar\n' +
            '• Select "Allow" for camera access\n' +
            '• Try the camera button again'
          );
        } else if (errorName === 'NotFoundError' || errorMessage.includes('not found')) {
          alert(
            'No Camera Found\n\n' +
            '• No camera detected on this device\n' +
            '• Camera may be in use by another application\n' +
            '• Try closing other apps using the camera\n\n' +
            'Or use "Upload Image" instead.'
          );
        } else if (errorName === 'NotReadableError' || errorMessage.includes('not readable')) {
          alert(
            'Camera In Use\n\n' +
            'The camera is being used by another application.\n\n' +
            '• Close other apps using the camera\n' +
            '• Restart your browser\n' +
            '• Try again\n\n' +
            'Or use "Upload Image" instead.'
          );
        } else if (errorMessage.includes('secure') || errorMessage.includes('HTTPS')) {
          alert(
            'Camera access requires HTTPS.\n\n' +
            'To use the camera on mobile:\n' +
            '• Deploy the app with HTTPS, or\n' +
            '• Use a tunneling service like ngrok, or\n' +
            '• Upload an image instead'
          );
        } else {
          alert(
            'Camera Error\n\n' +
            errorMessage + '\n\n' +
            'Try these solutions:\n' +
            '• Check camera permissions in browser settings\n' +
            '• Close other apps using the camera\n' +
            '• Restart your browser\n' +
            '• Use "Upload Image" instead'
          );
        }
      }
    }
  }, [cameraEnabled]);

  // Handle image upload
  const handleImageUpload = useCallback((file: File) => {
    if (cameraEnabled) {
      console.log('Camera active, image ignored.');
      return;
    }

    const url = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      // Downsample large images to reduce memory usage
      const maxWidth = 1280;
      const maxHeight = 720;

      let finalImage = img;

      // Only downsample if image is larger than canvas
      if (img.width > maxWidth || img.height > maxHeight) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        if (ctx) {
          // Calculate scaled dimensions maintaining aspect ratio
          const scale = Math.min(maxWidth / img.width, maxHeight / img.height);
          canvas.width = img.width * scale;
          canvas.height = img.height * scale;

          // Draw downsampled image
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

          // Create new image from downsampled canvas
          const downsampledImg = new Image();
          downsampledImg.src = canvas.toDataURL();
          finalImage = downsampledImg;

          console.log(`Downsampled image from ${img.width}×${img.height} to ${canvas.width}×${canvas.height}`);
        }
      }

      // Clean up old image before setting new one
      setUploadedImage((prevImage) => {
        if (prevImage) {
          prevImage.onload = null;
          prevImage.onerror = null;
          prevImage.src = '';
        }
        return finalImage;
      });

      setImageTransform({ x: 0, y: 0, scale: 1 });
      URL.revokeObjectURL(url);
    };

    img.onerror = () => {
      console.error('Image error');
      // Revoke URL to prevent memory leak
      URL.revokeObjectURL(url);
    };

    img.src = url;
  }, [cameraEnabled]);

  // Run face detection
  const runFaceDetection = useCallback(() => {
    const canvas = canvasRef.current;
    const detectionCanvas = detectionCanvasRef.current;
    const ctx = canvasCtxRef.current;
    const detectionCtx = detectionCtxRef.current;

    if (!canvas || !detectionCanvas || !ctx || !detectionCtx) return;

    detectionCtx.clearRect(0, 0, detectionCanvas.width, detectionCanvas.height);
    detectionCtx.drawImage(
      canvas,
      0,
      0,
      canvas.width,
      canvas.height,
      0,
      0,
      detectionCanvas.width,
      detectionCanvas.height
    );

    const imageData = detectionCtx.getImageData(0, 0, detectionCanvas.width, detectionCanvas.height);
    const pixels = imageData.data;

    const processedImage = processImageData(pixels, detectionCanvas.width, detectionCanvas.height);
    const detectedFaces = findFaces(
      processedImage.integralMatrix,
      processedImage.squaredIntegralMatrix,
      detectionCanvas.width,
      detectionCanvas.height,
      stepSizeRef.current,
      maxScaleRef.current,
      scaleStepRef.current
    );

    const feedToInputDiff = canvas.width / detectionCanvas.width;
    const filteredDetections = detectedFaces.filter((face) => face.confidency > detectionThresholdRef.current);

    if (detectedFaces.length > 0) {
      console.log(`Detected ${detectedFaces.length} faces (${filteredDetections.length} above threshold ${detectionThresholdRef.current})`);
    }

    // Draw detection boxes
    filteredDetections.forEach((face) => {
      ctx.beginPath();
      ctx.rect(
        face.x * feedToInputDiff,
        face.y * feedToInputDiff,
        WINDOW_SIZE * face.scaleFactor * feedToInputDiff,
        WINDOW_SIZE * face.scaleFactor * feedToInputDiff
      );
      ctx.strokeStyle = 'lime';
      ctx.lineWidth = 5;
      ctx.stroke();
    });

    setDetections(filteredDetections.map(face => ({
      ...face,
      x: face.x * feedToInputDiff,
      y: face.y * feedToInputDiff,
      scaleFactor: face.scaleFactor * feedToInputDiff,
    })));
  }, []); // No dependencies - uses refs instead

  // Draw frame
  const drawFrame = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvasCtxRef.current;

    if (!canvas || !ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (cameraEnabled && videoRef.current) {
      const video = videoRef.current;
      const videoWidth = video.videoWidth;
      const videoHeight = video.videoHeight;

      if (videoWidth && videoHeight) {
        // Calculate aspect ratios
        const canvasAspect = canvas.width / canvas.height;
        const videoAspect = videoWidth / videoHeight;

        let drawWidth, drawHeight, offsetX, offsetY;

        // Preserve aspect ratio and center the video
        if (videoAspect > canvasAspect) {
          // Video is wider than canvas - fit to width
          drawWidth = canvas.width;
          drawHeight = canvas.width / videoAspect;
          offsetX = 0;
          offsetY = (canvas.height - drawHeight) / 2;
        } else {
          // Video is taller than canvas - fit to height
          drawHeight = canvas.height;
          drawWidth = canvas.height * videoAspect;
          offsetX = (canvas.width - drawWidth) / 2;
          offsetY = 0;
        }

        // Fill the letterbox/pillarbox areas with black
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw video centered and aspect-ratio preserved
        ctx.drawImage(video, offsetX, offsetY, drawWidth, drawHeight);
      }
    } else if (uploadedImage) {
      const transform = imageTransformRef.current;
      const scaledWidth = uploadedImage.width * transform.scale;
      const scaledHeight = uploadedImage.height * transform.scale;
      ctx.drawImage(
        uploadedImage,
        transform.x,
        transform.y,
        scaledWidth,
        scaledHeight
      );

      // Draw instructions
      ctx.font = '40px Arial';
      ctx.fillStyle = 'white';
      ctx.strokeStyle = 'black';
      ctx.lineWidth = 1;
      ctx.fillText('Drag to move', 10, 50);
      ctx.strokeText('Drag to move', 10, 50);
      ctx.fillText('Scroll to zoom', 10, 100);
      ctx.strokeText('Scroll to zoom', 10, 100);
    }

    runFaceDetection();
  }, [cameraEnabled, uploadedImage, runFaceDetection]); // Removed imageTransform dependency

  // Animation loop - only run when camera is enabled or image is uploaded
  useEffect(() => {
    // Only run animation loop if there's something to display
    if (!cameraEnabled && !uploadedImage) {
      // Cancel any existing animation frame
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = undefined;
      }
      return;
    }

    const animate = () => {
      drawFrame();
      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [drawFrame, cameraEnabled, uploadedImage]);

  return {
    canvasRef,
    detectionCanvasRef,
    cameraEnabled,
    toggleCamera,
    handleImageUpload,
    uploadedImage,
    imageTransform,
    setImageTransform,
    detections,
    WINDOW_SIZE,
  };
}
