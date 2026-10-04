import { useListProjects, useCreateProject, useGetAccount, importLocalProject, listProjectImages, requestProjectImageUpload, completeProjectImageUpload, updateProject, type Project } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Plus, FolderOpen, UploadCloud, Clock, AlertTriangle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { deleteProjectLocal, getClaimableLegacyProjects } from "@/lib/persistence";
import { useState, useEffect } from "react";
import { createFreshSnapshot, StateSnapshot } from "@/store";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { getListProjectsQueryKey } from "@workspace/api-client-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getImageIDB } from "@/lib/idb";

class LegacyClaimConflictError extends Error {}

export default function ProjectsPage() {
  const [location, setLocation] = useLocation();
  const { data: projects, isLoading, error } = useListProjects();
  const createProject = useCreateProject();
  const queryClient = useQueryClient();
  const { data: accountContext } = useGetAccount();
  const canManageProjects = accountContext?.account.role === 'dealer'
    && accountContext.account.status === 'approved';

  const [localProjects, setLocalProjects] = useState<StateSnapshot[]>([]);
  const [claimingProject, setClaimingProject] = useState<StateSnapshot | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  useEffect(() => {
    for (const cloudProject of projects ?? []) {
      deleteProjectLocal(cloudProject.id);
    }
    if (!canManageProjects || !accountContext) {
      setLocalProjects([]);
      return;
    }
    const accountId = accountContext.account.id;
    const saved = getClaimableLegacyProjects(accountId);
    const claimedKey = `kessick_claimed_projects:${accountId}`;
    const claimedIdsStr = localStorage.getItem(claimedKey) || '[]';
    const claimedIds = new Set<string>(JSON.parse(claimedIdsStr));
    
    if (projects) {
      const cloudIds = new Set(projects.map(p => p.id));
      setLocalProjects(saved.filter(p => !cloudIds.has(p.project.id) && !claimedIds.has(p.project.id)));
    } else {
      setLocalProjects(saved.filter(p => !claimedIds.has(p.project.id)));
    }
  }, [projects, canManageProjects, accountContext]);

  const handleNewProject = () => {
    createProject.mutate({ 
      data: { name: "New Site Survey", snapshot: createFreshSnapshot() as any }
    }, {
      onSuccess: (newProj) => {
        setLocation(`/workspace/project/${newProj.id}`);
        queryClient.invalidateQueries({ queryKey: getListProjectsQueryKey() });
      },
      onError: () => {
        toast.error("Failed to create new project.");
      }
    });
  };

  const handleImportConfirm = async () => {
    if (!claimingProject) return;
    setIsImporting(true);

    try {
      const localImageId = claimingProject.roomImageId;
      const localImageDataUrl = localImageId
        ? await getImageIDB(localImageId)
        : null;
      if (localImageId && !localImageDataUrl) {
        toast.error("This local project’s room photo is unavailable. Restore the photo before claiming it.");
        return;
      }

      const importSnapshot: StateSnapshot = {
        ...claimingProject,
        roomImageId: localImageId ? null : claimingProject.roomImageId,
      };
      let cloudProject = await importLocalProject({
        name: claimingProject.project.name || "Imported Project",
        snapshot: importSnapshot as any,
        localProjectId: claimingProject.project.id,
      });

      if (localImageId && localImageDataUrl) {
        const legacyFileName = `legacy-room-${localImageId}.jpg`;
        const existingImages = await listProjectImages(cloudProject.id);
        let cloudImage = existingImages.find(
          (image) => image.fileName === legacyFileName,
        );
        const currentSnapshot = JSON.parse(
          JSON.stringify(cloudProject.snapshot),
        ) as StateSnapshot;
        const currentRoomImageId =
          typeof currentSnapshot.roomImageId === "string"
            ? currentSnapshot.roomImageId
            : null;

        if (
          currentRoomImageId
          && currentRoomImageId !== localImageId
          && currentRoomImageId !== cloudImage?.id
        ) {
          throw new LegacyClaimConflictError(
            "The cloud project’s room photo changed after this claim began. Open the cloud project to review it; the local copy was not overwritten.",
          );
        }

        if (!cloudImage) {
          const blob = await (await fetch(localImageDataUrl)).blob();
          const contentType =
            blob.type === "image/png"
              ? "image/png"
              : blob.type === "image/webp"
                ? "image/webp"
                : "image/jpeg";
          const uploadTarget = await requestProjectImageUpload(cloudProject.id, {
            fileName: legacyFileName,
            contentType,
            byteSize: blob.size,
          });
          const uploadResponse = await fetch(uploadTarget.uploadUrl, {
            method: "PUT",
            headers: { "Content-Type": contentType, "X-Kessick-CSRF": "1" },
            body: blob,
          });
          if (!uploadResponse.ok) throw new Error("Legacy room photo upload failed");
          cloudImage = await completeProjectImageUpload(cloudProject.id, {
            uploadId: uploadTarget.uploadId,
          });
        }

        if (currentRoomImageId !== cloudImage.id) {
          cloudProject = await updateProject(cloudProject.id, {
            name: cloudProject.name,
            snapshot: {
              ...currentSnapshot,
              roomImageId: cloudImage.id,
            } as any,
            version: cloudProject.version,
          });
        }

        if (
          (cloudProject.snapshot as { roomImageId?: unknown }).roomImageId
          !== cloudImage.id
        ) {
          throw new Error("The cloud room photo reference was not committed");
        }
      }

      toast.success(
        localImageId
          ? "Project and room photo imported successfully."
          : "Project imported successfully.",
      );
      const claimedKey = `kessick_claimed_projects:${accountContext!.account.id}`;
      const claimedIdsStr = localStorage.getItem(claimedKey) || '[]';
      const claimedIds = new Set<string>(JSON.parse(claimedIdsStr));
      claimedIds.add(claimingProject.project.id);
      localStorage.setItem(claimedKey, JSON.stringify(Array.from(claimedIds)));

      queryClient.setQueryData<Project[]>(
        getListProjectsQueryKey(),
        (projects = []) => projects.some((project) => project.id === cloudProject.id)
          ? projects.map((project) => project.id === cloudProject.id ? cloudProject : project)
          : [...projects, cloudProject],
      );
      setClaimingProject(null);
    } catch (error) {
      toast.error(
        error instanceof LegacyClaimConflictError
          ? error.message
          : "The project could not be fully claimed. Its local copy is unchanged; retry to finish.",
      );
      queryClient.invalidateQueries({ queryKey: getListProjectsQueryKey() });
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="flex-1 p-6 md:p-12 max-w-7xl mx-auto w-full">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-sans font-light tracking-tight text-foreground">Projects</h1>
          <p className="text-muted-foreground mt-1">Manage your site surveys and designs</p>
        </div>
        {canManageProjects && (
          <Button onClick={handleNewProject} disabled={createProject.isPending} className="rounded-none bg-primary text-primary-foreground hover:bg-primary/90">
            <Plus className="w-4 h-4 mr-2" />
            New Project
          </Button>
        )}
      </div>

      {canManageProjects && localProjects.length > 0 && (
        <div className="mb-12">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground mb-4 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-accent" />
            Unsaved Local Projects
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {localProjects.map(p => (
              <div key={p.project.id} className="border border-accent/30 bg-accent/5 p-5 flex flex-col hover:border-accent/50 transition-colors">
                <div className="flex-1">
                  <h3 className="font-medium text-lg text-foreground truncate">{p.project.name || 'Unnamed Project'}</h3>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-2">
                    <Clock className="w-3 h-3" />
                    Last edited {formatDistanceToNow(p.lastSaved, { addSuffix: true })}
                  </div>
                </div>
                <div className="mt-6 flex items-center gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="flex-1 rounded-none border-border hover:bg-muted"
                    onClick={() => setClaimingProject(p)}
                    disabled={isImporting}
                  >
                    <UploadCloud className="w-3 h-3 mr-2" />
                    Claim to Cloud
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <Dialog open={!!claimingProject} onOpenChange={(open) => !open && setClaimingProject(null)}>
        <DialogContent className="rounded-none border-border bg-card">
          <DialogHeader>
            <DialogTitle>Claim Project to Cloud</DialogTitle>
            <DialogDescription>
              Are you sure you want to upload "{claimingProject?.project?.name || 'Unnamed Project'}" to your cloud account?
              This will make it accessible from any device. The local copy will remain on this device.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" className="rounded-none" onClick={() => setClaimingProject(null)}>Cancel</Button>
            <Button className="rounded-none" onClick={handleImportConfirm} disabled={isImporting}>
              {isImporting ? 'Uploading project and photo...' : 'Confirm Upload'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div>
        <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground mb-4">
          Cloud Projects
        </h2>
        
        {isLoading ? (
          <div className="py-12 text-center text-muted-foreground">Loading projects...</div>
        ) : error ? (
          <div className="py-12 text-center text-destructive">Failed to load projects.</div>
        ) : projects && projects.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map(p => (
              <div key={p.id} className="group border border-border bg-card p-5 flex flex-col hover:border-primary/50 transition-colors cursor-pointer" onClick={() => setLocation(`/workspace/project/${p.id}`)}>
                <div className="flex-1">
                  <h3 className="font-medium text-lg text-foreground truncate group-hover:text-primary transition-colors">{p.name}</h3>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-2">
                    <Clock className="w-3 h-3" />
                    Updated {formatDistanceToNow(new Date(p.updatedAt), { addSuffix: true })}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Version {p.version}
                  </div>
                </div>
                <div className="mt-6">
                  <Button variant="ghost" size="sm" className="w-full rounded-none justify-start px-0 text-muted-foreground hover:bg-transparent hover:text-foreground">
                    <FolderOpen className="w-4 h-4 mr-2" />
                    Open Workspace &rarr;
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-16 border border-dashed border-border flex flex-col items-center justify-center text-center">
            <FolderOpen className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium text-foreground">No projects yet</h3>
            <p className="text-muted-foreground max-w-sm mt-2 mb-6">Create a new site survey to begin designing a professional wine cellar.</p>
            {canManageProjects ? (
              <Button onClick={handleNewProject} disabled={createProject.isPending} className="rounded-none bg-primary text-primary-foreground hover:bg-primary/90">
                Create Project
              </Button>
            ) : (
              <p className="text-sm text-muted-foreground">
                Projects shared with your verified email will appear here.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}