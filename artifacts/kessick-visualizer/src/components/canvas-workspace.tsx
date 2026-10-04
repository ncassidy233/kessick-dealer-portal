import { useAppStore, updateActiveInstances } from '@/store';
import { Upload, Image as ImageIcon, Trash2, Copy, BringToFront, SendToBack, MonitorOff, Layers, Layers2, AlignEndHorizontal, AlignHorizontalSpaceAround, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Stage, Layer, Image as KonvaImage, Rect, Transformer, Group, Text, Line, Circle } from 'react-konva';
import useImage from 'use-image';
import { useProducts, type Product } from '@/hooks/use-products';
import demoRoomImg from '@assets/kessick-room-demo.jpg';
import { Input } from '@/components/ui/input';
import { SurveyTools } from './survey-tools';
import { v4 as uuidv4 } from 'uuid';
import { distance, snapPoint } from '@/lib/geometry';
import { SurveyEntity, SurveyPoint } from '@/types/survey';
import {
  clampViewportZoom,
  createFitViewport,
  viewportFromStagePosition,
  viewportToStageTransform,
  zoomViewportAtPoint,
  type CanvasSize,
  type CanvasViewport,
  type ImageSize,
  type StageTransform,
} from '@/lib/canvas-viewport';
import { resolveProductForInstance } from '@/lib/catalog-domain';

const DESKTOP_FIT_PADDING = 24;
const MOBILE_FIT_PADDING = 8;

export function CanvasWorkspace() {
  const store = useAppStore();
  const { 
    roomImageDataUrl, setRoomImage, pixelsPerInch, 
    selectedIds, setSelectedIds, commit, mode, setMode,
    instances, entities, snapEnabled, roomImageError, roomImageId, roomImageDataId,
    canvasCoordinateVersion
  } = store;
  
  const { data: products } = useProducts();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeRoomImageDataUrl =
    roomImageDataId === roomImageId ? roomImageDataUrl : null;
  const [roomImage, roomImageStatus] = useImage(activeRoomImageDataUrl || '', 'anonymous');
  const imageDisplayStatus = roomImageError
    ? 'failed'
    : activeRoomImageDataUrl
      ? roomImageStatus
      : 'loading';
  const isLegacyCanvas = canvasCoordinateVersion !== 2;
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadError(null);
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const dataUrl = ev.target?.result as string;
        try {
          await setRoomImage(dataUrl);
          setMode('calibrate');
        } catch {
          setUploadError(
            'This room photo could not be saved. Check browser storage permissions and try again.',
          );
        }
      };
      reader.onerror = () => {
        setUploadError('This room photo could not be read. Choose a different image and try again.');
      };
      reader.readAsDataURL(file);
    }
    e.target.value = '';
  };

  const handleUseDemo = async () => {
    try {
      setUploadError(null);
      const res = await fetch(demoRoomImg);
      if (!res.ok) throw new Error('Demo image request failed');
      const blob = await res.blob();
      const reader = new FileReader();
      reader.onload = async (ev) => {
        try {
          await setRoomImage(ev.target?.result as string);
          setMode('calibrate');
        } catch {
          setUploadError('The demo room could not be saved in this browser. Please try again.');
        }
      };
      reader.onerror = () => setUploadError('The demo room could not be read. Please try again.');
      reader.readAsDataURL(blob);
    } catch {
      setUploadError('The demo room is temporarily unavailable. Upload a room photo instead.');
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedIds.length > 0 && e.target === document.body) {
        commit(s => {
          const s2 = updateActiveInstances(s, insts => insts.filter(i => !selectedIds.includes(i.instanceId)));
          return {
            ...s2,
            entities: s2.entities.filter(ent => !selectedIds.includes(ent.id))
          };
        });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedIds, commit]);

  const [draftPixelsPerInch, setDraftPixelsPerInch] = useState<number | null>(null);
  const [canvasSize, setCanvasSize] = useState<CanvasSize>({ width: 0, height: 0 });
  const [viewport, setViewport] = useState<CanvasViewport | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<any>(null);

  const imageSize = useMemo<ImageSize | null>(() => {
    if (!roomImage?.naturalWidth || !roomImage?.naturalHeight) return null;
    return { width: roomImage.naturalWidth, height: roomImage.naturalHeight };
  }, [roomImage]);
  const fitPadding = canvasSize.width > 0 && canvasSize.width < 768
    ? MOBILE_FIT_PADDING
    : DESKTOP_FIT_PADDING;
  const fitViewport = useMemo(
    () => imageSize ? createFitViewport(imageSize) : { centerX: 0, centerY: 0, zoom: 1 },
    [imageSize],
  );
  const resolvedViewport = viewport ?? fitViewport;
  const stageTransform = useMemo<StageTransform>(
    () => imageSize
      ? viewportToStageTransform(resolvedViewport, canvasSize, imageSize, fitPadding)
      : { x: 0, y: 0, scale: 1 },
    [resolvedViewport, canvasSize, imageSize, fitPadding],
  );

  useEffect(() => {
    setViewport(null);
    setDraftPixelsPerInch(null);
  }, [roomImageId]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !roomImageId) return;

    const updateSize = (width: number, height: number) => {
      setCanvasSize((current) => {
        if (
          Math.abs(current.width - width) < 0.5 &&
          Math.abs(current.height - height) < 0.5
        ) {
          return current;
        }
        return { width, height };
      });
    };
    const observer = new ResizeObserver(([entry]) => {
      if (entry) updateSize(entry.contentRect.width, entry.contentRect.height);
    });

    observer.observe(container);
    updateSize(container.clientWidth, container.clientHeight);
    return () => observer.disconnect();
  }, [roomImageId]);

  const fitToScreen = useCallback(() => {
    setViewport(null);
  }, []);

  const zoomBy = useCallback((factor: number) => {
    if (!imageSize) return;
    setViewport((current) => ({
      ...(current ?? createFitViewport(imageSize)),
      zoom: clampViewportZoom((current?.zoom ?? 1) * factor),
    }));
  }, [imageSize]);

  const [viewMode, setViewMode] = useState<'photo' | 'elevation'>('photo');

  const resetLegacyLayout = () => {
    const confirmed = window.confirm(
      'Resetting will remove the saved calibration, survey marks, and placed products from this room. The room photo and project details will remain. Export a backup first if you may need the original layout.',
    );
    if (!confirmed) return;

    commit((snapshot) => ({
      ...snapshot,
      canvasCoordinateVersion: 2,
      calibration: null,
      pixelsPerInch: null,
      entities: [],
      options: snapshot.options.map((option) => ({
        ...option,
        instances: [],
      })),
    }));
    setSelectedIds([]);
    setMode('calibrate');
  };

  if (!roomImageId) {
    return (
      <div className="flex-1 min-h-0 min-w-0 bg-background flex items-center justify-center p-4 relative z-0 bg-canvas-pattern">
        <div className="max-w-xl w-full p-10 flex flex-col items-center justify-center text-center gap-8 bg-card border border-border shadow-2xl animate-in fade-in zoom-in-95 duration-500">
          
          <div className="w-24 h-24 bg-primary/10 flex items-center justify-center text-primary shadow-inner mb-2 border border-primary/20">
            <Search className="w-10 h-10" />
          </div>
          
          <div>
            <h3 className="text-2xl font-sans font-bold uppercase tracking-widest text-primary mb-3">Begin Site Survey</h3>
            <p className="text-base text-muted-foreground max-w-md mx-auto font-medium">
              Upload a straight-on photo of the installation wall to calibrate dimensions and begin placing millwork.
            </p>
          </div>
          {(roomImageError || uploadError) && (
            <div role="alert" className="w-full border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive font-medium">
              {roomImageError || uploadError}
            </div>
          )}
          
          <div className="flex flex-col gap-4 w-full max-w-sm mt-4">
            <Button className="w-full bg-primary text-primary-foreground hover:bg-primary/90 h-12 text-base font-bold shadow-lg shadow-primary/20 transition-all hover:scale-[1.02]" onClick={() => fileInputRef.current?.click()} data-testid="btn-upload-browse">
              <Upload className="w-5 h-5 mr-2" />
              Upload Wall Photo
            </Button>
            
            <div className="relative my-2">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase font-bold tracking-widest">
                <span className="bg-card px-4 text-muted-foreground">Or</span>
              </div>
            </div>
            
            <Button variant="outline" className="w-full text-foreground border-border hover:bg-muted hover:text-foreground gap-2 h-12 text-base transition-all" onClick={handleUseDemo} data-testid="btn-demo-room">
              <ImageIcon className="w-5 h-5" />
              Use Demo Photo
            </Button>
          </div>
          <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleUpload} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-background relative overflow-hidden flex flex-col focus:outline-none bg-canvas-pattern" tabIndex={0}>
      {imageDisplayStatus === 'loaded' && !isLegacyCanvas && mode !== 'calibrate' && (
        <SurveyTools
          onZoomIn={() => zoomBy(1.2)}
          onZoomOut={() => zoomBy(1 / 1.2)}
          onFit={fitToScreen}
        />
      )}
      <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleUpload} />
      
      <div
        className="flex-1 relative shadow-inner"
        id="canvas-container"
        data-testid="canvas-container"
        data-image-left={imageSize ? stageTransform.x : undefined}
        data-image-top={imageSize ? stageTransform.y : undefined}
        data-image-width={imageSize ? imageSize.width * stageTransform.scale : undefined}
        data-image-height={imageSize ? imageSize.height * stageTransform.scale : undefined}
        data-project-image-id={roomImageId ?? undefined}
        data-room-image-id={roomImageDataId ?? undefined}
        ref={containerRef}
      >
        {imageDisplayStatus === 'loaded' && !isLegacyCanvas && (
          <div className="absolute top-2 right-2 md:top-4 md:right-4 z-10 bg-card/90 backdrop-blur-md shadow-xl border border-border flex items-center p-1">
          <button 
            className={`px-2.5 md:px-4 py-2 text-[10px] md:text-xs font-bold uppercase tracking-wider transition-colors ${viewMode === 'photo' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}
            onClick={() => setViewMode('photo')}
          >
            Photo View
          </button>
          <button 
            className={`px-2.5 md:px-4 py-2 text-[10px] md:text-xs font-bold uppercase tracking-wider transition-colors ${viewMode === 'elevation' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}
            onClick={() => setViewMode('elevation')}
          >
            Elevation
          </button>
          </div>
        )}

        {imageDisplayStatus === 'loading' && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/70">
            <div className="border border-border bg-card px-5 py-3 text-sm text-muted-foreground shadow-xl uppercase font-bold tracking-widest">
              Preparing room photo…
            </div>
          </div>
        )}

        {imageDisplayStatus === 'failed' && (
          <div className="absolute inset-0 z-20 flex items-center justify-center p-4 bg-background/90">
            <div className="max-w-sm border border-destructive/30 bg-card p-6 text-center shadow-2xl">
              <MonitorOff className="mx-auto mb-3 h-9 w-9 text-destructive" />
              <h3 className="font-sans font-bold uppercase tracking-widest text-lg text-foreground">Room photo unavailable</h3>
              <p className="mt-2 text-sm text-muted-foreground font-medium">
                This image could not be displayed. Replace it with the original photo or open the demo room.
              </p>
              <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                <Button className="flex-1" onClick={() => fileInputRef.current?.click()}>
                  <Upload className="mr-2 h-4 w-4" />
                  Replace Photo
                </Button>
                <Button className="flex-1" variant="outline" onClick={handleUseDemo}>
                  Use Demo
                </Button>
              </div>
            </div>
          </div>
        )}

        {imageDisplayStatus === 'loaded' && roomImage && imageSize && (
          <Scene
            key={roomImageId ?? 'room-image'}
            viewMode={viewMode}
            image={roomImage}
            imageSize={imageSize}
            size={canvasSize}
            viewport={resolvedViewport}
            stageTransform={stageTransform}
            fitPadding={fitPadding}
            onViewportChange={setViewport}
            stageRef={stageRef}
            onCalibrationDraftChange={setDraftPixelsPerInch}
          />
        )}

        {isLegacyCanvas && imageDisplayStatus === 'loaded' && (
          <div className="absolute inset-0 z-40 flex items-center justify-center bg-background/90 p-4 backdrop-blur-sm">
            <div className="w-full max-w-md border border-primary/40 bg-card p-6 text-center shadow-2xl">
              <Layers className="mx-auto mb-3 h-9 w-9 text-primary" />
              <h3 className="font-sans font-bold uppercase tracking-widest text-lg text-primary">Older room layout needs review</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                This project was saved before room photos used stable image coordinates. The original screen scale was not recorded, so converting its calibration and placements automatically could move them permanently.
              </p>
              <p className="mt-3 text-sm font-medium text-foreground">
                Export a backup from the header if needed, then reset this room to recalibrate it safely.
              </p>
              <Button className="mt-5 w-full" onClick={resetLegacyLayout}>
                Reset Layout &amp; Recalibrate
              </Button>
            </div>
          </div>
        )}
      </div>
      
      {mode === 'calibrate' && imageDisplayStatus === 'loaded' && !isLegacyCanvas && (
        <CalibrationOverlay
          draftPixelsPerInch={draftPixelsPerInch}
          onConfirm={() => {
            if (!draftPixelsPerInch) return;
            commit(s => ({ ...s, pixelsPerInch: draftPixelsPerInch }));
            setMode('select');
          }}
        />
      )}
      
      {!mode.includes('calibrate') && !pixelsPerInch && (
        <div className="absolute top-6 left-1/2 -translate-x-1/2 bg-destructive/90 backdrop-blur text-destructive-foreground px-6 py-3 shadow-2xl font-bold flex items-center gap-4 z-30 animate-in slide-in-from-top-4">
          <span className="tracking-wider uppercase text-sm">Scale not calibrated</span>
          <Button variant="secondary" size="sm" onClick={() => setMode('calibrate')} data-testid="btn-set-scale" className="text-xs h-7 bg-white text-destructive hover:bg-white/90">
            Set Scale
          </Button>
        </div>
      )}
    </div>
  );
}

function CalibrationOverlay({
  draftPixelsPerInch,
  onConfirm,
}: {
  draftPixelsPerInch: number | null;
  onConfirm: () => void;
}) {
  const { setMode } = useAppStore();
  
  return (
    <div className="absolute inset-x-3 bottom-3 bg-card/95 backdrop-blur-xl border border-primary p-4 shadow-2xl text-center z-30 flex flex-col gap-3 animate-in slide-in-from-bottom-4 fade-in md:inset-x-auto md:bottom-auto md:top-6 md:left-1/2 md:-translate-x-1/2 md:w-[420px] md:p-6 md:gap-5 md:slide-in-from-top-4">
      <div>
        <h4 className="font-sans font-bold uppercase tracking-widest text-lg text-primary mb-2">Calibrate Scale</h4>
        <p className="hidden text-sm font-medium text-muted-foreground leading-relaxed sm:block">
          Drag the endpoints to trace a known dimension (e.g., door width, wall height). Enter its real length.
        </p>
      </div>
      <div className="flex items-center gap-3">
        <Button variant="outline" className="flex-1 border-border hover:bg-muted h-10" onClick={() => setMode('select')}>
          Cancel
        </Button>
        <Button
          className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90 h-10 font-bold tracking-wider"
          onClick={onConfirm}
          disabled={!draftPixelsPerInch}
          data-testid="btn-confirm-scale"
        >
          Confirm Scale
        </Button>
      </div>
    </div>
  );
}

interface SceneProps {
  viewMode: 'photo' | 'elevation';
  image: HTMLImageElement;
  imageSize: ImageSize;
  size: CanvasSize;
  viewport: CanvasViewport;
  stageTransform: StageTransform;
  fitPadding: number;
  onViewportChange: (viewport: CanvasViewport) => void;
  stageRef: React.MutableRefObject<any>;
  onCalibrationDraftChange: (pixelsPerInch: number | null) => void;
}

function Scene({
  viewMode,
  image,
  imageSize,
  size,
  viewport,
  stageTransform,
  fitPadding,
  onViewportChange,
  stageRef,
  onCalibrationDraftChange,
}: SceneProps) {
  const store = useAppStore();
  const { mode, setMode, instances, entities, commit, selectedIds, setSelectedIds, snapEnabled, unit, pixelsPerInch } = store;
  const { data: products } = useProducts();
  const stagePos = { x: stageTransform.x, y: stageTransform.y };
  const stageScale = stageTransform.scale;

  useEffect(() => {
    if (!import.meta.env.DEV) return;

    const testWindow = window as Window & {
      __kessickInspectCanvas?: () => Array<{
        sku: string;
        dimensions: { widthIn: number; heightIn: number };
        productBounds: { x: number; y: number; width: number; height: number };
        renderKind: string | null;
        imageDescendantCount: number;
        label: {
          visible: boolean;
          text: string;
          screenFontSize: number;
          bounds: { x: number; y: number; width: number; height: number };
        } | null;
        transformer: {
          visible: boolean;
          bounds: { x: number; y: number; width: number; height: number };
          anchors: Array<{
            name: string;
            bounds: { x: number; y: number; width: number; height: number };
          }>;
        } | null;
      }>;
    };
    const readBounds = (node: any, skipStroke = false) => {
      const bounds = node.getClientRect({ skipShadow: true, skipStroke });
      return {
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
      };
    };

    testWindow.__kessickInspectCanvas = () => {
      const stage = stageRef.current;
      if (!stage) return [];

      return stage.find('.placed-product').map((productNode: any) => {
        const instanceId = productNode.getAttr('instanceId');
        const frame = productNode.findOne('.product-frame');
        const elevation = productNode.findOne('.dimensional-elevation');
        const label = stage
          .find('.product-dimension-label')
          .find((node: any) => node.getAttr('instanceId') === instanceId);
        const labelText = label?.findOne('.product-dimension-text');
        const transformer = stage
          .find('.product-transformer')
          .find((node: any) => node.getAttr('instanceId') === instanceId);
        const anchors = transformer
          ? transformer
              .getChildren()
              .filter((node: any) => node.hasName('_anchor') && node.visible())
              .map((node: any) => ({
                name: node
                  .name()
                  .split(/\s+/)
                  .find((name: string) => name !== '_anchor') ?? '',
                bounds: readBounds(node),
              }))
          : [];

        return {
          sku: productNode.getAttr('productSku'),
          dimensions: {
            widthIn: productNode.getAttr('productWidthIn'),
            heightIn: productNode.getAttr('productHeightIn'),
          },
          productBounds: readBounds(frame, true),
          renderKind: elevation?.name() ?? null,
          imageDescendantCount: productNode.find('Image').length,
          label: label && labelText ? {
            visible: label.visible() && labelText.visible(),
            text: labelText.text(),
            screenFontSize: labelText.fontSize() * labelText.getAbsoluteScale().y,
            bounds: readBounds(label),
          } : null,
          transformer: transformer ? {
            visible: transformer.visible(),
            bounds: readBounds(transformer),
            anchors,
          } : null,
        };
      });
    };

    return () => {
      delete testWindow.__kessickInspectCanvas;
    };
  }, [stageRef]);

  const handleWheel = (e: any) => {
    e.evt.preventDefault();
    const scaleBy = 1.05;
    const stage = stageRef.current;
    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    onViewportChange(
      zoomViewportAtPoint(
        viewport,
        pointer,
        e.evt.deltaY < 0 ? viewport.zoom * scaleBy : viewport.zoom / scaleBy,
        size,
        imageSize,
        fitPadding,
      ),
    );
  };

  const getSnappedPoint = (pt: SurveyPoint) => {
    if (!snapEnabled) return pt;
    const allPts: SurveyPoint[] = [];
    entities.forEach(e => {
      if (e.type === 'wall') allPts.push(...e.points);
      if (e.type === 'opening' || e.type === 'obstruction') {
        allPts.push({ x: e.rect.x, y: e.rect.y });
        allPts.push({ x: e.rect.x + e.rect.w, y: e.rect.y + e.rect.h });
      }
      if (e.type === 'measure') {
        allPts.push(e.start, e.end);
      }
    });
    return snapPoint(pt, allPts, 15 / stageScale);
  };

  // Drawing state
  const [drawingPoints, setDrawingPoints] = useState<SurveyPoint[]>([]);
  const [drawingRectStart, setDrawingRectStart] = useState<SurveyPoint | null>(null);
  const [currentMousePt, setCurrentMousePt] = useState<SurveyPoint | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
         if (mode === 'wall' && drawingPoints.length > 1) {
           commit(s => ({ ...s, entities: [...s.entities, { id: uuidv4(), type: 'wall', points: drawingPoints }] }));
         }
         setDrawingPoints([]);
         setDrawingRectStart(null);
         setMode('select');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [drawingPoints, mode, commit, setMode]);

  const onStageClick = (e: any) => {
    if (mode === 'select' || mode === 'pan') {
      const clickedOnEmpty = e.target === e.target.getStage() || e.target.name() === 'bg';
      if (clickedOnEmpty) {
        setSelectedIds([]);
      }
      return;
    }

    const stage = stageRef.current;
    const pointer = stage.getPointerPosition();
    if (!pointer) return;
    const rawPt = {
      x: (pointer.x - stage.x()) / stageScale,
      y: (pointer.y - stage.y()) / stageScale
    };
    const pt = getSnappedPoint(rawPt);

    if (mode === 'wall') {
      setDrawingPoints([...drawingPoints, pt]);
    } else if (mode === 'measure') {
      if (drawingPoints.length === 0) {
        setDrawingPoints([pt]);
      } else {
        const ent: SurveyEntity = { id: uuidv4(), type: 'measure', start: drawingPoints[0], end: pt };
        commit(s => ({ ...s, entities: [...s.entities, ent] }));
        setDrawingPoints([]);
        setMode('select');
      }
    } else if (mode === 'opening' || mode === 'obstruction') {
       if (!drawingRectStart) {
         setDrawingRectStart(pt);
       } else {
         const w = pt.x - drawingRectStart.x;
         const h = pt.y - drawingRectStart.y;
         const rect = { 
           x: w < 0 ? pt.x : drawingRectStart.x,
           y: h < 0 ? pt.y : drawingRectStart.y,
           w: Math.abs(w),
           h: Math.abs(h)
         };
         if (mode === 'opening') {
           const ent: SurveyEntity = { id: uuidv4(), type: 'opening', rect, openingType: 'door' };
           commit(s => ({ ...s, entities: [...s.entities, ent] }));
         } else {
           const ent: SurveyEntity = { id: uuidv4(), type: 'obstruction', rect, obstructionType: 'outlet' };
           commit(s => ({ ...s, entities: [...s.entities, ent] }));
         }
         setDrawingRectStart(null);
         setMode('select');
       }
    } else if (mode === 'annotation') {
       const ent: SurveyEntity = { id: uuidv4(), type: 'annotation', point: pt, text: 'New Note', severity: 'info' };
       commit(s => ({ ...s, entities: [...s.entities, ent], selectedIds: [ent.id] }));
       setMode('select');
    }
  };

  const onStageMouseMove = (e: any) => {
    if (mode === 'select' || mode === 'pan') return;
    const stage = stageRef.current;
    const pointer = stage.getPointerPosition();
    if (!pointer) return;
    const rawPt = {
      x: (pointer.x - stage.x()) / stageScale,
      y: (pointer.y - stage.y()) / stageScale
    };
    setCurrentMousePt(getSnappedPoint(rawPt));
  };

  // Calibration line
  const [calPts, setCalPts] = useState([
    { x: size.width/2 - 100, y: size.height/2 },
    { x: size.width/2 + 100, y: size.height/2 }
  ]);
  const [enteredInches, setEnteredInches] = useState("80");
  const calibrationInitializedRef = useRef(false);
  const calibrationInitializationPendingRef = useRef(false);

  useEffect(() => {
    if (mode === 'calibrate' && size.width > 0 && !calibrationInitializedRef.current) {
      onCalibrationDraftChange(null);
      calibrationInitializationPendingRef.current = true;
      setCalPts([
        { x: (size.width/2 - 100 - stagePos.x) / stageScale, y: (size.height/2 - stagePos.y) / stageScale },
        { x: (size.width/2 + 100 - stagePos.x) / stageScale, y: (size.height/2 - stagePos.y) / stageScale }
      ]);
      calibrationInitializedRef.current = true;
    } else if (mode !== 'calibrate') {
      calibrationInitializedRef.current = false;
      calibrationInitializationPendingRef.current = false;
    }
  }, [mode, size, stagePos, stageScale, onCalibrationDraftChange]);

  useEffect(() => {
    if (calibrationInitializationPendingRef.current) {
      calibrationInitializationPendingRef.current = false;
      return;
    }

    if (mode === 'calibrate' && calibrationInitializedRef.current && size.width > 0) {
      const dx = calPts[1].x - calPts[0].x;
      const dy = calPts[1].y - calPts[0].y;
      const pxLen = Math.sqrt(dx * dx + dy * dy);
      
      const val = parseFloat(enteredInches);
      if (val > 0) {
        const inches = unit === 'cm' ? val / 2.54 : val;
        onCalibrationDraftChange(pxLen / inches);
      } else {
        onCalibrationDraftChange(null);
      }
    }
  }, [calPts, enteredInches, mode, unit, size.width, onCalibrationDraftChange]);

  const renderEntities = () => {
    return entities.map(ent => {
      const isSel = selectedIds.includes(ent.id);
      const color = isSel ? '#d4af37' : '#9ca3af'; // Brass when selected
      
      if (ent.type === 'wall') {
        return (
          <Group key={ent.id} onClick={(e) => { e.cancelBubble=true; setSelectedIds([ent.id]); }}>
            <Line points={ent.points.flatMap(p => [p.x, p.y])} stroke={color} strokeWidth={4 / stageScale} lineJoin="round" shadowColor="black" shadowBlur={4 / stageScale} shadowOpacity={0.5} />
            {ent.points.map((p, i) => <Circle key={i} x={p.x} y={p.y} radius={5 / stageScale} fill={color} />)}
          </Group>
        );
      }
      if (ent.type === 'opening' || ent.type === 'obstruction') {
        return (
          <Group key={ent.id} onClick={(e) => { e.cancelBubble=true; setSelectedIds([ent.id]); }}>
            <Rect x={ent.rect.x} y={ent.rect.y} width={ent.rect.w} height={ent.rect.h} 
              stroke={color} strokeWidth={3 / stageScale} 
              fill={ent.type === 'opening' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(239, 68, 68, 0.15)'} 
            />
            <Text x={ent.rect.x} y={ent.rect.y - 18 / stageScale} text={ent.type === 'opening' ? ent.openingType : ent.obstructionType} fill={color} fontSize={14 / stageScale} fontStyle="bold" />
          </Group>
        );
      }
      if (ent.type === 'measure') {
        const pxLen = distance(ent.start, ent.end);
        const inLen = pixelsPerInch ? pxLen / pixelsPerInch : 0;
        const txt = unit === 'cm' ? `${(inLen * 2.54).toFixed(1)} cm` : `${inLen.toFixed(1)}"`;
        return (
          <Group key={ent.id} onClick={(e) => { e.cancelBubble=true; setSelectedIds([ent.id]); }}>
            <Line points={[ent.start.x, ent.start.y, ent.end.x, ent.end.y]} stroke={color} strokeWidth={3 / stageScale} dash={[8 / stageScale, 8 / stageScale]} />
            <Text x={(ent.start.x + ent.end.x)/2} y={(ent.start.y + ent.end.y)/2} text={txt} fill={color} fontSize={14 / stageScale} fontStyle="bold" shadowColor="rgba(0,0,0,0.8)" shadowBlur={2} />
          </Group>
        );
      }
      if (ent.type === 'annotation') {
        const bg = ent.severity === 'danger' ? '#ef4444' : ent.severity === 'warning' ? '#f59e0b' : '#3b82f6';
        return (
          <Group key={ent.id} x={ent.point.x} y={ent.point.y} onClick={(e) => { e.cancelBubble=true; setSelectedIds([ent.id]); }}>
            <Circle radius={12 / stageScale} fill={bg} shadowColor="black" shadowBlur={4} />
            <Text text="i" x={-4 / stageScale} y={-6 / stageScale} fill="white" fontSize={14 / stageScale} fontStyle="bold" />
            <Text text={ent.text} x={18 / stageScale} y={-6 / stageScale} fill={isSel ? '#d4af37' : 'white'} fontSize={16 / stageScale} fontStyle="bold" shadowColor="black" shadowBlur={4} />
          </Group>
        );
      }
      return null;
    });
  };

  return (
    <>
      <Stage
        width={size.width}
        height={size.height}
        ref={stageRef}
        draggable={mode === 'pan'}
        onWheel={handleWheel}
        onClick={onStageClick}
        onMouseMove={onStageMouseMove}
        x={stagePos.x}
        y={stagePos.y}
        scaleX={stageScale}
        scaleY={stageScale}
        onDragEnd={(e) => {
          if (e.target === stageRef.current) {
            onViewportChange(
              viewportFromStagePosition(
                { x: e.target.x(), y: e.target.y() },
                viewport.zoom,
                size,
                imageSize,
                fitPadding,
              ),
            );
          }
        }}
        className="absolute inset-0"
        style={{ cursor: mode === 'pan' ? 'grab' : mode === 'select' ? 'default' : 'crosshair' }}
      >
        <Layer>
          {viewMode === 'photo' && image && (
            <KonvaImage
              name="bg"
              image={image}
              x={0}
              y={0}
              width={imageSize.width}
              height={imageSize.height}
            />
          )}

          {renderEntities()}

          {!mode.includes('calibrate') && instances.map((inst) => (
            <ProductNode key={inst.instanceId} instanceId={inst.instanceId} stageScale={stageScale} viewMode={viewMode} />
          ))}

          {/* Active Drawing Overlays */}
          {mode === 'wall' && drawingPoints.length > 0 && currentMousePt && (
            <Group>
              <Line points={[...drawingPoints.flatMap(p=>[p.x, p.y]), currentMousePt.x, currentMousePt.y]} stroke="#d4af37" strokeWidth={4 / stageScale} />
            </Group>
          )}

          {mode === 'measure' && drawingPoints.length === 1 && currentMousePt && (
            <Group>
              <Line points={[drawingPoints[0].x, drawingPoints[0].y, currentMousePt.x, currentMousePt.y]} stroke="#d4af37" strokeWidth={3 / stageScale} dash={[8 / stageScale, 8 / stageScale]} />
            </Group>
          )}

          {(mode === 'opening' || mode === 'obstruction') && drawingRectStart && currentMousePt && (
             <Rect 
               x={Math.min(drawingRectStart.x, currentMousePt.x)}
               y={Math.min(drawingRectStart.y, currentMousePt.y)}
               width={Math.abs(currentMousePt.x - drawingRectStart.x)}
               height={Math.abs(currentMousePt.y - drawingRectStart.y)}
               stroke="#d4af37"
               strokeWidth={3 / stageScale}
               fill="rgba(212, 175, 55, 0.15)"
             />
          )}

          {/* Calibration Overlay */}
          {mode === 'calibrate' && (
            <Group>
              <Line
                points={[calPts[0].x, calPts[0].y, calPts[1].x, calPts[1].y]}
                stroke="#d4af37"
                strokeWidth={4 / stageScale}
                shadowColor="rgba(0,0,0,0.5)"
                shadowBlur={5}
              />
              <Circle
                x={calPts[0].x} y={calPts[0].y} radius={14 / stageScale} fill="#d4af37" draggable
                onDragMove={(e) => setCalPts([{ x: e.target.x(), y: e.target.y() }, calPts[1]])}
                shadowColor="rgba(0,0,0,0.5)" shadowBlur={5}
              />
              <Circle
                x={calPts[1].x} y={calPts[1].y} radius={14 / stageScale} fill="#d4af37" draggable
                onDragMove={(e) => setCalPts([calPts[0], { x: e.target.x(), y: e.target.y() }])}
                shadowColor="rgba(0,0,0,0.5)" shadowBlur={5}
              />
            </Group>
          )}
        </Layer>
      </Stage>

      {/* HTML Overlays */}
      {mode === 'calibrate' && size.width > 0 && (
        <div 
          className="absolute bg-card/90 backdrop-blur border border-primary p-2  shadow-2xl flex items-center gap-2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-auto z-30"
          style={{
            left: ((calPts[0].x + calPts[1].x) / 2) * stageScale + stagePos.x,
            top: ((calPts[0].y + calPts[1].y) / 2) * stageScale + stagePos.y - 50
          }}
        >
          <Input 
            className="w-24 h-9 text-center text-card-foreground bg-background font-bold text-lg border-border" 
            value={enteredInches} 
            onChange={(e) => setEnteredInches(e.target.value)} 
          />
          <span className="text-sm font-bold text-muted-foreground uppercase tracking-wider pr-2">{unit === 'cm' ? 'cm' : 'inches'}</span>
        </div>
      )}
    </>
  );
}

function ProductElevationGraphic({
  product,
  width,
  height,
  stageScale,
  viewMode,
  isSelected,
}: {
  product: Product;
  width: number;
  height: number;
  stageScale: number;
  viewMode: 'photo' | 'elevation';
  isSelected: boolean;
}) {
  const columns = Math.max(2, Math.min(12, Math.round(product.width_in / 4.5)));
  const estimatedCapacity = product.bottle_capacity ?? Math.max(24, Math.round((product.width_in * product.height_in) / 28));
  const rows = Math.max(4, Math.min(18, Math.ceil(estimatedCapacity / columns)));
  const frameInset = Math.max(3 / stageScale, Math.min(width, height) * 0.055);
  const innerWidth = Math.max(1, width - frameInset * 2);
  const innerHeight = Math.max(1, height - frameInset * 2);
  const cellWidth = innerWidth / columns;
  const cellHeight = innerHeight / rows;
  const bottleRadius = Math.max(
    1.2 / stageScale,
    Math.min(cellWidth * 0.28, cellHeight * 0.25),
  );
  const frameFill = viewMode === 'photo' ? 'rgba(43, 27, 19, 0.9)' : 'rgba(242, 238, 229, 0.96)';
  const railColor = viewMode === 'photo' ? '#8D794E' : '#4C412A';
  const bottleFill = viewMode === 'photo' ? '#120b0a' : '#ffffff';

  return (
    <Group name="dimensional-elevation">
      <Rect
        x={4 / stageScale}
        y={5 / stageScale}
        width={width}
        height={height}
        fill="rgba(0, 0, 0, 0.34)"
        shadowColor="rgba(0, 0, 0, 0.55)"
        shadowBlur={12 / stageScale}
      />
      <Rect
        name="product-frame"
        width={width}
        height={height}
        fill={frameFill}
        stroke={isSelected ? '#C4A574' : railColor}
        strokeWidth={(isSelected ? 3 : 1.5) / stageScale}
      />
      <Rect
        x={frameInset}
        y={frameInset}
        width={innerWidth}
        height={innerHeight}
        fill={viewMode === 'photo' ? 'rgba(10, 7, 6, 0.68)' : 'rgba(255, 255, 255, 0.72)'}
        stroke={railColor}
        strokeWidth={1 / stageScale}
      />
      {Array.from({ length: rows + 1 }, (_, row) => (
        <Line
          key={`rail-${row}`}
          points={[
            frameInset,
            frameInset + row * cellHeight,
            width - frameInset,
            frameInset + row * cellHeight,
          ]}
          stroke={railColor}
          strokeWidth={Math.max(0.8 / stageScale, cellHeight * 0.08)}
          opacity={0.9}
        />
      ))}
      {Array.from({ length: rows * columns }, (_, index) => {
        const column = index % columns;
        const row = Math.floor(index / columns);
        if (product.bottle_capacity !== null && index >= product.bottle_capacity) return null;
        return (
          <Circle
            key={`bottle-${index}`}
            x={frameInset + cellWidth * (column + 0.5)}
            y={frameInset + cellHeight * (row + 0.5)}
            radius={bottleRadius}
            fill={bottleFill}
            stroke={viewMode === 'photo' ? '#b99a67' : '#4C412A'}
            strokeWidth={0.7 / stageScale}
          />
        );
      })}
      <Line
        points={[0, 0, width, 0]}
        stroke="#C4A574"
        strokeWidth={2 / stageScale}
      />
    </Group>
  );
}

function ProductNode({ instanceId, stageScale, viewMode }: { instanceId: string, stageScale: number, viewMode: 'photo' | 'elevation' }) {
  const store = useAppStore();
  const { instances, commit, selectedIds, setSelectedIds, pixelsPerInch, unit, mode } = store;
  const { data: products } = useProducts();
  const inst = instances.find(i => i.instanceId === instanceId);
  const product = inst ? resolveProductForInstance(inst, products ?? []) : undefined;
  const trRef = useRef<any>(null);
  const groupRef = useRef<any>(null);

  const isSelected = selectedIds.includes(instanceId);

  useEffect(() => {
    if (isSelected && trRef.current && groupRef.current) {
      if (selectedIds.length === 1) {
        trRef.current.nodes([groupRef.current]);
        trRef.current.getLayer().batchDraw();
      } else {
        trRef.current.nodes([]);
      }
    }
  }, [isSelected, selectedIds.length]);

  if (!inst || !product || !pixelsPerInch) return null;

  const w = product.width_in * pixelsPerInch;
  const h = product.height_in * pixelsPerInch;
  const renderScaleX = product.customizable ? inst.scaleX : 1;
  const renderScaleY = product.customizable ? inst.scaleY : 1;
  const renderedWidth = w * renderScaleX;
  const renderedHeight = h * renderScaleY;

  const handleSelect = (e: any) => {
    if (mode !== 'select') return;
    e.cancelBubble = true;
    const isShift = e.evt.shiftKey;
    if (isShift) {
      if (isSelected) {
        setSelectedIds(selectedIds.filter(id => id !== instanceId));
      } else {
        setSelectedIds([...selectedIds, instanceId]);
      }
    } else {
      setSelectedIds([instanceId]);
    }
  };

  const getDimText = () => {
    const wVal = product.width_in * renderScaleX;
    const hVal = product.height_in * renderScaleY;
    if (unit === 'cm') return `${(wVal * 2.54).toFixed(1)} cm W × ${(hVal * 2.54).toFixed(1)} cm H`;
    return `${wVal.toFixed(1)}" W × ${hVal.toFixed(1)}" H`;
  };

  return (
    <>
      <Group
        ref={groupRef}
        name="placed-product"
        instanceId={instanceId}
        productSku={product.sku}
        productWidthIn={product.width_in}
        productHeightIn={product.height_in}
        x={inst.x} y={inst.y} scaleX={renderScaleX} scaleY={renderScaleY} rotation={inst.rotation} opacity={inst.opacity}
        draggable={mode === 'select'}
        onClick={handleSelect} onTap={handleSelect} onDragStart={handleSelect}
        onDragEnd={(e) => {
          commit(s => updateActiveInstances(s, insts => insts.map(i => i.instanceId === instanceId ? { ...i, x: e.target.x(), y: e.target.y() } : i)));
        }}
        onTransformEnd={(e) => {
          const node = groupRef.current;
          commit(s => updateActiveInstances(s, insts => insts.map(i => i.instanceId === instanceId ? { 
            ...i, 
            x: node.x(),
            y: node.y(),
            scaleX: product.customizable ? node.scaleX() : 1,
            scaleY: product.customizable ? node.scaleY() : 1,
            rotation: node.rotation(),
            customSized: product.customizable && (node.scaleX() !== 1 || node.scaleY() !== 1)
          } : i)));
        }}
      >
        <ProductElevationGraphic
          product={product}
          width={w}
          height={h}
          stageScale={stageScale}
          viewMode={viewMode}
          isSelected={isSelected}
        />
        
        {/* Lighting Indicator */}
        {inst.lighting?.enabled && viewMode === 'photo' && store.activeOption.presentationSettings.showLighting && (
          <Rect x={0} y={-4 / stageScale} width={w} height={4 / stageScale} fill="rgba(255, 240, 180, 0.9)" shadowColor="rgba(255, 240, 180, 1)" shadowBlur={25 / stageScale} shadowOffsetY={10 / stageScale} />
        )}
        {inst.lighting?.enabled && viewMode === 'elevation' && store.activeOption.presentationSettings.showLighting && (
          <Line points={[0, 0, w, 0]} stroke="#facc15" strokeWidth={4 / stageScale} dash={[10 / stageScale, 5 / stageScale]} />
        )}
        
      </Group>

      {isSelected && selectedIds.length === 1 && store.activeOption.presentationSettings.showDimensions && (
        <Group
          name="product-dimension-label"
          instanceId={instanceId}
          x={inst.x}
          y={inst.y + renderedHeight + 10 / stageScale}
          listening={false}
        >
          <Rect
            width={Math.max(renderedWidth, 150 / stageScale)}
            height={28 / stageScale}
            fill="rgba(20, 18, 16, 0.94)"
            stroke="#C4A574"
            strokeWidth={1 / stageScale}
          />
          <Text
            name="product-dimension-text"
            text={getDimText()}
            fill="#C4A574"
            fontSize={12 / stageScale}
            fontStyle="bold"
            width={Math.max(renderedWidth, 150 / stageScale)}
            align="center"
            y={7 / stageScale}
          />
        </Group>
      )}

      {isSelected && selectedIds.length === 1 && mode === 'select' && (
        <Transformer
          ref={trRef}
          name="product-transformer"
          instanceId={instanceId}
          boundBoxFunc={(oldBox, newBox) => newBox}
          enabledAnchors={product.customizable ? ['top-left', 'top-right', 'bottom-left', 'bottom-right', 'top-center', 'bottom-center', 'middle-left', 'middle-right'] : []}
          keepRatio={!product.customizable}
          anchorSize={12}
          anchorCornerRadius={6}
          anchorFill="#d4af37"
          anchorStroke="rgba(24, 22, 20, 1)"
          anchorStrokeWidth={2}
          borderStroke="#d4af37"
          borderStrokeWidth={3}
        />
      )}
    </>
  );
}
