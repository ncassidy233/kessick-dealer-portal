import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { BrandLogo } from '@/components/brand-logo';
import { Play, Pause, ChevronLeft, ChevronRight, Wand2, Box, Home, ArrowRight, Camera, Check, Send, Search } from 'lucide-react';
import demoRoomImg from '@assets/generated_images/kessick-empty-hospitality-room.jpg';
import { AnimatePresence, motion } from 'framer-motion';

type Scene = 'product-studio' | 'empty-room' | 'product-in-room' | 'switch-finish' | 'cta';

const SCENE_ORDER: Scene[] = [
  'product-studio',
  'empty-room',
  'product-in-room',
  'switch-finish',
  'cta'
];

const SCENE_DURATIONS: Record<Scene, number> = {
  'product-studio': 4000,
  'empty-room': 6000,
  'product-in-room': 5000,
  'switch-finish': 6000,
  'cta': 6000,
};

const SCENE_LABELS: Record<Scene, string> = {
  'product-studio': 'Product',
  'empty-room': 'Empty Room',
  'product-in-room': 'Product In Room',
  'switch-finish': 'Finish',
  'cta': 'Next Steps',
};

const SCENE_BUSINESS_VALUE: Record<Scene, string> = {
  'product-studio': 'Premium Architectural Wine Storage',
  'empty-room': 'Start with real context: the actual space',
  'product-in-room': 'Believable true-scale concepts build confidence immediately',
  'switch-finish': 'Instantly validate aesthetic choices without waiting for new renders',
  'cta': 'Connects inspiration directly to a sales lead',
};

export default function DemoPresentationPage() {
  const [currentSceneIndex, setCurrentSceneIndex] = useState(0);
  const [isAutoplay, setIsAutoplay] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const currentScene = SCENE_ORDER[currentSceneIndex];

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const autoplayRef = useRef(false);

  useEffect(() => {
    const img = new Image();
    img.src = demoRoomImg;
    img.onload = () => {
      setIsLoaded(true);
    };
    img.onerror = () => {
      setIsLoaded(true);
    };
  }, []);

  useEffect(() => {
    if (isAutoplay && isLoaded) {
      timerRef.current = setTimeout(() => {
        if (!autoplayRef.current) return;
        if (currentSceneIndex < SCENE_ORDER.length - 1) {
          setCurrentSceneIndex(currentSceneIndex + 1);
        } else {
          autoplayRef.current = false;
          setIsAutoplay(false);
        }
      }, SCENE_DURATIONS[currentScene]);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [currentScene, isAutoplay, isLoaded]);

  const stopAutoplay = () => {
    autoplayRef.current = false;
    setIsAutoplay(false);
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const handleNext = () => {
    stopAutoplay();
    setCurrentSceneIndex(Math.min(currentSceneIndex + 1, SCENE_ORDER.length - 1));
  };

  const handlePrev = () => {
    if (currentSceneIndex > 0) {
      stopAutoplay();
      setCurrentSceneIndex(currentSceneIndex - 1);
    }
  };

  const toggleAutoplay = () => {
    setIsAutoplay(previous => {
      const next = !previous;
      autoplayRef.current = next;
      if (!next && timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      return next;
    });
  };

  if (!isLoaded) {
    return (
      <div className="min-h-[100dvh] bg-background text-foreground flex flex-col items-center justify-center font-sans">
        <BrandLogo tone="dark" className="h-10 opacity-50 animate-pulse mb-6" />
        <p className="text-[10px] uppercase tracking-widest text-primary font-semibold">Loading Experience</p>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] w-full max-w-[100vw] bg-background text-foreground flex flex-col font-sans overflow-hidden">
      {/* Header */}
      <header className="absolute top-0 left-0 right-0 p-4 sm:p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-0 z-50 pointer-events-none">
        <BrandLogo tone="dark" className="h-5 sm:h-6 opacity-80" />
        <div className="bg-primary/10 text-primary px-2 py-1 sm:px-3 sm:py-1.5 uppercase tracking-widest text-[8px] sm:text-[10px] font-bold border border-primary/20 pointer-events-auto backdrop-blur-sm shadow-sm">
          Concept Demo / Future Experience
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 relative flex items-center justify-center px-0 sm:px-6 mt-16 sm:mt-0 mb-32 sm:mb-0 w-full overflow-hidden">
        <SceneRenderer key={currentScene} scene={currentScene} />
      </main>

      {/* Business Value Footer Context */}
      <div className="absolute bottom-20 sm:bottom-24 left-0 right-0 flex justify-center pointer-events-none z-40 px-4">
        <motion.div
          key={`bv-${currentScene}`}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="bg-card/80 backdrop-blur-md border border-border px-4 py-2 sm:px-6 sm:py-3 max-w-2xl text-center shadow-2xl"
        >
          <p className="text-xs sm:text-sm font-medium text-foreground tracking-wide">
            {SCENE_BUSINESS_VALUE[currentScene]}
          </p>
        </motion.div>
      </div>

      {/* Controls Footer */}
      <footer className="absolute bottom-0 left-0 right-0 p-3 sm:p-4 border-t border-border bg-sidebar/95 backdrop-blur-md z-50 flex items-center justify-between gap-2 sm:gap-4 overflow-hidden">
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="icon"
            onClick={toggleAutoplay}
            className="w-8 h-8 sm:w-10 sm:h-10 border-border bg-background hover:bg-muted shrink-0"
            title={isAutoplay ? "Pause Presentation" : "Play Presentation"}
          >
            {isAutoplay ? <Pause className="w-3 h-3 sm:w-4 sm:h-4 text-primary" /> : <Play className="w-3 h-3 sm:w-4 sm:h-4 text-primary" />}
          </Button>
          <div className="hidden sm:block text-xs uppercase tracking-widest text-muted-foreground ml-2 font-semibold">
            {isAutoplay ? "Autoplaying" : "Paused"}
          </div>
        </div>

        <div className="flex items-center justify-center flex-1 max-w-[200px] sm:max-w-none overflow-hidden">
          <div className="flex items-center gap-1 sm:gap-2 flex-wrap justify-center">
            {SCENE_ORDER.map((s, i) => (
              <button
                type="button"
                key={s}
                className={`h-1.5 sm:h-1.5 w-3 sm:w-8 transition-colors duration-500 cursor-pointer rounded-full sm:rounded-none ${i <= currentSceneIndex ? 'bg-primary' : 'bg-muted'}`}
                onClick={() => {
                  stopAutoplay();
                  setCurrentSceneIndex(i);
                }}
                aria-label={`Go to ${SCENE_LABELS[s]}`}
                title={SCENE_LABELS[s]}
              />
            ))}
          </div>
        </div>

        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          <Button
            variant="outline"
            onClick={handlePrev}
            disabled={currentSceneIndex === 0}
            className="border-border bg-background hover:bg-muted h-8 sm:h-10 px-2 sm:px-4"
          >
            <ChevronLeft className="w-4 h-4 sm:mr-1" /> <span className="hidden sm:inline">Prev</span>
          </Button>
          <Button
            variant="default"
            onClick={handleNext}
            disabled={currentSceneIndex === SCENE_ORDER.length - 1}
            className="bg-primary text-primary-foreground hover:bg-primary/90 h-8 sm:h-10 px-2 sm:px-4"
          >
            <span className="hidden sm:inline">Next</span> <ChevronRight className="w-4 h-4 sm:ml-1" />
          </Button>
        </div>
      </footer>
    </div>
  );
}

function SceneRenderer({ scene }: { scene: Scene }) {
  switch (scene) {
    case 'product-studio':
      return <SceneProductStudio />;
    case 'empty-room':
      return <SceneEmptyRoom />;
    case 'product-in-room':
      return <SceneProductInRoom />;
    case 'switch-finish':
      return <SceneSwitchFinish />;
    case 'cta':
      return <SceneCTA />;
    default:
      return null;
  }
}

// Scene Components

function SceneProductStudio() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="w-full max-w-5xl aspect-[4/3] sm:aspect-[16/9] relative bg-neutral-900 border border-border flex items-center justify-center overflow-hidden"
    >
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-neutral-800 to-neutral-950" />
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="w-[50%] sm:w-[35%] h-[60%] sm:h-[70%] z-10"
      >
        <KessickTowerElevation finish="walnut" />
      </motion.div>
      <div className="absolute top-2 left-2 sm:top-4 sm:left-4 z-20">
        <div className="bg-card/90 backdrop-blur border border-border px-2 py-1 sm:px-3 sm:py-1.5 flex items-center gap-1.5 sm:gap-2 shadow-lg">
          <Box className="w-3 h-3 sm:w-4 sm:h-4 text-primary" />
          <span className="text-[10px] sm:text-xs uppercase tracking-widest font-semibold">Studio View</span>
        </div>
      </div>
    </motion.div>
  );
}

function SceneEmptyRoom() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="w-full max-w-5xl aspect-[4/3] sm:aspect-[16/9] relative bg-black border border-border"
    >
      <img
        src={demoRoomImg}
        alt="Empty room"
        className="w-full h-full object-cover"
      />
      <div className="absolute top-2 left-2 sm:top-4 sm:left-4 z-20">
        <div className="bg-card/90 backdrop-blur border border-border px-2 py-1 sm:px-3 sm:py-1.5 flex items-center gap-1.5 sm:gap-2 shadow-lg">
          <Camera className="w-3 h-3 sm:w-4 sm:h-4 text-primary" />
          <span className="text-[10px] sm:text-xs uppercase tracking-widest font-semibold">Hospitality Space</span>
        </div>
      </div>
    </motion.div>
  );
}

function SceneProductInRoom() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="w-full max-w-5xl aspect-[4/3] sm:aspect-[16/9] relative bg-black border border-border"
    >
      <img
        src={demoRoomImg}
        alt="Room background"
        className="w-full h-full object-cover"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.3, duration: 0.8 }}
        className="absolute bottom-[17%] left-[42%] w-[15.8%] h-[50%] z-10 drop-shadow-[0_18px_30px_rgba(0,0,0,0.75)] [transform:perspective(900px)_rotateY(-2deg)] origin-bottom"
      >
        <KessickTowerElevation finish="walnut" />
      </motion.div>
      <div className="absolute top-[30%] left-[59%] z-20 bg-black/75 border border-primary/30 px-2.5 py-1.5 text-white backdrop-blur-sm">
        <p className="text-[8px] uppercase tracking-[0.2em] text-primary font-bold">Verified scale</p>
        <p className="text-[10px] font-mono">28"W × 88.5"H × 11.75"D</p>
      </div>
      <div className="absolute top-2 left-2 sm:top-4 sm:left-4 z-20">
        <div className="bg-card/90 backdrop-blur border border-border px-2 py-1 sm:px-3 sm:py-1.5 flex items-center gap-1.5 sm:gap-2 shadow-lg">
          <Home className="w-3 h-3 sm:w-4 sm:h-4 text-primary" />
          <span className="text-[10px] sm:text-xs uppercase tracking-widest font-semibold">AR Composition</span>
        </div>
      </div>
    </motion.div>
  );
}

function KessickTowerElevation({ finish }: { finish: 'walnut' | 'matte-black' }) {
  const width = 280;
  const height = 885;
  const isBlack = finish === 'matte-black';
  const wood = isBlack ? '#222222' : '#3e302c';
  const frame = isBlack ? '#111111' : '#2d2522';
  const hardware = isBlack ? '#555555' : '#8D794E';

  return (
    <div className="w-full h-full relative flex items-end justify-center">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible" preserveAspectRatio="xMidYMax meet" role="img" aria-label='Kessick Tower 2888 product elevation, 28 inches wide by 88.5 inches high'>
        <rect width={width} height={height} fill={frame} />
        <rect x="15" y="15" width={width - 30} height={height - 30} fill={wood} />
        <rect x="15" y="15" width={width - 30} height={height - 365} fill="#000" opacity=".6" />
        {Array.from({ length: 14 }).map((_, row) => (
          <g key={row}>
            <line x1="15" y1={40 + row * 36} x2={width - 15} y2={40 + row * 36} stroke={hardware} strokeWidth="2" opacity=".7" />
            {Array.from({ length: 3 }).map((__, column) => (
              <rect key={column} x={45 + column * 75} y={28 + row * 36} width="40" height="10" rx="3" fill="#1a1a1a" stroke="#222" />
            ))}
          </g>
        ))}
        <rect x="15" y={height - 350} width={width - 30} height="120" fill="#000" opacity=".8" />
        {Array.from({ length: 5 }).map((_, i) => (
          <rect key={i} x={35 + i * 45} y={height - 335} width="20" height="90" rx="8" fill="#1a1a1a" stroke={hardware} strokeWidth="1.5" />
        ))}
        <rect x="15" y={height - 230} width={width - 30} height="215" fill={frame} />
        <rect x="25" y={height - 220} width={width / 2 - 30} height="195" fill={wood} />
        <rect x={width / 2 + 5} y={height - 220} width={width / 2 - 30} height="195" fill={wood} />
        <rect x="35" y={height - 210} width={width / 2 - 50} height="175" fill="none" stroke={frame} strokeWidth="3" />
        <rect x={width / 2 + 15} y={height - 210} width={width / 2 - 50} height="175" fill="none" stroke={frame} strokeWidth="3" />
        <rect x={width / 2 - 25} y={height - 150} width="6" height="50" rx="3" fill={hardware} />
        <rect x={width / 2 + 19} y={height - 150} width="6" height="50" rx="3" fill={hardware} />
      </svg>
      <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-white/10 mix-blend-overlay pointer-events-none" />
    </div>
  );
}

function SceneSwitchFinish() {
  const [activeFinish, setActiveFinish] = useState<'walnut'|'matte-black'>('walnut');
  const [showUpdateStatus, setShowUpdateStatus] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const userInteracted = useRef(false);

  useEffect(() => {
    // Auto-demonstrate the finish switch after 2.5s if the user hasn't clicked
    const autoTimer = window.setTimeout(() => {
      if (!userInteracted.current && activeFinish === 'walnut') {
        setShowUpdateStatus(false);
        setActiveFinish('matte-black');
        window.requestAnimationFrame(() => setShowUpdateStatus(true));
      }
    }, 2500);
    return () => window.clearTimeout(autoTimer);
  }, [activeFinish]);

  useEffect(() => {
    let timer: number | undefined;
    if (showUpdateStatus) {
      setIsUpdating(true);
      timer = window.setTimeout(() => {
        setIsUpdating(false);
      }, 1500);
    } else {
      setIsUpdating(false);
    }
    return () => {
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [activeFinish, showUpdateStatus]);

  const chooseFinish = (nextFinish: 'walnut' | 'matte-black') => {
    userInteracted.current = true;
    if (nextFinish === activeFinish) return;
    setShowUpdateStatus(false);
    setActiveFinish(nextFinish);
    window.requestAnimationFrame(() => setShowUpdateStatus(true));
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="w-full max-w-5xl aspect-[4/3] sm:aspect-[16/9] relative bg-black border border-border overflow-hidden"
    >
      <img
        src={demoRoomImg}
        alt="Room background"
        className="w-full h-full object-cover"
      />

      <motion.div
        className="absolute bottom-[17%] left-[42%] w-[15.8%] h-[50%] z-10 drop-shadow-[0_18px_30px_rgba(0,0,0,0.75)] [transform:perspective(900px)_rotateY(-2deg)] origin-bottom"
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={activeFinish}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6 }}
            className="w-full h-full"
          >
            <KessickTowerElevation finish={activeFinish} />
          </motion.div>
        </AnimatePresence>
      </motion.div>

      {/* UI Controls Overlay */}
      <div className="absolute bottom-0 left-0 right-0 sm:left-auto sm:right-8 sm:top-1/2 sm:-translate-y-1/2 sm:w-64 bg-card/90 backdrop-blur-md border-t sm:border border-border p-4 sm:p-6 flex flex-col z-20 shadow-2xl">
        <h3 className="text-[10px] sm:text-sm font-bold uppercase tracking-wider mb-3 sm:mb-4 border-b border-border pb-1 sm:pb-2">Finish Selection</h3>

        <div className="space-y-4 sm:space-y-6 flex-1">
          <div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => chooseFinish('walnut')}
                className={`p-1.5 sm:p-2 border ${activeFinish === 'walnut' ? 'border-primary bg-primary/10' : 'border-border bg-background'} text-center cursor-pointer text-[10px] sm:text-xs`}
                aria-pressed={activeFinish === 'walnut'}
              >
                <div className="w-full h-6 sm:h-8 bg-[#4a3b37] mb-1 sm:mb-2" />
                Walnut
              </button>
              <button
                type="button"
                onClick={() => chooseFinish('matte-black')}
                className={`p-1.5 sm:p-2 border ${activeFinish === 'matte-black' ? 'border-primary bg-primary/10' : 'border-border bg-background'} text-center cursor-pointer text-[10px] sm:text-xs`}
                aria-pressed={activeFinish === 'matte-black'}
              >
                <div className="w-full h-6 sm:h-8 bg-[#1a1a1a] mb-1 sm:mb-2" />
                Matte Black
              </button>
            </div>
            {showUpdateStatus && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-2 sm:mt-4 flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs"
              >
                {isUpdating ? (
                  <>
                    <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-primary animate-pulse" />
                    <span className="text-primary">Rendering material...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3 h-3 text-green-500" />
                    <span className="text-green-500">Material Applied</span>
                  </>
                )}
              </motion.div>
            )}
          </div>
        </div>
      </div>

      <div className="absolute top-2 left-2 sm:top-4 sm:left-4 z-20">
        <div className="bg-card/90 backdrop-blur border border-border px-2 py-1 sm:px-3 sm:py-1.5 flex items-center gap-1.5 sm:gap-2 shadow-lg">
          <Wand2 className="w-3 h-3 sm:w-4 sm:h-4 text-primary" />
          <span className="text-[10px] sm:text-xs uppercase tracking-widest font-semibold">Live Configuration</span>
        </div>
      </div>
    </motion.div>
  );
}

function SceneCTA() {
  const [submitted, setSubmitted] = useState<'save' | 'dealer' | 'design' | null>(null);

  const handleAction = (action: 'save' | 'dealer' | 'design') => {
    setSubmitted(action);
    setTimeout(() => {
      setSubmitted(null);
    }, 2500);
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0 }}
      className="w-full max-w-4xl bg-card border border-border shadow-2xl overflow-hidden flex flex-col h-full sm:h-auto max-h-full"
    >
      <div className="p-4 sm:p-6 text-center border-b border-border bg-sidebar/50 shrink-0">
        <h2 className="text-xl sm:text-2xl font-serif">Next Steps</h2>
        <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-widest mt-1 sm:mt-2">Take action on your concept</p>
      </div>

      <div className="p-4 sm:p-8 grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 flex-1 overflow-y-auto sm:overflow-visible pb-32 sm:pb-8">

        <div
          onClick={() => handleAction('save')}
          className={`border ${submitted === 'save' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary bg-background'} p-4 sm:p-6 transition-colors cursor-pointer group relative flex flex-col justify-between`}
        >
          {submitted === 'save' ? (
             <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 flex flex-col items-center justify-center text-center p-4">
               <Check className="w-8 h-8 sm:w-12 sm:h-12 text-primary mx-auto mb-2 sm:mb-3" />
               <span className="text-primary font-bold text-[10px] sm:text-xs uppercase tracking-widest">Concept Saved</span>
             </motion.div>
          ) : (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col h-full">
              <div>
                <Wand2 className="w-6 h-6 sm:w-8 sm:h-8 text-muted-foreground group-hover:text-primary transition-colors mb-3 sm:mb-4" />
                <h3 className="text-base sm:text-lg font-serif mb-1 sm:mb-2">Save Concept</h3>
                <p className="text-xs sm:text-sm text-muted-foreground mb-3 sm:mb-4">Store this design in your workspace for later review and refinement.</p>
              </div>
              <div className="flex items-center text-primary text-[10px] sm:text-xs uppercase tracking-widest font-bold mt-auto pt-2">
                Save <ArrowRight className="w-3 h-3 sm:w-4 sm:h-4 ml-1 transform group-hover:translate-x-1 transition-transform" />
              </div>
            </motion.div>
          )}
        </div>

        <div
          onClick={() => handleAction('dealer')}
          className={`border ${submitted === 'dealer' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary bg-background'} p-4 sm:p-6 transition-colors cursor-pointer group relative flex flex-col justify-between`}
        >
          {submitted === 'dealer' ? (
             <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 flex flex-col items-center justify-center text-center p-4">
               <Check className="w-8 h-8 sm:w-12 sm:h-12 text-primary mx-auto mb-2 sm:mb-3" />
               <span className="text-primary font-bold text-[10px] sm:text-xs uppercase tracking-widest">Sent to Dealer</span>
             </motion.div>
          ) : (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col h-full">
              <div>
                <Search className="w-6 h-6 sm:w-8 sm:h-8 text-muted-foreground group-hover:text-primary transition-colors mb-3 sm:mb-4" />
                <h3 className="text-base sm:text-lg font-serif mb-1 sm:mb-2">Send to Dealer</h3>
                <p className="text-xs sm:text-sm text-muted-foreground mb-3 sm:mb-4">Share this concept with a certified Kessick dealer for pricing.</p>
              </div>
              <div className="flex items-center text-primary text-[10px] sm:text-xs uppercase tracking-widest font-bold mt-auto pt-2">
                Send <ArrowRight className="w-3 h-3 sm:w-4 sm:h-4 ml-1 transform group-hover:translate-x-1 transition-transform" />
              </div>
            </motion.div>
          )}
        </div>

        <div
          onClick={() => handleAction('design')}
          className={`border ${submitted === 'design' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary bg-background'} p-4 sm:p-6 transition-colors cursor-pointer group relative flex flex-col justify-between`}
        >
          {submitted === 'design' ? (
             <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 flex flex-col items-center justify-center text-center p-4">
               <Check className="w-8 h-8 sm:w-12 sm:h-12 text-primary mx-auto mb-2 sm:mb-3" />
               <span className="text-primary font-bold text-[10px] sm:text-xs uppercase tracking-widest">Request Sent</span>
             </motion.div>
          ) : (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col h-full">
              <div>
                <Send className="w-6 h-6 sm:w-8 sm:h-8 text-muted-foreground group-hover:text-primary transition-colors mb-3 sm:mb-4" />
                <h3 className="text-base sm:text-lg font-serif mb-1 sm:mb-2">Design Request</h3>
                <p className="text-xs sm:text-sm text-muted-foreground mb-3 sm:mb-4">Submit to our team to refine into a comprehensive proposal.</p>
              </div>
              <div className="flex items-center text-primary text-[10px] sm:text-xs uppercase tracking-widest font-bold mt-auto pt-2">
                Submit <ArrowRight className="w-3 h-3 sm:w-4 sm:h-4 ml-1 transform group-hover:translate-x-1 transition-transform" />
              </div>
            </motion.div>
          )}
        </div>

      </div>
    </motion.div>
  );
}
