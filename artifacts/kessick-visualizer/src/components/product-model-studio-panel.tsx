import { useMemo, useRef, useState } from 'react';
import { Box, Check, Download, FileImage, Rotate3D, ShieldAlert, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Slider } from '@/components/ui/slider';
import {
  createReferenceGlb,
  downloadBlob,
  normalizeProductImage,
  type NormalizedProductImage,
} from '@/lib/glb-reference-model';

interface ProductModelStudioPanelProps {
  onClose?: () => void;
}

type ProcessStatus = 'idle' | 'normalizing' | 'ready' | 'exporting' | 'error';

export function ProductModelStudioPanel({ onClose }: ProductModelStudioPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [sourceName, setSourceName] = useState('');
  const [normalized, setNormalized] = useState<NormalizedProductImage | null>(null);
  const [status, setStatus] = useState<ProcessStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [tolerance, setTolerance] = useState(48);
  const [widthIn, setWidthIn] = useState(18);
  const [heightIn, setHeightIn] = useState(78);
  const [depthIn, setDepthIn] = useState(12);
  const [rotation, setRotation] = useState(-9);

  const dimensionsValid = widthIn > 0 && heightIn > 0 && depthIn > 0;
  const safeName = useMemo(
    () => (sourceName.replace(/\.[^.]+$/, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'kessick-reference').toLowerCase(),
    [sourceName],
  );

  const processFile = async (file: File) => {
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setError('Choose a PNG, JPEG, or WebP product image.');
      setStatus('error');
      return;
    }
    setSourceName(file.name);
    setStatus('normalizing');
    setError(null);
    try {
      setNormalized(await normalizeProductImage(file, tolerance));
      setStatus('ready');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The product image could not be processed.');
      setStatus('error');
    }
  };

  const handleExport = async () => {
    if (!normalized || !dimensionsValid) return;
    setStatus('exporting');
    setError(null);
    try {
      const glb = await createReferenceGlb(normalized.png, { widthIn, heightIn, depthIn });
      downloadBlob(glb, `${safeName}-visual-reference.glb`);
      setStatus('ready');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The GLB reference could not be created.');
      setStatus('error');
    }
  };

  return (
    <div className="flex h-full w-full shrink-0 flex-col overflow-hidden bg-sidebar">
      <div className="flex shrink-0 items-center justify-between border-b border-border bg-sidebar/50 p-4">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-foreground">
            <Rotate3D className="h-4 w-4 text-primary" />
            3D / AR Asset Studio
          </h2>
          <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">
            Isolated Product Imagery
          </p>
        </div>
        {onClose && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground md:hidden"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      <ScrollArea className="flex-1">
        <div className="space-y-5 p-4">
          <div className="border border-primary/30 bg-primary/5 p-3">
            <div className="flex gap-2">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-foreground">
                  Visual reference, not CAD
                </p>
                <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                  The export uses your confirmed envelope dimensions and uploaded elevation. It is suitable for client visualization and AR blocking, never fabrication.
                </p>
              </div>
            </div>
          </div>

          <section className="space-y-3">
            <div className="flex items-end justify-between border-b border-border pb-2">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-foreground">1. Product elevation</p>
                <p className="mt-1 text-[10px] text-muted-foreground">PNG, JPEG, or WebP · isolated front view</p>
              </div>
              {normalized && <Check className="h-4 w-4 text-primary" />}
            </div>
            <input
              ref={inputRef}
              type="file"
              className="hidden"
              accept="image/png,image/jpeg,image/webp"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void processFile(file);
                event.target.value = '';
              }}
            />
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="group flex min-h-24 w-full items-center gap-3 border border-dashed border-border bg-background/40 p-4 text-left transition-colors hover:border-primary/60 hover:bg-primary/5"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center border border-border bg-card text-muted-foreground group-hover:text-primary">
                <FileImage className="h-5 w-5" />
              </span>
              <span>
                <span className="block text-xs font-semibold text-foreground">
                  {sourceName || 'Choose an isolated product photo'}
                </span>
                <span className="mt-1 block text-[10px] text-muted-foreground">
                  {status === 'normalizing' ? 'Normalizing transparency…' : 'Opaque edge backgrounds are removed automatically.'}
                </span>
              </span>
            </button>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Background tolerance</Label>
                <span className="font-mono text-[10px] text-primary">{tolerance}</span>
              </div>
              <Slider value={[tolerance]} min={16} max={96} step={4} onValueChange={([value]) => setTolerance(value)} />
              <p className="text-[10px] leading-relaxed text-muted-foreground">
                Re-upload after adjusting. Transparent PNGs pass through without removal.
              </p>
            </div>
          </section>

          {normalized && (
            <section className="space-y-3">
              <div className="border-b border-border pb-2">
                <p className="text-xs font-bold uppercase tracking-wider text-foreground">Normalized cutout</p>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  {normalized.outputWidth} × {normalized.outputHeight}px · {Math.round(normalized.transparentPixelRatio * 100)}% transparent
                </p>
              </div>
              <div className="relative flex h-52 items-center justify-center overflow-hidden border border-border bg-[linear-gradient(45deg,#171717_25%,transparent_25%),linear-gradient(-45deg,#171717_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#171717_75%),linear-gradient(-45deg,transparent_75%,#171717_75%)] bg-[length:20px_20px] bg-[position:0_0,0_10px,10px_-10px,-10px_0px]">
                <div
                  className="relative max-h-[82%] max-w-[72%] transition-transform duration-300"
                  style={{ transform: `perspective(700px) rotateY(${rotation}deg)` }}
                >
                  <img src={normalized.dataUrl} alt="Normalized product elevation" className="max-h-40 max-w-full object-contain drop-shadow-2xl" />
                  <span className="absolute inset-y-[4%] left-full w-3 origin-left bg-gradient-to-r from-[#4b3727] to-[#18130f]" />
                </div>
                <button
                  type="button"
                  className="absolute bottom-2 right-2 border border-border bg-background/80 px-2 py-1 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground"
                  onClick={() => setRotation((value) => (value <= -18 ? 18 : value - 9))}
                >
                  Rotate preview
                </button>
              </div>
              <Button
                variant="outline"
                className="w-full gap-2 rounded-none text-[10px] font-bold uppercase tracking-wider"
                onClick={() => downloadBlob(normalized.png, `${safeName}-normalized.png`)}
              >
                <Download className="h-3.5 w-3.5" />
                Download normalized PNG
              </Button>
            </section>
          )}

          <section className="space-y-3">
            <div className="border-b border-border pb-2">
              <p className="text-xs font-bold uppercase tracking-wider text-foreground">2. Confirm envelope</p>
              <p className="mt-1 text-[10px] text-muted-foreground">Use verified overall product dimensions only.</p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1.5">
                <Label className="text-[10px] text-muted-foreground">Width (in)</Label>
                <Input className="h-8 rounded-none text-xs" type="number" min="0.1" step="0.1" value={widthIn} onChange={(event) => setWidthIn(Number(event.target.value))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] text-muted-foreground">Height (in)</Label>
                <Input className="h-8 rounded-none text-xs" type="number" min="0.1" step="0.1" value={heightIn} onChange={(event) => setHeightIn(Number(event.target.value))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] text-muted-foreground">Depth (in)</Label>
                <Input className="h-8 rounded-none text-xs" type="number" min="0.1" step="0.1" value={depthIn} onChange={(event) => setDepthIn(Number(event.target.value))} />
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <div className="border-b border-border pb-2">
              <p className="text-xs font-bold uppercase tracking-wider text-foreground">3. Export reference model</p>
              <p className="mt-1 text-[10px] text-muted-foreground">GLB uses meter units for WebXR and Android AR viewers.</p>
            </div>
            <Button
              className="h-11 w-full gap-2 rounded-none text-xs font-bold uppercase tracking-wider"
              disabled={!normalized || !dimensionsValid || status === 'exporting'}
              onClick={() => void handleExport()}
            >
              <Box className="h-4 w-4" />
              {status === 'exporting' ? 'Building GLB…' : 'Build & download GLB'}
            </Button>
            <p className="text-[10px] leading-relaxed text-muted-foreground">
              The GLB contains a textured front elevation and a dimensional depth envelope. Full volumetric product geometry still requires approved CAD or an external photogrammetry service.
            </p>
          </section>

          {error && (
            <div role="alert" className="border border-destructive/50 bg-destructive/10 p-3 text-[11px] text-destructive">
              {error}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}