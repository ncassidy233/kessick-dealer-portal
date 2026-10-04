import { useGetProject, useListProjectImages, getProjectImageContent, useGetAccount, getListProjectImagesQueryKey, getGetProjectQueryKey, getListProjectsQueryKey, type Project, type ProjectImage, updateProject, requestProjectImageUpload, completeProjectImageUpload } from "@workspace/api-client-react";
import { useParams, useLocation } from "wouter";
import { AppProvider, useAppStore, StateSnapshot, toDurableSnapshot } from "@/store";
import { HomeInner } from "@/pages/home";
import { Loader2, Lock } from "lucide-react";
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { deleteProjectLocal } from "@/lib/persistence";
import { reconcileConfirmedProjectVersion } from "@/lib/project-reconciliation";

type SyncStatus = "saved" | "unsaved" | "saving" | "uploading" | "error";

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onloadend = () => resolve(reader.result as string);
    reader.readAsDataURL(blob);
  });
}

function CloudSync({
  projectId,
  initialVersion,
  onVersionConflict,
  readOnly,
  children,
}: {
  projectId: string;
  initialVersion: number;
  onVersionConflict: () => void;
  readOnly?: boolean;
  children: (state: { status: SyncStatus; isExiting: boolean; exitProject: () => Promise<void> }) => ReactNode;
}) {
  const store = useAppStore();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const acknowledgedRevisionRef = useRef<number>(store.revision);
  const versionRef = useRef<number>(initialVersion);
  const savePromiseRef = useRef<Promise<boolean> | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const imageSyncPromiseRef = useRef<Promise<boolean> | null>(null);
  const imageAbortRef = useRef<AbortController | null>(null);
  const imageSyncIdRef = useRef<string | null>(null);
  const mountedRef = useRef(true);
  const cloudImagesRef = useRef<ProjectImage[] | undefined>(undefined);
  const [saveStatus, setSaveStatus] = useState<SyncStatus>("saved");
  const [imageSyncing, setImageSyncing] = useState(false);
  const [imageSyncEpoch, setImageSyncEpoch] = useState(0);
  const [isExiting, setIsExiting] = useState(false);
  const handledConflictEpochRef = useRef(store.projectVersionConflictEpoch);

  useEffect(() => {
    if (store.acknowledgedProjectVersion === null) return;
    versionRef.current = reconcileConfirmedProjectVersion(
      versionRef.current,
      store.acknowledgedProjectVersion,
    );
  }, [store.acknowledgedProjectVersion]);

  useEffect(() => {
    if (
      store.projectVersionConflictEpoch <= handledConflictEpochRef.current
    ) return;
    handledConflictEpochRef.current = store.projectVersionConflictEpoch;
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    setSaveStatus("error");
    onVersionConflict();
  }, [onVersionConflict, store.projectVersionConflictEpoch]);

  const { data: cloudImages } = useListProjectImages(projectId);
  cloudImagesRef.current = cloudImages;

  const isImageCloudBacked = useCallback((imageId: string | null) => {
    if (!imageId) return true;
    return Boolean(
      (
        queryClient.getQueryData<ProjectImage[]>(getListProjectImagesQueryKey(projectId))
        ?? cloudImagesRef.current
      )?.some((image) => image.id === imageId),
    );
  }, [projectId, queryClient]);

  const saveLatest = useCallback(async (): Promise<boolean> => {
    if (readOnly) return true;
    if (savePromiseRef.current) return savePromiseRef.current;

    const snapshot = store.getLatestSnapshot();
    const currentRevision = store.getLatestRevision();
    if (!isImageCloudBacked(snapshot.roomImageId)) {
      if (mountedRef.current) setSaveStatus("unsaved");
      return false;
    }
    if (currentRevision === acknowledgedRevisionRef.current) {
      if (mountedRef.current) setSaveStatus("saved");
      return true;
    }

    const savingRevision = currentRevision;
    if (mountedRef.current) setSaveStatus("saving");
    const request = updateProject(projectId, {
      name: snapshot.project.name || "Unnamed Project",
      snapshot: toDurableSnapshot(snapshot) as any,
      version: versionRef.current,
    })
      .then((updated) => {
        versionRef.current = updated.version;
        store.acknowledgeProjectVersion(updated.version);
        acknowledgedRevisionRef.current = savingRevision;
        queryClient.setQueryData<Project>(
          getGetProjectQueryKey(projectId),
          updated,
        );
        queryClient.setQueryData<Project[]>(
          getListProjectsQueryKey(),
          (projects) => projects?.map((project) => (
            project.id === updated.id ? updated : project
          )),
        );
        if (mountedRef.current) {
          setSaveStatus(
            store.getLatestRevision() === savingRevision
              ? "saved"
              : "unsaved",
          );
        }
        return true;
      })
      .catch((err: any) => {
        if (mountedRef.current) setSaveStatus("error");
        if (err?.error?.includes("conflict") || err?.status === 409) {
          onVersionConflict();
        } else {
          toast.error("Failed to save to cloud. Your changes are still open.");
        }
        return false;
      })
      .finally(() => {
        savePromiseRef.current = null;
      });
    savePromiseRef.current = request;
    return request;
  }, [
    isImageCloudBacked,
    onVersionConflict,
    projectId,
    queryClient,
    readOnly,
    store,
  ]);

  const flushSave = useCallback(async (): Promise<boolean> => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const saved = await saveLatest();
      if (!saved) return false;
      if (store.getLatestRevision() === acknowledgedRevisionRef.current) {
        return true;
      }
    }
    if (mountedRef.current) setSaveStatus("error");
    return false;
  }, [saveLatest, store]);

  // Cloud Project Autosave
  useEffect(() => {
    if (readOnly || store.revision === acknowledgedRevisionRef.current) return undefined;
    setSaveStatus("unsaved");
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null;
      void flushSave();
    }, 2000);
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
    };
  }, [cloudImages, flushSave, readOnly, store.revision]);

  const syncCurrentImage = useCallback(async (): Promise<boolean> => {
    if (imageSyncPromiseRef.current) return imageSyncPromiseRef.current;
    const snapshot = store.getLatestSnapshot();
    const roomImageId = snapshot.roomImageId;
    if (!roomImageId) return true;

    const knownImages =
      queryClient.getQueryData<ProjectImage[]>(getListProjectImagesQueryKey(projectId))
      ?? cloudImagesRef.current;
    const cloudImage = knownImages?.find((image) => image.id === roomImageId);
    const memoryDataUrl =
      store.getSessionImageData(roomImageId)
      ?? (store.roomImageDataId === roomImageId ? store.roomImageDataUrl : null);

    if (cloudImage && memoryDataUrl) return true;
    if (!cloudImage && readOnly) return true;
    if (!cloudImage && knownImages === undefined) return false;
    if (!cloudImage && !memoryDataUrl) {
      toast.error("The room photo is not available to upload.");
      return false;
    }

    const controller = new AbortController();
    imageAbortRef.current = controller;
    imageSyncIdRef.current = roomImageId;
    if (mountedRef.current) setImageSyncing(true);

    const request = (async () => {
      try {
        if (cloudImage) {
          const blob = await getProjectImageContent(cloudImage.id, {
            signal: controller.signal,
            cache: "no-store",
          });
          const dataUrl = await blobToDataUrl(blob);
          if (controller.signal.aborted) return false;
          store.hydrateImage(roomImageId, dataUrl);
          return true;
        }

        const dataUrl = memoryDataUrl!;
        const blob = await (await fetch(dataUrl, { signal: controller.signal })).blob();
        const contentType =
          blob.type === "image/png"
            ? "image/png"
            : blob.type === "image/webp"
              ? "image/webp"
              : "image/jpeg";
        const fileName = `room-${roomImageId}.jpg`;
        const target = await requestProjectImageUpload(projectId, {
          fileName,
          contentType,
          byteSize: blob.size,
        }, { signal: controller.signal });
        const uploadResponse = await fetch(target.uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": contentType, "X-Kessick-CSRF": "1" },
          body: blob,
          signal: controller.signal,
        });
        if (!uploadResponse.ok) throw new Error("Upload rejected");
        const uploadedImage = await completeProjectImageUpload(projectId, {
          uploadId: target.uploadId,
        }, { signal: controller.signal });
        if (controller.signal.aborted) return false;

        queryClient.setQueryData<ProjectImage[]>(
          getListProjectImagesQueryKey(projectId),
          (images = []) => images.some((image) => image.id === uploadedImage.id)
            ? images
            : [...images, uploadedImage],
        );
        store.adoptCloudImageId(roomImageId, uploadedImage.id, dataUrl);
        return true;
      } catch (error) {
        if (!controller.signal.aborted) {
          toast.error(
            cloudImage
              ? "The protected room image could not be downloaded."
              : "The room image could not be uploaded.",
          );
        }
        return false;
      } finally {
        if (imageAbortRef.current === controller) imageAbortRef.current = null;
        if (imageSyncIdRef.current === roomImageId) imageSyncIdRef.current = null;
        imageSyncPromiseRef.current = null;
        if (mountedRef.current) {
          setImageSyncing(false);
          if (store.getLatestSnapshot().roomImageId !== roomImageId) {
            setImageSyncEpoch((epoch) => epoch + 1);
          }
        }
      }
    })();
    imageSyncPromiseRef.current = request;
    return request;
  }, [
    projectId,
    queryClient,
    readOnly,
    store.adoptCloudImageId,
    store.getLatestSnapshot,
    store.getSessionImageData,
    store.hydrateImage,
    store.roomImageDataId,
    store.roomImageDataUrl,
  ]);

  useEffect(() => {
    if (
      imageSyncIdRef.current
      && imageSyncIdRef.current !== store.roomImageId
    ) {
      imageAbortRef.current?.abort();
    }
    void syncCurrentImage();
  }, [cloudImages, imageSyncEpoch, store.roomImageId, store.roomImageDataId, syncCurrentImage]);

  useEffect(() => {
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      const dirty = store.getLatestRevision() !== acknowledgedRevisionRef.current;
      const latestImageId = store.getLatestSnapshot().roomImageId;
      if (
        !readOnly
        && (
          dirty
          || imageSyncPromiseRef.current
          || !isImageCloudBacked(latestImageId)
        )
      ) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => window.removeEventListener("beforeunload", warnBeforeUnload);
  }, [
    isImageCloudBacked,
    readOnly,
    store.getLatestRevision,
    store.getLatestSnapshot,
  ]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      imageAbortRef.current?.abort();
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  const prepareToLeave = useCallback(async (): Promise<boolean> => {
    if (readOnly) return true;
    setIsExiting(true);

    const imageReady = await syncCurrentImage();
    const currentImageId = store.getLatestSnapshot().roomImageId;
    if (!imageReady && !isImageCloudBacked(currentImageId)) {
      setIsExiting(false);
      toast.error("Please wait for the room photo to finish syncing before leaving.");
      return false;
    }

    const saved = await flushSave();
    if (!saved) {
      setIsExiting(false);
      toast.error("Your latest changes are not saved. Retry before leaving this project.");
      return false;
    }

    const latest = store.getLatestSnapshot();
    if (
      store.getLatestRevision() !== acknowledgedRevisionRef.current
      || !isImageCloudBacked(latest.roomImageId)
      || imageSyncPromiseRef.current
    ) {
      const finalImageReady = await syncCurrentImage();
      const finalSaved = await flushSave();
      const finalSnapshot = store.getLatestSnapshot();
      if (
        (!finalImageReady && !isImageCloudBacked(finalSnapshot.roomImageId))
        || !finalSaved
        || store.getLatestRevision() !== acknowledgedRevisionRef.current
        || !isImageCloudBacked(finalSnapshot.roomImageId)
      ) {
        setIsExiting(false);
        toast.error("The project changed while saving. Retry before leaving.");
        return false;
      }
    }
    return true;
  }, [flushSave, isImageCloudBacked, readOnly, store, syncCurrentImage]);

  const exitProject = useCallback(async () => {
    if (!(await prepareToLeave())) return;
    setLocation("/workspace");
  }, [prepareToLeave, setLocation]);

  useEffect(() => {
    let restoringEditorEntry = false;
    let allowNextBack = false;

    const handlePopState = (event: PopStateEvent) => {
      if (allowNextBack) {
        allowNextBack = false;
        return;
      }
      if (restoringEditorEntry) {
        event.stopImmediatePropagation();
        restoringEditorEntry = false;
        void prepareToLeave().then((ready) => {
          if (ready) {
            allowNextBack = true;
            window.history.back();
          }
        });
        return;
      }

      const latest = store.getLatestSnapshot();
      const needsBarrier = !readOnly && (
        store.getLatestRevision() !== acknowledgedRevisionRef.current
        || !isImageCloudBacked(latest.roomImageId)
      );
      if (!needsBarrier) return;

      event.stopImmediatePropagation();
      restoringEditorEntry = true;
      window.history.forward();
    };

    window.addEventListener("popstate", handlePopState, true);
    return () => window.removeEventListener("popstate", handlePopState, true);
  }, [isImageCloudBacked, prepareToLeave, readOnly, store]);

  const status: SyncStatus = imageSyncing ? "uploading" : saveStatus;
  return <>{children({ status, isExiting, exitProject })}</>;
}

export default function ProjectEditorPage() {
  const params = useParams();
  const projectId = params.projectId!;
  const {
    data: project,
    isLoading,
    isFetchedAfterMount,
    isFetching,
    error,
    refetch,
  } = useGetProject(projectId, {
    query: {
      queryKey: getGetProjectQueryKey(projectId),
      staleTime: 0,
      refetchOnMount: "always",
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    },
  });
  const { data: accountContext } = useGetAccount();
  const [location, setLocation] = useLocation();
  const [editorSession, setEditorSession] = useState<{
    projectId: string;
    project: Project;
  } | null>(null);
  const activeProject =
    editorSession?.projectId === projectId ? editorSession.project : null;

  useEffect(() => {
    if (
      project
      && isFetchedAfterMount
      && !error
      && editorSession?.projectId !== projectId
    ) {
      setEditorSession({ projectId, project });
    }
  }, [editorSession?.projectId, error, isFetchedAfterMount, project, projectId]);

  useEffect(() => {
    if (activeProject?.id) deleteProjectLocal(activeProject.id);
  }, [activeProject?.id]);

  if (!activeProject && (error || (!project && !isLoading))) {
    return (
      <div className="flex h-[100dvh] w-full flex-col items-center justify-center bg-background text-foreground">
        <p className="text-destructive mb-4">Failed to load project.</p>
        <button
          onClick={() => void refetch()}
          disabled={isFetching}
          className="mb-3 text-primary hover:underline disabled:opacity-50"
        >
          {isFetching ? "Retrying..." : "Retry"}
        </button>
        <button onClick={() => setLocation('/workspace')} className="text-muted-foreground hover:underline">
          Return to Projects
        </button>
      </div>
    );
  }

  if (!activeProject || isLoading || !isFetchedAfterMount || !accountContext) {
    return (
      <div className="flex h-[100dvh] w-full flex-col items-center justify-center bg-background text-muted-foreground">
        <Loader2 className="w-8 h-8 animate-spin mb-4" />
        <p>Loading workspace...</p>
      </div>
    );
  }

  const readOnly = accountContext.account.role === 'customer';

  let initialSnapshot = activeProject.snapshot
    ? (JSON.parse(JSON.stringify(activeProject.snapshot)) as StateSnapshot)
    : undefined;
  
  if (initialSnapshot) {
    initialSnapshot.project = initialSnapshot.project || {};
    initialSnapshot.project.id = activeProject.id;
    initialSnapshot.project.name = activeProject.name;
  }

  return (
    <>
      <AppProvider
        initialSnapshot={initialSnapshot}
        initialProjectVersion={activeProject.version}
        persistLocal={false}
        persistImages={false}
      >
        <CloudSync
          projectId={projectId}
          initialVersion={activeProject.version}
          readOnly={readOnly}
          onVersionConflict={() => toast.error("Another user modified this project. Please refresh to see latest changes.")}
        >
          {({ status, isExiting, exitProject }) => (
            <>
              {isExiting && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/70 backdrop-blur-sm cursor-wait">
                  <div className="flex items-center gap-3 border border-border bg-card px-5 py-3 text-sm text-foreground shadow-2xl">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    Securing your latest changes...
                  </div>
                </div>
              )}
              {readOnly && (
                <div className="absolute top-14 left-0 right-0 z-50 bg-accent/20 text-accent-foreground border-b border-accent/30 py-1.5 px-4 text-xs flex justify-center items-center gap-2">
                  <Lock className="w-3 h-3" />
                  <span>Read-Only Mode: You are viewing a shared design. Changes will not be saved.</span>
                </div>
              )}
              <HomeInner
                readOnly={readOnly || isExiting}
                syncStatus={readOnly ? undefined : status}
                onExitProject={exitProject}
              />
            </>
          )}
        </CloudSync>
      </AppProvider>
      {error && (
        <div
          role="alert"
          className="fixed bottom-4 left-1/2 z-[110] w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 border border-destructive/50 bg-card px-4 py-3 text-sm text-foreground shadow-2xl"
        >
          <p className="font-medium">
            {(error as { status?: number }).status === 401
            || (error as { status?: number }).status === 403
            || (error as { status?: number }).status === 404
              ? "Cloud access to this project changed."
              : "The cloud connection check failed."}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Your open editor has been preserved. Keep this tab open and retry before leaving.
          </p>
          <button
            onClick={() => void refetch()}
            disabled={isFetching}
            className="mt-2 text-xs font-medium text-primary hover:underline disabled:opacity-50"
          >
            {isFetching ? "Retrying..." : "Retry cloud check"}
          </button>
        </div>
      )}
    </>
  );
}