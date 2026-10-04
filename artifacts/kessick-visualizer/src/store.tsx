import React, { createContext, useContext, useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useUser } from '@clerk/react';
import { ProjectMetadata, SurveyEntity, CalibrationRecord, SurveyMode } from '@/types/survey';
import { DesignOption, ProductInstance } from '@/types/design';
import { ConstructionDocument, DEFAULT_CONSTRUCTION_DOCUMENT } from '@/types/construction-documents';
import { Estimate, DEFAULT_ESTIMATE_TAX } from '@/types/estimating';
import { ActivityEntry, PipelineStageId, PipelineState } from '@/types/pipeline';
import { createDefaultPipelineState } from '@/lib/pipeline-templates';
import { saveImageIDB, getImageIDB, deleteImageIDB } from '@/lib/idb';
import { clearActiveProjectLocal, getActiveProjectLocal, saveProjectLocal } from '@/lib/persistence';
import { ProjectCatalogSnapshot } from '@/types/catalog';
import {
  canRebaseConfirmedProjectRename,
  reconcileConfirmedProjectName,
  reconcileConfirmedProjectVersion,
} from '@/lib/project-reconciliation';

export interface StateSnapshot {
  project: ProjectMetadata;
  entities: SurveyEntity[];
  options: DesignOption[];
  activeOptionId: string;
  calibration: CalibrationRecord | null;
  pixelsPerInch: number | null;
  unit: 'in' | 'cm';
  roomImageId: string | null;
  canvasCoordinateVersion?: 2;
  lastSaved: number;
  instances?: ProductInstance[]; // for migration
  constructionDocument: ConstructionDocument;
  estimates: Estimate[];
  activeEstimateId: string | null;
  pipeline: PipelineState;
  catalogSnapshot?: ProjectCatalogSnapshot;
}

export function createFreshSnapshot(): StateSnapshot {
  const optionId = uuidv4();
  return {
    project: {
      id: uuidv4(),
      name: 'New Site Survey',
      client: '',
      address: '',
      surveyor: '',
      surveyDate: new Date().toISOString().split('T')[0],
      notes: ''
    },
    entities: [],
    options: [{
      id: optionId,
      name: 'Option 1',
      status: 'concept',
      instances: [],
      clientNotes: '',
      presentationSettings: { showDimensions: true, showClearances: true, showLighting: true }
    }],
    activeOptionId: optionId,
    calibration: null,
    pixelsPerInch: null,
    unit: 'in',
    roomImageId: null,
    canvasCoordinateVersion: 2,
    lastSaved: Date.now(),
    constructionDocument: DEFAULT_CONSTRUCTION_DOCUMENT(),
    estimates: [],
    activeEstimateId: null,
    pipeline: createDefaultPipelineState(),
  };
}

export function toDurableSnapshot(state: StateSnapshot): StateSnapshot {
  return {
    project: state.project,
    entities: state.entities,
    options: state.options,
    activeOptionId: state.activeOptionId,
    calibration: state.calibration,
    pixelsPerInch: state.pixelsPerInch,
    unit: state.unit,
    roomImageId: state.roomImageId,
    ...(state.canvasCoordinateVersion
      ? { canvasCoordinateVersion: state.canvasCoordinateVersion }
      : {}),
    lastSaved: state.lastSaved,
    ...(state.instances ? { instances: state.instances } : {}),
    constructionDocument: state.constructionDocument,
    estimates: state.estimates,
    activeEstimateId: state.activeEstimateId,
    pipeline: state.pipeline,
    ...(state.catalogSnapshot ? { catalogSnapshot: state.catalogSnapshot } : {}),
  };
}

export const DEFAULT_STATE: StateSnapshot = createFreshSnapshot();

export interface AppState extends StateSnapshot {
  actorName: string;
  revision: number;
  mode: SurveyMode;
  setMode: (mode: SurveyMode) => void;
  selectedIds: string[];
  setSelectedIds: (ids: string[]) => void;
  snapEnabled: boolean;
  setSnapEnabled: (b: boolean) => void;
  setUnit: (unit: 'in' | 'cm') => void;
  roomImageDataUrl: string | null;
  roomImageDataId: string | null;
  roomImageError: string | null;
  setRoomImage: (dataUrl: string | null) => Promise<void>;
  
  // Helpers
  instances: ProductInstance[]; 
  activeOption: DesignOption;
  setActiveOptionId: (id: string) => void;
  
  activeEstimate: Estimate | null;
  setActiveEstimateId: (id: string | null) => void;
  
  recordActivity: (action: string, details: string, stageId?: PipelineStageId) => void;
  
  commit: (updater: (draft: StateSnapshot) => StateSnapshot) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  
  loadProject: (snap: StateSnapshot) => Promise<void>;
  newProject: () => void;
  hydrateImage: (imageId: string, dataUrl?: string) => void;
  adoptCloudImageId: (localImageId: string, cloudImageId: string, dataUrl: string) => boolean;
  getSessionImageData: (imageId: string) => string | null;
  getLatestSnapshot: () => StateSnapshot;
  getLatestRevision: () => number;
  acknowledgedProjectVersion: number | null;
  acknowledgeProjectVersion: (version: number) => void;
  projectVersionConflictEpoch: number;
  reconcileConfirmedProject: (
    previousName: string | undefined,
    nextName: string,
    actionProjectVersion: number,
    confirmedVersion: number,
  ) => boolean;
}

const AppContext = createContext<AppState | undefined>(undefined);

// Migration helper
export function migrateSnap(snap: StateSnapshot): StateSnapshot {
  if (snap.instances && (!snap.options || snap.options.length === 0)) {
    const id = uuidv4();
    snap.options = [{
      id,
      name: 'Option 1',
      status: 'concept',
      instances: snap.instances,
      clientNotes: '',
      presentationSettings: { showDimensions: true, showClearances: true, showLighting: true }
    }];
    snap.activeOptionId = id;
    delete snap.instances;
  }
  if (!snap.options) {
    snap.options = DEFAULT_STATE.options;
    snap.activeOptionId = DEFAULT_STATE.activeOptionId;
  }
  if (!snap.constructionDocument) {
    snap.constructionDocument = DEFAULT_CONSTRUCTION_DOCUMENT();
  }
  if (!snap.estimates) {
    snap.estimates = [];
    snap.activeEstimateId = null;
  }
  if (!snap.pipeline) {
    snap.pipeline = createDefaultPipelineState();
  }
  const legacyProductIds = new Set<string>();
  snap.options = snap.options.map(option => ({
    ...option,
    instances: option.instances.map(instance => {
      if (instance.productSnapshot) return instance;
      legacyProductIds.add(instance.productId);
      return { ...instance, catalogReconciliationRequired: true };
    }),
  }));
  if (!snap.catalogSnapshot) {
    snap.catalogSnapshot = {
      schemaVersion: 1,
      releases: [],
      products: {},
      prices: {},
      migrationWarnings: legacyProductIds.size
        ? [`${legacyProductIds.size} legacy product record(s) require catalog reconciliation.`]
        : [],
    };
  }
  return snap;
}

export function updateActiveInstances(s: StateSnapshot, updater: (insts: ProductInstance[]) => ProductInstance[]): StateSnapshot {
  return {
    ...s,
    options: s.options.map(o => o.id === s.activeOptionId ? { ...o, instances: updater(o.instances) } : o)
  };
}

export function AppProvider({ children, initialSnapshot, initialProjectVersion, persistLocal = true, persistImages = persistLocal }: { children: React.ReactNode, initialSnapshot?: StateSnapshot, initialProjectVersion?: number, persistLocal?: boolean, persistImages?: boolean }) {
  const { user } = useUser();
  const userName = user?.fullName || user?.primaryEmailAddress?.emailAddress || 'Unknown User';

  const [historyState, setHistoryState] = useState(() => {
    const activeProject = initialSnapshot ?? getActiveProjectLocal();
    return {
      history: [activeProject ? migrateSnap(activeProject) : DEFAULT_STATE],
      historyIndex: 0,
    };
  });
  const historyStateRef = useRef(historyState);
  const { history, historyIndex } = historyState;
  const [revision, setRevision] = useState(0);
  const [acknowledgedProjectVersion, setAcknowledgedProjectVersion] =
    useState<number | null>(initialProjectVersion ?? null);
  const acknowledgedProjectVersionRef =
    useRef<number | null>(initialProjectVersion ?? null);
  const [projectVersionConflictEpoch, setProjectVersionConflictEpoch] =
    useState(0);
  const revisionRef = useRef(0);
  
  const [mode, setMode] = useState<SurveyMode>('select');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [roomImageDataUrl, setRoomImageDataUrl] = useState<string | null>(null);
  const [roomImageDataId, setRoomImageDataId] = useState<string | null>(null);
  const [roomImageError, setRoomImageError] = useState<string | null>(null);
  const sessionImageDataRef = useRef<Map<string, string>>(new Map());

  const current = history[historyIndex];

  useEffect(() => {
    const sessionImages = sessionImageDataRef.current;
    return () => {
      sessionImages.clear();
    };
  }, []);

  const bumpRevision = useCallback(() => {
    revisionRef.current += 1;
    setRevision(revisionRef.current);
  }, []);
  
  const activeOption = useMemo(() => {
    return current.options.find(o => o.id === current.activeOptionId) || current.options[0];
  }, [current.options, current.activeOptionId]);

  const activeEstimate = useMemo(() => {
    if (!current.activeEstimateId) return null;
    return current.estimates.find(e => e.id === current.activeEstimateId) || null;
  }, [current.estimates, current.activeEstimateId]);

  const instances = activeOption?.instances || [];

  // Autosave
  useEffect(() => {
    if (!persistLocal) return undefined;
    if (current.roomImageId && current.canvasCoordinateVersion !== 2) {
      return undefined;
    }
    if (current.project.name !== 'New Site Survey' || current.entities.length > 0 || instances.length > 0 || current.roomImageId) {
      const timeout = setTimeout(() => {
        saveProjectLocal(current);
      }, 1000);
      return () => clearTimeout(timeout);
    }
    return undefined;
  }, [current, instances.length, persistLocal]);

  useEffect(() => {
    if (!persistLocal) return undefined;
    const flushActiveProject = () => {
      if (
        current.canvasCoordinateVersion === 2
        && (current.project.name !== 'New Site Survey'
          || current.entities.length > 0
          || instances.length > 0
          || current.roomImageId)
      ) {
        saveProjectLocal(current);
      }
    };
    window.addEventListener('pagehide', flushActiveProject);
    return () => window.removeEventListener('pagehide', flushActiveProject);
  }, [current, instances.length, persistLocal]);

  // Keep the active project's durable image in sync with browser memory.
  useEffect(() => {
    let cancelled = false;

    if (!current.roomImageId) {
      setRoomImageDataUrl(null);
      setRoomImageDataId(null);
      setRoomImageError(null);
      return () => {
        cancelled = true;
      };
    }

    if (!persistImages) {
      const sessionDataUrl = sessionImageDataRef.current.get(current.roomImageId);
      if (sessionDataUrl) {
        setRoomImageDataUrl(sessionDataUrl);
        setRoomImageDataId(current.roomImageId);
      } else if (roomImageDataId !== current.roomImageId) {
        setRoomImageDataUrl(null);
        setRoomImageDataId(null);
      }
      setRoomImageError(null);
      return () => {
        cancelled = true;
      };
    }

    const sessionDataUrl = sessionImageDataRef.current.get(current.roomImageId);
    if (sessionDataUrl) {
      setRoomImageDataUrl(sessionDataUrl);
      setRoomImageDataId(current.roomImageId);
      setRoomImageError(null);
      return () => {
        cancelled = true;
      };
    }

    if (roomImageDataId !== current.roomImageId) {
      setRoomImageDataUrl(null);
      setRoomImageDataId(null);
    }
    setRoomImageError(null);
    getImageIDB(current.roomImageId)
      .then((dataUrl) => {
        if (cancelled) return;
        if (dataUrl) {
          setRoomImageDataUrl(dataUrl);
          setRoomImageDataId(current.roomImageId);
        } else {
          setRoomImageDataUrl(null);
          setRoomImageDataId(null);
          setRoomImageError(
            'The saved room photo is unavailable. Upload it again to continue this project.',
          );
        }
      })
      .catch(() => {
        if (cancelled) return;
        setRoomImageDataUrl(null);
        setRoomImageDataId(null);
        setRoomImageError(
          'The saved room photo could not be opened. Upload it again to continue this project.',
        );
      });

    return () => {
      cancelled = true;
    };
  }, [current.roomImageId, persistImages, roomImageDataId]);

  const commit = useCallback((updater: (draft: StateSnapshot) => StateSnapshot) => {
    const previous = historyStateRef.current;
    const next = updater(previous.history[previous.historyIndex]);
    const newHistory = previous.history.slice(0, previous.historyIndex + 1);
    newHistory.push({
      ...next,
      lastSaved: Math.max(Date.now(), previous.history[previous.historyIndex].lastSaved + 1),
    });
    const updated = {
      history: newHistory,
      historyIndex: newHistory.length - 1,
    };
    historyStateRef.current = updated;
    setHistoryState(updated);
    bumpRevision();
  }, [bumpRevision]);

  const acknowledgeProjectVersion = useCallback((version: number) => {
    acknowledgedProjectVersionRef.current = version;
    setAcknowledgedProjectVersion(version);
  }, []);

  const reconcileConfirmedProject = useCallback((
    previousName: string | undefined,
    nextName: string,
    actionProjectVersion: number,
    confirmedVersion: number,
  ) => {
    if (
      !canRebaseConfirmedProjectRename(
        acknowledgedProjectVersionRef.current,
        actionProjectVersion,
      )
    ) {
      setProjectVersionConflictEpoch((epoch) => epoch + 1);
      return false;
    }
    acknowledgeProjectVersion(
      reconcileConfirmedProjectVersion(actionProjectVersion, confirmedVersion),
    );
    const latest =
      historyStateRef.current.history[historyStateRef.current.historyIndex];
    const reconciledName = reconcileConfirmedProjectName(
      latest.project.name,
      previousName,
      nextName,
    );
    if (latest.project.name !== reconciledName) {
      commit((snapshot) => ({
        ...snapshot,
        project: { ...snapshot.project, name: reconciledName },
      }));
    }
    return true;
  }, [acknowledgeProjectVersion, commit]);

  const undo = useCallback(() => {
    const previous = historyStateRef.current;
    if (previous.historyIndex <= 0) return;
    const updated = { ...previous, historyIndex: previous.historyIndex - 1 };
    historyStateRef.current = updated;
    setHistoryState(updated);
    bumpRevision();
  }, [bumpRevision]);

  const redo = useCallback(() => {
    const previous = historyStateRef.current;
    if (previous.historyIndex >= previous.history.length - 1) return;
    const updated = { ...previous, historyIndex: previous.historyIndex + 1 };
    historyStateRef.current = updated;
    setHistoryState(updated);
    bumpRevision();
  }, [bumpRevision]);

  const recordActivity = useCallback((action: string, details: string, stageId?: PipelineStageId) => {
    commit(s => {
      const newActivity: ActivityEntry = {
        id: uuidv4(),
        date: new Date().toISOString(),
        userId: userName,
        action,
        details,
        stageId: stageId ?? ''
      };
      return {
        ...s,
        pipeline: {
          ...s.pipeline,
          activity: [newActivity, ...s.pipeline.activity]
        }
      };
    });
  }, [commit, userName]);

  const hydrateImage = useCallback((imageId: string, dataUrl?: string) => {
    if (dataUrl) {
      sessionImageDataRef.current.set(imageId, dataUrl);
    }
    const latest = historyStateRef.current;
    if (latest.history[latest.historyIndex].roomImageId !== imageId) return;
    if (dataUrl) {
      setRoomImageError(null);
      setRoomImageDataUrl(dataUrl);
      setRoomImageDataId(imageId);
    }
  }, []);

  const adoptCloudImageId = useCallback((localImageId: string, cloudImageId: string, dataUrl: string) => {
    const previous = historyStateRef.current;
    const currentSnapshot = previous.history[previous.historyIndex];
    if (currentSnapshot.roomImageId !== localImageId) return false;

    const history = previous.history.map((snapshot, index) => {
      if (snapshot.roomImageId !== localImageId) return snapshot;
      return {
        ...snapshot,
        roomImageId: cloudImageId,
        lastSaved: index === previous.historyIndex
          ? Math.max(Date.now(), snapshot.lastSaved + 1)
          : snapshot.lastSaved,
      };
    });
    const updated = { history, historyIndex: previous.historyIndex };
    historyStateRef.current = updated;
    setHistoryState(updated);
    sessionImageDataRef.current.delete(localImageId);
    sessionImageDataRef.current.set(cloudImageId, dataUrl);
    setRoomImageError(null);
    setRoomImageDataUrl(dataUrl);
    setRoomImageDataId(cloudImageId);
    bumpRevision();
    return true;
  }, [bumpRevision]);

  const getLatestSnapshot = useCallback(() => {
    const latest = historyStateRef.current;
    return latest.history[latest.historyIndex];
  }, []);

  const getLatestRevision = useCallback(() => revisionRef.current, []);

  const getSessionImageData = useCallback(
    (imageId: string) => sessionImageDataRef.current.get(imageId) ?? null,
    [],
  );

  const setRoomImage = async (dataUrl: string | null) => {
    if (dataUrl) {
      try {
        const imgId = uuidv4();
        if (persistImages) {
          await saveImageIDB(imgId, dataUrl);
        }
        sessionImageDataRef.current.set(imgId, dataUrl);
        setRoomImageError(null);
        setRoomImageDataUrl(dataUrl);
        setRoomImageDataId(imgId);
        commit(s => ({ ...s, roomImageId: imgId }));
      } catch {
        setRoomImageError(
          'The room photo could not be saved in this browser. Check storage permissions and try again.',
        );
        throw new Error('Unable to save the room photo');
      }
    } else {
      const latest = getLatestSnapshot();
      if (persistImages && latest.roomImageId) {
        await deleteImageIDB(latest.roomImageId);
      }
      setRoomImageError(null);
      setRoomImageDataUrl(null);
      setRoomImageDataId(null);
      commit(s => ({ ...s, roomImageId: null, pixelsPerInch: null, calibration: null }));
    }
  };

  const loadProject = async (snap: StateSnapshot) => {
    sessionImageDataRef.current.clear();
    const migrated = migrateSnap(snap);
    const updated = { history: [migrated], historyIndex: 0 };
    historyStateRef.current = updated;
    setHistoryState(updated);
    bumpRevision();
    if (roomImageDataId !== migrated.roomImageId) {
      setRoomImageDataUrl(null);
      setRoomImageDataId(null);
    }
    setRoomImageError(null);
    setSelectedIds([]);
    setMode('select');
  };

  const newProject = () => {
    sessionImageDataRef.current.clear();
    const fresh = createFreshSnapshot();
    fresh.catalogSnapshot = getLatestSnapshot().catalogSnapshot; // preserve catalog
    clearActiveProjectLocal();
    const updated = { history: [fresh], historyIndex: 0 };
    historyStateRef.current = updated;
    setHistoryState(updated);
    bumpRevision();
    setRoomImageDataUrl(null);
    setRoomImageDataId(null);
    setRoomImageError(null);
    setSelectedIds([]);
    setMode('select');
  };

  const setUnit = useCallback((unit: 'in' | 'cm') => {
    commit(s => ({ ...s, unit }));
  }, [commit]);

  const setActiveOptionId = useCallback((id: string) => {
    commit(s => ({ ...s, activeOptionId: id }));
    setSelectedIds([]); // clear selection when switching options
  }, [commit]);

  const setActiveEstimateId = useCallback((id: string | null) => {
    commit(s => ({ ...s, activeEstimateId: id }));
  }, [commit]);

  const value = useMemo(() => ({
    ...current,
    actorName: userName,
    revision,
    mode, setMode,
    selectedIds, setSelectedIds,
    snapEnabled, setSnapEnabled,
    setUnit,
    roomImageDataUrl, roomImageDataId, roomImageError, setRoomImage,
    instances, activeOption, setActiveOptionId,
    activeEstimate, setActiveEstimateId,
    recordActivity,
    commit, undo, redo,
    acknowledgedProjectVersion, acknowledgeProjectVersion,
    projectVersionConflictEpoch, reconcileConfirmedProject,
    canUndo: historyIndex > 0,
    canRedo: historyIndex < history.length - 1,
    loadProject, newProject, hydrateImage, adoptCloudImageId, getSessionImageData, getLatestSnapshot, getLatestRevision
  }), [
    current, userName, revision, mode, selectedIds, snapEnabled, roomImageDataUrl, roomImageDataId, roomImageError,
    instances, activeOption, setActiveOptionId,
    activeEstimate, setActiveEstimateId,
    recordActivity,
    commit, undo, redo, historyIndex, history.length, setUnit, hydrateImage, adoptCloudImageId, getSessionImageData, getLatestSnapshot, getLatestRevision,
    acknowledgedProjectVersion, acknowledgeProjectVersion,
    projectVersionConflictEpoch, reconcileConfirmedProject
  ]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppStore() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useAppStore must be used within AppProvider');
  return context;
}
