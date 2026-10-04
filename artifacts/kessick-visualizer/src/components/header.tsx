import { useAppStore } from '@/store';
import { Button } from '@/components/ui/button';
import { 
  Undo2, Redo2, FolderOpen, Plus, 
  Presentation, FileText, Calculator, GitMerge, FileDown, MoreHorizontal,
  Cloud, Loader2, AlertTriangle, Sparkles
} from 'lucide-react';
import { useState } from 'react';
import { ReportModal } from './report-modal';
import { PresentationModal } from './presentation-modal';
import { ConstructionDocumentsModal } from './construction-documents-modal';
import { PipelineDashboardModal } from './pipeline-dashboard-modal';
import { EstimatingHubModal } from './estimating-hub-modal';
import { PipelineWorkspaceModal } from './pipeline-workspace-modal';
import { ProjectDetailsModal } from './project-details-modal';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { BrandLogo } from './brand-logo';
import { ProjectInvitationsModal } from './project-invitations-modal';
import { useLocation } from 'wouter';
import { useGetAccount } from "@workspace/api-client-react";
import { ConciergePanel } from '@/components/concierge/concierge-panel';

type EditorSyncStatus = 'saved' | 'unsaved' | 'saving' | 'uploading' | 'error';

export function Header({
  readOnly = false,
  syncStatus,
  onExitProject,
}: {
  readOnly?: boolean;
  syncStatus?: EditorSyncStatus;
  onExitProject?: () => void | Promise<void>;
}) {
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [isPresentationOpen, setIsPresentationOpen] = useState(false);
  const [isDocsOpen, setIsDocsOpen] = useState(false);
  const [isEstOpen, setIsEstOpen] = useState(false);
  const [isPipeOpen, setIsPipeOpen] = useState(false);
  const [isProjectMetaOpen, setIsProjectMetaOpen] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [isConciergeOpen, setIsConciergeOpen] = useState(false);
  
  const { data: accountContext } = useGetAccount();
  const role = accountContext?.account.role || 'customer';
  const [, setLocation] = useLocation();

  const { 
    roomImageDataUrl, instances, project, 
    undo, redo, canUndo, canRedo, reconcileConfirmedProject
  } = useAppStore();

  const leaveProject = () => {
    if (onExitProject) {
      void onExitProject();
    } else {
      setLocation('/workspace');
    }
  };

  const syncLabel = syncStatus === 'uploading'
    ? 'Syncing photo'
    : syncStatus === 'saving'
      ? 'Saving'
      : syncStatus === 'unsaved'
        ? 'Unsaved changes'
        : syncStatus === 'error'
          ? 'Save failed'
          : syncStatus === 'saved'
            ? 'Saved'
            : null;

  return (
    <>
      <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-border bg-card px-3 md:px-4 shadow-sm z-20 relative overflow-x-auto no-scrollbar">
        
        <div className="flex items-center gap-2 md:gap-4 shrink-0">
          <div className="flex h-10 items-center justify-center py-1">
            <BrandLogo tone="light" className="h-6 w-auto md:h-7" showWineCellarsName />
          </div>
          
          <div className="h-4 w-px bg-border shrink-0 ml-2" />
          
          <Button data-testid="button-project-meta" variant="ghost" size="sm" className="px-2 truncate max-w-[120px] md:max-w-[200px] text-sm text-foreground hover:bg-muted" onClick={() => setIsProjectMetaOpen(true)}>
             {project.name || 'Unnamed Project'}
          </Button>

           {syncLabel && (
             <span
               data-testid="cloud-sync-status"
               aria-label={`Cloud status: ${syncLabel}`}
               title={syncLabel}
               className={`flex items-center gap-1 text-[11px] whitespace-nowrap ${
                 syncStatus === 'error'
                   ? 'text-destructive'
                   : syncStatus === 'unsaved'
                     ? 'text-amber-500'
                     : 'text-muted-foreground'
               }`}
             >
               {syncStatus === 'saving' || syncStatus === 'uploading' ? (
                 <Loader2 className="h-3 w-3 animate-spin" />
               ) : syncStatus === 'error' ? (
                 <AlertTriangle className="h-3 w-3" />
               ) : (
                 <Cloud className="h-3 w-3" />
               )}
               <span className="hidden sm:inline">{syncLabel}</span>
             </span>
           )}
          
          <div className="hidden sm:flex items-center gap-0.5">
            <Tooltip delayDuration={0}><TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-muted shrink-0" onClick={undo} disabled={readOnly || !canUndo}>
                <Undo2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger><TooltipContent>Undo</TooltipContent></Tooltip>
            
            <Tooltip delayDuration={0}><TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-muted shrink-0" onClick={redo} disabled={readOnly || !canRedo}>
                <Redo2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger><TooltipContent>Redo</TooltipContent></Tooltip>
            
            <div className="h-4 w-px bg-border mx-1 shrink-0" />
            
            {role === 'dealer' && <Button data-testid="button-new-project" variant="ghost" size="sm" className="h-8 px-2 text-muted-foreground hover:text-foreground shrink-0" onClick={leaveProject}>
              <Plus className="h-4 w-4 md:mr-1" />
              <span className="hidden md:inline">New</span>
            </Button>}
            
            <Button data-testid="button-open-project" variant="ghost" size="sm" className="h-8 px-2 text-muted-foreground hover:text-foreground shrink-0" onClick={leaveProject}>
              <FolderOpen className="h-4 w-4 md:mr-1" />
              <span className="hidden md:inline">Open</span>
            </Button>

            {!readOnly && role !== 'customer' && (
              <Button data-testid="button-share-project" variant="ghost" size="sm" className="h-8 px-2 text-primary hover:text-primary/80 shrink-0" onClick={() => setIsShareOpen(true)} disabled={!project.id}>
                Share
              </Button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <Button
            data-testid="button-open-project-concierge"
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-primary hover:bg-primary/10 hover:text-primary"
            onClick={() => setIsConciergeOpen(true)}
          >
            <Sparkles className="h-4 w-4 md:mr-1.5" />
            <span className="hidden md:inline text-xs">Ask Kessick</span>
          </Button>
          {/* Mobile minimal file actions */}
          <div className="flex sm:hidden mr-1">
             {role === 'dealer' && <Button aria-label="New project" variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={leaveProject}><Plus className="h-4 w-4"/></Button>}
             <Button data-testid="button-open-project-mobile" aria-label="Open saved project" variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={leaveProject}><FolderOpen className="h-4 w-4"/></Button>
             <div className="h-4 w-px bg-border mx-1 my-auto shrink-0" />
          </div>

          {/* Specialist Workspaces */}
          <div className="hidden sm:flex bg-muted/30 p-1  border border-border items-center gap-0.5">
            <Button data-testid="button-presentation" variant="ghost" size="sm" className="h-8 px-2 text-muted-foreground hover:text-foreground shrink-0" onClick={() => setIsPresentationOpen(true)} disabled={instances.length === 0} title="Present">
              <Presentation className="h-4 w-4 md:mr-1.5" />
              <span className="hidden md:inline text-xs">Present</span>
            </Button>
            <Button data-testid="button-survey-report" variant="ghost" size="sm" className="h-8 px-2 text-muted-foreground hover:text-foreground shrink-0" onClick={() => setIsReportOpen(true)} disabled={!roomImageDataUrl} title="Report">
              <FileDown className="h-4 w-4 md:mr-1.5" />
              <span className="hidden md:inline text-xs">Report</span>
            </Button>
            {(role === 'dealer' || role === 'staff') && (
              <>
                <Button data-testid="button-estimating" variant="ghost" size="sm" className="h-8 px-2 text-muted-foreground hover:text-foreground shrink-0" onClick={() => setIsEstOpen(true)} title="Estimate">
                  <Calculator className="h-4 w-4 md:mr-1.5" />
                  <span className="hidden md:inline text-xs">Estimate</span>
                </Button>
                <Button data-testid="button-const-docs" variant="ghost" size="sm" className="h-8 px-2 text-muted-foreground hover:text-foreground shrink-0" onClick={() => setIsDocsOpen(true)} title="Docs">
                  <FileText className="h-4 w-4 md:mr-1.5" />
                  <span className="hidden md:inline text-xs">Docs</span>
                </Button>
                <Button data-testid="button-pipeline" variant="ghost" size="sm" className="h-8 px-2 text-muted-foreground hover:text-foreground shrink-0" onClick={() => setIsPipeOpen(true)} title="Pipeline">
                  <GitMerge className="h-4 w-4 md:mr-1.5" />
                  <span className="hidden md:inline text-xs">Pipeline</span>
                </Button>
              </>
            )}
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                data-testid="button-mobile-workspaces"
                variant="outline"
                size="icon"
                className="sm:hidden h-9 w-9 shrink-0 border-border bg-muted/30"
                aria-label="Open project workspaces"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem
                data-testid="button-mobile-undo"
                disabled={readOnly || !canUndo}
                onSelect={undo}
              >
                <Undo2 className="h-4 w-4" />
                Undo
              </DropdownMenuItem>
              <DropdownMenuItem
                data-testid="button-mobile-redo"
                disabled={readOnly || !canRedo}
                onSelect={redo}
              >
                <Redo2 className="h-4 w-4" />
                Redo
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={instances.length === 0}
                onSelect={() => setIsPresentationOpen(true)}
              >
                <Presentation className="h-4 w-4" />
                Client presentation
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={!roomImageDataUrl}
                onSelect={() => setIsReportOpen(true)}
              >
                <FileDown className="h-4 w-4" />
                Survey report
              </DropdownMenuItem>
              {(role === 'dealer' || role === 'staff') && (
                <>
                  <DropdownMenuItem onSelect={() => setIsEstOpen(true)}>
                    <Calculator className="h-4 w-4" />
                    Estimating
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => setIsDocsOpen(true)}>
                    <FileText className="h-4 w-4" />
                    Construction docs
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => setIsPipeOpen(true)}>
                    <GitMerge className="h-4 w-4" />
                    Project pipeline
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <ReportModal open={isReportOpen} onOpenChange={setIsReportOpen} />
      <PresentationModal open={isPresentationOpen} onOpenChange={setIsPresentationOpen} />
      <ConstructionDocumentsModal open={isDocsOpen} onOpenChange={setIsDocsOpen} />
      <EstimatingHubModal open={isEstOpen} onOpenChange={setIsEstOpen} />
      <PipelineWorkspaceModal open={isPipeOpen} onOpenChange={setIsPipeOpen} />
      <ProjectDetailsModal open={isProjectMetaOpen} onOpenChange={setIsProjectMetaOpen} />
      {!readOnly && role !== 'customer' && (
        <ProjectInvitationsModal projectId={project.id} open={isShareOpen} onOpenChange={setIsShareOpen} />
      )}
      <ConciergePanel
        open={isConciergeOpen}
        onOpenChange={setIsConciergeOpen}
        projectId={project.id || undefined}
        projectName={project.name}
        canConfirmActions={!readOnly && (role === 'dealer' || role === 'staff')}
        onProjectConfirmed={(confirmed, previousName, actionProjectVersion) =>
          reconcileConfirmedProject(
            previousName,
            confirmed.name,
            actionProjectVersion,
            confirmed.version,
          )
        }
      />
    </>
  );
}
