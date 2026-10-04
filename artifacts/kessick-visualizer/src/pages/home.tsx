import { AppProvider, useAppStore } from '@/store';
import { Header } from '@/components/header';
import { CanvasWorkspace } from '@/components/canvas-workspace';
import { BottomBar } from '@/components/bottom-bar';
import { SidebarCatalog } from '@/components/sidebar-catalog';
import { InspectorPanel } from '@/components/inspector-panel';
import { ToolRail, ToolRailPanel } from '@/components/tool-rail';
import { LeftSurveyPanel } from '@/components/left-survey-panel';
import { WallComposerPanel } from '@/components/wall-composer-panel';
import { ProductModelStudioPanel } from '@/components/product-model-studio-panel';
import { useState } from 'react';

export function HomeInner({
  readOnly = false,
  syncStatus,
  onExitProject,
}: {
  readOnly?: boolean;
  syncStatus?: 'saved' | 'unsaved' | 'saving' | 'uploading' | 'error';
  onExitProject?: () => void | Promise<void>;
}) {
  const [leftTab, setLeftTab] = useState<ToolRailPanel | null>(() => {
    const requestedPanel = new URLSearchParams(window.location.search).get('panel');
    if (requestedPanel === 'catalog' || requestedPanel === 'survey' || requestedPanel === 'composer' || requestedPanel === 'model-studio') {
      return requestedPanel;
    }
    return 'composer';
  });
  const [rightPanelOpen, setRightPanelOpen] = useState(false);
  const { roomImageDataUrl } = useAppStore();

  return (
    <div className="flex flex-col h-[100dvh] w-full bg-background overflow-hidden text-foreground">
      <Header
        readOnly={readOnly}
        syncStatus={syncStatus}
        onExitProject={onExitProject}
      />
      
      <div className="flex flex-col md:flex-row flex-1 min-h-0 overflow-hidden relative">
        <ToolRail active={leftTab} onChange={setLeftTab} rightPanelOpen={rightPanelOpen} setRightPanelOpen={setRightPanelOpen} hasImage={!!roomImageDataUrl} />
        
        {/* Transient Left Panels */}
        {leftTab === 'catalog' && (
          <>
            <div className="md:hidden fixed inset-0 bg-black/50 z-40" onClick={() => setLeftTab(null)} />
            <div className="absolute inset-y-0 left-0 md:left-14 w-[340px] max-w-[85vw] border-r border-border bg-sidebar flex flex-col z-50 shadow-2xl animate-in slide-in-from-left-4 fade-in duration-200 h-full">
              <SidebarCatalog onClose={() => setLeftTab(null)} />
            </div>
          </>
        )}
        
        {leftTab === 'survey' && (
          <>
            <div className="md:hidden fixed inset-0 bg-black/50 z-40" onClick={() => setLeftTab(null)} />
            <div className="absolute inset-y-0 left-0 md:left-14 w-[340px] max-w-[85vw] border-r border-border bg-sidebar flex flex-col z-50 shadow-2xl animate-in slide-in-from-left-4 fade-in duration-200 h-full">
              <LeftSurveyPanel onClose={() => setLeftTab(null)} />
            </div>
          </>
        )}
        
        {leftTab === 'composer' && (
          <>
            <div className="md:hidden fixed inset-0 bg-black/50 z-40" onClick={() => setLeftTab(null)} />
            <div className="absolute inset-y-0 left-0 md:left-14 w-[420px] max-w-[90vw] border-r border-border bg-sidebar flex flex-col z-50 shadow-2xl animate-in slide-in-from-left-4 fade-in duration-200 h-full">
              <WallComposerPanel onClose={() => setLeftTab(null)} />
            </div>
          </>
        )}

        {leftTab === 'model-studio' && (
          <>
            <div className="md:hidden fixed inset-0 bg-black/50 z-40" onClick={() => setLeftTab(null)} />
            <div className="absolute inset-y-0 left-0 md:left-14 w-[420px] max-w-[90vw] border-r border-border bg-sidebar flex flex-col z-50 shadow-2xl animate-in slide-in-from-left-4 fade-in duration-200 h-full">
              <ProductModelStudioPanel onClose={() => setLeftTab(null)} />
            </div>
          </>
        )}

        {/* Canvas & Modals Container */}
        <div className="flex-1 min-h-0 min-w-0 order-1 md:order-none relative flex flex-col bg-background">
          <CanvasWorkspace />
        </div>
        
        {/* Inspector Panel */}
        {rightPanelOpen && roomImageDataUrl && (
          <>
            <div className="md:hidden fixed inset-0 bg-black/50 z-40" onClick={() => setRightPanelOpen(false)} />
            <div className="absolute inset-y-0 right-0 w-[340px] max-w-[85vw] border-l border-border bg-card flex flex-col z-50 shadow-2xl animate-in slide-in-from-right-4 h-full">
              <InspectorPanel onClose={() => setRightPanelOpen(false)} />
            </div>
          </>
        )}
      </div>
      
      <BottomBar />
    </div>
  );
}

export default function Home() {
  return (
    <AppProvider>
      <HomeInner />
    </AppProvider>
  );
}
