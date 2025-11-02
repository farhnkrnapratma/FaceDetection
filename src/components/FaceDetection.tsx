import { useRef, useState, useEffect } from "react";
import { useFaceDetection } from "@/hooks/useFaceDetection";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { stumpsJSON } from "@/lib/stumpsData";
import {
  Camera,
  Upload,
  Info,
  CameraOff,
  Maximize2,
  Github,
  Scale,
  Heart,
} from "lucide-react";

export function FaceDetection() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [detectionThreshold, setDetectionThreshold] = useState(300);
  const [isDragging, setIsDragging] = useState(false);
  const [lastMouse, setLastMouse] = useState({ x: 0, y: 0 });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [lastPinchDistance, setLastPinchDistance] = useState<number | null>(
    null,
  );
  const [cameraSupported, setCameraSupported] = useState(true);

  // Check camera support on mount
  useEffect(() => {
    const isSupported = !!(
      navigator.mediaDevices && navigator.mediaDevices.getUserMedia
    );
    const isSecure = window.isSecureContext;
    setCameraSupported(isSupported && isSecure);

    if (!isSecure && isSupported) {
      console.warn("Camera requires HTTPS on mobile devices");
    }
  }, []);

  const {
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
  } = useFaceDetection({
    stumpsData: stumpsJSON,
    detectionThreshold,
    stepSize: 1.5,
    maxScale: 5,
    scaleStep: 0.25,
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const zoomAmount = e.deltaY > 0 ? 0.9 : 1.1;
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      setImageTransform((prev) => ({
        x: mouseX - (mouseX - prev.x) * zoomAmount,
        y: mouseY - (mouseY - prev.y) * zoomAmount,
        scale: prev.scale * zoomAmount,
      }));
    };

    canvas.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      canvas.removeEventListener("wheel", onWheel);
    };
  }, [canvasRef, uploadedImage, cameraEnabled, setImageTransform]);

  const handleFileClick = () => {
    // Stop camera before opening file picker to prevent mobile browser crash
    if (cameraEnabled) {
      toggleCamera();
    }
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleImageUpload(file);
    }
  };

  // Touch/Mouse handlers for pan
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!cameraEnabled && uploadedImage) {
      e.preventDefault();
      setIsDragging(true);
      setLastMouse({ x: e.clientX, y: e.clientY });
      if (canvasRef.current) {
        canvasRef.current.style.cursor = "grabbing";
      }
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (isDragging) {
      e.preventDefault();
      const deltaX = e.clientX - lastMouse.x;
      const deltaY = e.clientY - lastMouse.y;
      setImageTransform((prev) => ({
        ...prev,
        x: prev.x + deltaX,
        y: prev.y + deltaY,
      }));
      setLastMouse({ x: e.clientX, y: e.clientY });
    }
  };

  const handlePointerUp = () => {
    setIsDragging(false);
    if (canvasRef.current) {
      canvasRef.current.style.cursor = "default";
    }
  };

  const handlePointerLeave = () => {
    setIsDragging(false);
    if (canvasRef.current) {
      canvasRef.current.style.cursor = "default";
    }
  };

  // Touch handlers for pinch-to-zoom
  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!cameraEnabled && uploadedImage && e.touches.length === 2) {
      e.preventDefault();
      const distance = Math.hypot(
        e.touches[0]!.clientX - e.touches[1]!.clientX,
        e.touches[0]!.clientY - e.touches[1]!.clientY,
      );
      setLastPinchDistance(distance);
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (
      !cameraEnabled &&
      uploadedImage &&
      e.touches.length === 2 &&
      lastPinchDistance !== null &&
      canvasRef.current
    ) {
      e.preventDefault();
      const distance = Math.hypot(
        e.touches[0]!.clientX - e.touches[1]!.clientX,
        e.touches[0]!.clientY - e.touches[1]!.clientY,
      );
      const scale = distance / lastPinchDistance;

      const canvas = canvasRef.current;
      const rect = canvas.getBoundingClientRect();
      const centerX =
        (e.touches[0]!.clientX + e.touches[1]!.clientX) / 2 - rect.left;
      const centerY =
        (e.touches[0]!.clientY + e.touches[1]!.clientY) / 2 - rect.top;

      setImageTransform((prev) => ({
        x: centerX - (centerX - prev.x) * scale,
        y: centerY - (centerY - prev.y) * scale,
        scale: prev.scale * scale,
      }));

      setLastPinchDistance(distance);
    }
  };

  const handleTouchEnd = () => {
    setLastPinchDistance(null);
  };

  // Fullscreen toggle
  const toggleFullscreen = async () => {
    if (!document.fullscreenElement) {
      await containerRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      await document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  return (
    <div
      ref={containerRef}
      className="min-h-screen flex flex-col bg-[hsl(var(--ctp-base))] text-[hsl(var(--ctp-text))]"
    >
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[hsl(var(--ctp-mantle))]/95 backdrop-blur-xl border-b border-[hsl(var(--ctp-surface0))] shadow-lg">
        <div className="container mx-auto px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[hsl(var(--ctp-mauve))] to-[hsl(var(--ctp-blue))] shadow-lg">
                <Camera className="h-5 w-5 text-[hsl(var(--ctp-crust))]" />
              </div>
              <div>
                <h1 className="text-lg sm:text-xl md:text-2xl font-bold bg-gradient-to-r from-[hsl(var(--ctp-mauve))] via-[hsl(var(--ctp-blue))] to-[hsl(var(--ctp-teal))] bg-clip-text text-transparent">
                  Barudak Penguin
                </h1>
                <p className="text-xs text-[hsl(var(--ctp-subtext0))]">
                  Viola-Jones Algorithm
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-[hsl(var(--ctp-surface0))]/50 rounded-lg border border-[hsl(var(--ctp-surface1))]">
                <div
                  className={`w-2 h-2 rounded-full ${cameraEnabled ? "bg-[hsl(var(--ctp-red))] animate-pulse shadow-lg shadow-[hsl(var(--ctp-red))]/50" : uploadedImage ? "bg-[hsl(var(--ctp-green))]" : "bg-[hsl(var(--ctp-overlay0))]"}`}
                />
                <span className="text-xs font-medium text-[hsl(var(--ctp-text))]">
                  {cameraEnabled
                    ? "Live"
                    : uploadedImage
                      ? "Analyzing"
                      : "Ready"}
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleFullscreen}
                className="flex hover:bg-[hsl(var(--ctp-surface0))]"
              >
                <Maximize2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 container mx-auto px-4 sm:px-6 py-4 sm:py-6 lg:py-8">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4 sm:gap-6">
          {/* Video/Canvas Section */}
          <div className="space-y-4">
            <Card className="bg-[hsl(var(--ctp-surface0))]/50 backdrop-blur-sm border-[hsl(var(--ctp-surface1))] shadow-2xl overflow-hidden">
              <CardContent className="p-3 sm:p-4 md:p-6">
                <div className="relative aspect-video bg-[hsl(var(--ctp-crust))] rounded-lg overflow-hidden border-2 border-[hsl(var(--ctp-surface1))]">
                  <canvas
                    style={{ touchAction: "none" }}
                    ref={canvasRef}
                    width={1280}
                    height={720}
                    className="w-full h-full object-contain touch-none"
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerLeave={handlePointerLeave}
                    onTouchStart={handleTouchStart}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                  />
                  <canvas
                    ref={detectionCanvasRef}
                    width={240}
                    height={135}
                    className="hidden"
                  />

                  {/* Overlay indicators */}
                  {!cameraEnabled && !uploadedImage && (
                    <div className="absolute inset-0 flex items-center justify-center bg-[hsl(var(--ctp-crust))]/50 backdrop-blur-sm">
                      <div className="text-center p-6">
                        <Camera className="h-12 w-12 sm:h-16 sm:w-16 mx-auto mb-4 text-[hsl(var(--ctp-overlay0))]" />
                        <p className="text-sm sm:text-base text-[hsl(var(--ctp-subtext0))]">
                          Start camera or upload an image
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Detection count badge */}
                  {detections.length > 0 && (
                    <div className="absolute top-3 right-3 px-3 py-1.5 bg-[hsl(var(--ctp-green))]/90 backdrop-blur-sm rounded-full shadow-lg shadow-[hsl(var(--ctp-green))]/20">
                      <span className="text-sm font-bold text-[hsl(var(--ctp-crust))]">
                        {detections.length} face
                        {detections.length !== 1 ? "s" : ""}
                      </span>
                    </div>
                  )}
                </div>

                {/* Controls */}
                <div className="mt-4 space-y-4">
                  {/* Action Buttons */}
                  <div className="flex flex-wrap gap-2 sm:gap-3">
                    <Button
                      onClick={toggleCamera}
                      variant={cameraEnabled ? "destructive" : "default"}
                      size="lg"
                      className="flex-1 min-w-[140px] font-semibold"
                      disabled={!cameraSupported}
                      title={
                        !cameraSupported
                          ? "Camera requires HTTPS on mobile"
                          : ""
                      }
                    >
                      {cameraEnabled ? (
                        <>
                          <CameraOff className="mr-2 h-5 w-5" />
                          <span className="hidden sm:inline">Stop Camera</span>
                          <span className="sm:hidden">Stop</span>
                        </>
                      ) : (
                        <>
                          <Camera className="mr-2 h-5 w-5" />
                          <span className="hidden sm:inline">Start Camera</span>
                          <span className="sm:hidden">Camera</span>
                        </>
                      )}
                    </Button>

                    <Button
                      onClick={handleFileClick}
                      variant="secondary"
                      size="lg"
                      className="flex-1 min-w-[140px] font-semibold"
                      disabled={cameraEnabled}
                    >
                      <Upload className="mr-2 h-5 w-5" />
                      <span className="hidden sm:inline">Upload Image</span>
                      <span className="sm:hidden">Upload</span>
                    </Button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleFileChange}
                    />
                  </div>

                  {/* Threshold Slider */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label
                        htmlFor="threshold"
                        className="text-sm font-medium text-[hsl(var(--ctp-text))]"
                      >
                        Detection Sensitivity
                      </Label>
                      <span className="text-sm font-mono font-bold text-[hsl(var(--ctp-mauve))] px-2 py-1 bg-[hsl(var(--ctp-surface1))] rounded">
                        {detectionThreshold}
                      </span>
                    </div>
                    <input
                      id="threshold"
                      type="range"
                      min="0"
                      max="600"
                      value={detectionThreshold}
                      onChange={(e) =>
                        setDetectionThreshold(Number(e.target.value))
                      }
                      className="w-full h-2 bg-[hsl(var(--ctp-surface1))] rounded-lg appearance-none cursor-pointer accent-[hsl(var(--ctp-mauve))]"
                    />
                    <div className="flex justify-between text-xs text-[hsl(var(--ctp-subtext0))]">
                      <span>More sensitive</span>
                      <span>Less sensitive</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Warning Card - Mobile */}
            {stumpsJSON.length === 0 && (
              <Card className="lg:hidden bg-[hsl(var(--ctp-yellow))]/10 backdrop-blur-sm border-[hsl(var(--ctp-yellow))]/30">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <Info className="h-5 w-5 text-[hsl(var(--ctp-yellow))] flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-[hsl(var(--ctp-yellow))]">
                        Training Data Required
                      </p>
                      <p className="text-xs text-[hsl(var(--ctp-subtext0))] mt-1">
                        Face detection requires training data. See
                        INTEGRATION_GUIDE.md for setup instructions.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* HTTPS Warning for Mobile */}
            {!cameraSupported && (
              <Card className="lg:hidden bg-[hsl(var(--ctp-red))]/10 backdrop-blur-sm border-[hsl(var(--ctp-red))]/30">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <Info className="h-5 w-5 text-[hsl(var(--ctp-red))] flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-[hsl(var(--ctp-red))]">
                        HTTPS Required for Camera
                      </p>
                      <p className="text-xs text-[hsl(var(--ctp-subtext0))] mt-1">
                        Camera access requires HTTPS on mobile. Please upload an
                        image instead, or access via HTTPS.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Info Sidebar */}
          <div className="space-y-4">
            {/* Statistics Card */}
            <Card className="bg-[hsl(var(--ctp-surface0))]/50 backdrop-blur-sm border-[hsl(var(--ctp-surface1))] shadow-xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg font-bold text-[hsl(var(--ctp-mauve))]">
                  Detection Stats
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-[hsl(var(--ctp-crust))]/50 rounded-lg border border-[hsl(var(--ctp-surface1))]">
                  <span className="text-sm text-[hsl(var(--ctp-subtext0))]">
                    Faces Found
                  </span>
                  <span className="text-2xl font-bold text-[hsl(var(--ctp-blue))]">
                    {detections.length}
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 bg-[hsl(var(--ctp-crust))]/50 rounded-lg border border-[hsl(var(--ctp-surface1))]">
                  <span className="text-sm text-[hsl(var(--ctp-subtext0))]">
                    Threshold
                  </span>
                  <span className="text-lg font-mono font-bold text-[hsl(var(--ctp-mauve))]">
                    {detectionThreshold}
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 bg-[hsl(var(--ctp-crust))]/50 rounded-lg border border-[hsl(var(--ctp-surface1))]">
                  <span className="text-sm text-[hsl(var(--ctp-subtext0))]">
                    Status
                  </span>
                  <span className="text-sm font-semibold text-[hsl(var(--ctp-green))]">
                    {cameraEnabled
                      ? "Live"
                      : uploadedImage
                        ? "Analyzing"
                        : "Idle"}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Instructions Card */}
            <Card className="bg-[hsl(var(--ctp-surface0))]/50 backdrop-blur-sm border-[hsl(var(--ctp-surface1))] shadow-xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg font-bold text-[hsl(var(--ctp-teal))] flex items-center gap-2">
                  <Info className="h-4 w-4" />
                  How to Use
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2.5 text-xs text-[hsl(var(--ctp-text))]">
                  <li className="flex items-start gap-2">
                    <Camera className="h-4 w-4 text-[hsl(var(--ctp-green))] flex-shrink-0 mt-0.5" />
                    <span>
                      Click "Start Camera" and allow permissions when prompted
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Upload className="h-4 w-4 text-[hsl(var(--ctp-blue))] flex-shrink-0 mt-0.5" />
                    <span>Upload an image file to analyze faces in photos</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[hsl(var(--ctp-peach))] font-bold flex-shrink-0">
                      ⚡
                    </span>
                    <span>
                      Drag to reposition and scroll/pinch to zoom images
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[hsl(var(--ctp-mauve))] font-bold flex-shrink-0">
                      🎚️
                    </span>
                    <span>
                      Adjust the sensitivity slider to fine-tune detection
                      accuracy
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Info className="h-4 w-4 text-[hsl(var(--ctp-yellow))] flex-shrink-0 mt-0.5" />
                    <span className="text-[hsl(var(--ctp-subtext0))]">
                      If camera fails, check browser permissions or upload an
                      image
                    </span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            {/* Warning Card - Desktop */}
            {stumpsJSON.length === 0 && (
              <Card className="hidden lg:block bg-[hsl(var(--ctp-yellow))]/10 backdrop-blur-sm border-[hsl(var(--ctp-yellow))]/30">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <Info className="h-5 w-5 text-[hsl(var(--ctp-yellow))] flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-[hsl(var(--ctp-yellow))]">
                        Training Data Required
                      </p>
                      <p className="text-xs text-[hsl(var(--ctp-subtext0))] mt-1">
                        See INTEGRATION_GUIDE.md for instructions on adding the
                        Viola-Jones cascade classifier data.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-[hsl(var(--ctp-surface0))] bg-[hsl(var(--ctp-mantle))]/95 backdrop-blur-md">
        <div className="container mx-auto px-4 sm:px-6 py-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-sm text-[hsl(var(--ctp-subtext0))]">
              <span>Built with</span>
              <Heart className="h-4 w-4 text-[hsl(var(--ctp-red))] fill-[hsl(var(--ctp-red))]" />
              <span>using</span>
              <a
                href="https://en.wikipedia.org/wiki/Viola%E2%80%93Jones_object_detection_framework"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[hsl(var(--ctp-mauve))] hover:text-[hsl(var(--ctp-lavender))] font-medium transition-colors"
              >
                Viola-Jones Algorithm
              </a>
            </div>

            <div className="flex items-center gap-4">
              <a
                href="https://github.com/elliottophellia/FaceDetection"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-[hsl(var(--ctp-subtext0))] hover:text-[hsl(var(--ctp-text))] transition-colors group"
              >
                <Github className="h-4 w-4 group-hover:text-[hsl(var(--ctp-lavender))]" />
                <span className="inline">Github Repository</span>
              </a>
              <span className="text-xs text-[hsl(var(--ctp-overlay0))]">•</span>
              <a
                href="https://github.com/elliottophellia/FaceDetection/blob/master/LICENSE.md"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-[hsl(var(--ctp-subtext0))] hover:text-[hsl(var(--ctp-text))] transition-colors group"
              >
                <Scale className="h-4 w-4 group-hover:text-[hsl(var(--ctp-lavender))]" />
                <span className="inline">Legal License</span>
              </a>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-[hsl(var(--ctp-surface0))] text-center">
            <p className="text-xs text-[hsl(var(--ctp-overlay0))]">
              Copyright © 2025 Barudak Penguin. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
