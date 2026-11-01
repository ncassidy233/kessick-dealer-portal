import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { studioPageDocumentSchema } from "@workspace/api-zod";
import { StudioPage } from "@/components/studio-page";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { usePortalSession } from "@/lib/portal-session";
import {
  initialStudioPage,
  newSection,
  studioPages,
  studioRequest,
  studioSizes,
  type PageKey,
  type StudioDraft,
  type StudioHistory,
  type StudioPageDocument,
  type StudioSection,
} from "@/lib/page-studio";

const button =
  "inline-flex min-h-11 items-center justify-center rounded-lg border border-[#171715]/20 px-3 py-2 text-sm font-medium enabled:hover:bg-[#B39862]/15 disabled:cursor-not-allowed disabled:opacity-40";
const input =
  "min-h-11 w-full min-w-0 rounded-lg border border-[#171715]/20 bg-white px-3 py-2 text-sm text-[#171715]";
const errors = (error: unknown) =>
  error instanceof Error ? error.message : "Unable to complete this action.";

export default function PageStudio() {
  const [page, setPage] = useState<PageKey>("home");
  const dirty = useRef(false);
  const session = usePortalSession();
  const query = useQuery({
    queryKey: ["studio-draft", page],
    queryFn: ({ signal }) =>
      studioRequest<{ draft: StudioDraft | null }>(
        page,
        "draft",
        "GET",
        undefined,
        signal,
      ),
    retry: false,
    refetchOnWindowFocus: false,
  });
  if (query.isPending)
    return (
      <p className="p-8" role="status">
        Opening Page Studio…
      </p>
    );
  if (query.isError)
    return (
      <div className="p-8" role="alert">
        Page Studio could not be loaded.{" "}
        <button className={button} onClick={() => query.refetch()}>
          Retry
        </button>
      </div>
    );
  return (
    <Editor
      key={page}
      page={page}
      initial={query.data.draft}
      canEdit={Boolean(session.data?.capabilities.includes("content:write"))}
      canPublish={Boolean(session.data?.capabilities.includes("pages:publish"))}
      onDirty={(value) => {
        dirty.current = value;
      }}
      changePage={(next) => {
        if (
          !dirty.current ||
          window.confirm(
            "This page has unsaved changes. Leave it without saving?",
          )
        ) {
          dirty.current = false;
          setPage(next);
        }
      }}
      reload={() => {
        if (
          !dirty.current ||
          window.confirm(
            "Reload the server draft and discard your unsaved changes?",
          )
        ) {
          dirty.current = false;
          void query.refetch();
        }
      }}
    />
  );
}

function Editor({
  page,
  initial,
  canEdit,
  canPublish,
  changePage,
  onDirty,
}: {
  page: PageKey;
  initial: StudioDraft | null;
  canEdit: boolean;
  canPublish: boolean;
  changePage: (page: PageKey) => void;
  onDirty: (dirty: boolean) => void;
  reload: () => void;
}) {
  const [document, setDocument] = useState<StudioPageDocument>(
    () => initial?.document ?? initialStudioPage(page),
  );
  const [revision, setRevision] = useState(initial?.revision ?? 0);
  const [saved, setSaved] = useState(
    JSON.stringify(initial?.document ?? initialStudioPage(page)),
  );
  const [selected, select] = useState<string | undefined>(
    document.sections[0]?.id,
  );
  const [past, setPast] = useState<StudioPageDocument[]>([]);
  const [future, setFuture] = useState<StudioPageDocument[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState(
    initial ? "Saved draft" : "Template — save to create a draft",
  );
  const [device, setDevice] = useState<keyof typeof studioSizes>(() =>
    window.innerWidth < 640 ? "Mobile" : window.innerWidth < 1100 ? "Tablet" : "Desktop",
  );
  const [rotated, rotate] = useState(false);
  const [preview, setPreview] = useState(false);
  const [panel, setPanel] = useState<"layers" | "canvas" | "settings">(
    "canvas",
  );
  const [fullscreen, setFullscreen] = useState(false);
  const [confirmation, confirm] = useState<"publish" | number | null>(null);
  const [dragged, drag] = useState<string | null>(null);
  const busy = useRef(false);
  const client = useQueryClient();
  const history = useQuery({
    queryKey: ["studio-history", page],
    queryFn: ({ signal }) =>
      studioRequest<StudioHistory>(page, "history", "GET", undefined, signal),
    retry: false,
  });
  const serialized = JSON.stringify(document);
  const dirty = serialized !== saved || revision === 0;
  const validation = studioPageDocumentSchema.safeParse(document);
  const section = document.sections.find((item) => item.id === selected);
  useEffect(() => {
    onDirty(dirty);
  }, [dirty, onDirty]);
  useEffect(() => {
    const before = (event: BeforeUnloadEvent) => {
      if (dirty || busy.current) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    const leave = (event: MouseEvent) => {
      const anchor = (event.target as Element).closest?.("a[href]");
      if (
        dirty &&
        anchor &&
        !event.ctrlKey &&
        !event.metaKey &&
        !window.confirm("Leave Page Studio without saving your latest changes?")
      ) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.document.addEventListener("click", leave, true);
    window.addEventListener("beforeunload", before);
    return () => {
      window.removeEventListener("beforeunload", before);
      window.document.removeEventListener("click", leave, true);
    };
  }, [dirty]);
  const edit = (next: StudioPageDocument) => {
    if (!canEdit || busy.current) return;
    setPast((values) => [...values.slice(-49), document]);
    setFuture([]);
    setDocument(next);
    setStatus("Unsaved changes");
  };
  const patch = (values: Partial<StudioSection>) =>
    edit({
      ...document,
      sections: document.sections.map((item) =>
        item.id === selected ? ({ ...item, ...values } as StudioSection) : item,
      ),
    });
  const save = useCallback(async () => {
    if (busy.current || !canEdit || !validation.success || !dirty) return;
    busy.current = true;
    setSaving(true);
    setError("");
    setStatus("Saving draft…");
    try {
      const result = await studioRequest<{ draft: StudioDraft }>(
        page,
        "draft",
        "PUT",
        { document: validation.data, expectedRevision: revision },
      );
      setDocument(result.draft.document);
      setRevision(result.draft.revision);
      setSaved(JSON.stringify(result.draft.document));
      setStatus("All changes saved");
      client.setQueryData(["studio-draft", page], { draft: result.draft });
    } catch (problem) {
      setError(errors(problem));
      setStatus("Save failed — your changes remain open");
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }, [page, document, revision, dirty, canEdit, client]);
  useEffect(() => {
    if (!dirty || !validation.success || !canEdit || error || revision === 0)
      return;
    const timer = window.setTimeout(() => {
      void save();
    }, 1500);
    return () => window.clearTimeout(timer);
  }, [serialized, dirty, error, revision, canEdit, save]);
  const move = (id: string, to: number) => {
    const items = [...document.sections];
    const from = items.findIndex((item) => item.id === id);
    if (from < 0 || to < 0 || to >= items.length) return;
    items.splice(to, 0, items.splice(from, 1)[0]);
    edit({ ...document, sections: items });
  };
  const publish = async () => {
    if (
      busy.current ||
      !canPublish ||
      !history.data ||
      confirmation === null ||
      (confirmation === "publish" && (dirty || !validation.success))
    )
      return;
    busy.current = true;
    setSaving(true);
    setError("");
    try {
      const restoring = typeof confirmation === "number";
      await studioRequest(page, restoring ? "restore" : "publish", "POST", {
        expectedPublishedRevision: history.data.publishedRevision,
        ...(restoring
          ? { revision: confirmation }
          : { expectedDraftRevision: revision }),
      });
      setStatus(
        restoring
          ? `Version ${confirmation} restored as a new publication`
          : "Published to approved dealers",
      );
      await client.invalidateQueries({ queryKey: ["studio-history", page] });
      await client.invalidateQueries({
        predicate: (query) => query.queryKey.includes("published-page"),
      });
      confirm(null);
    } catch (problem) {
      setError(errors(problem));
    } finally {
      busy.current = false;
      setSaving(false);
    }
  };
  const resetFromServer = async () => {
    if (
      dirty &&
      !window.confirm(
        "Discard the unsaved changes and load the current server draft?",
      )
    )
      return;
    try {
      const result = await studioRequest<{ draft: StudioDraft | null }>(
        page,
        "draft",
      );
      const next = result.draft?.document ?? initialStudioPage(page);
      setDocument(next);
      setSaved(JSON.stringify(next));
      setRevision(result.draft?.revision ?? 0);
      setPast([]);
      setFuture([]);
      setError("");
      select(next.sections[0]?.id);
      setStatus("Reloaded server draft");
      await history.refetch();
    } catch (problem) {
      setError(errors(problem));
    }
  };
  const dimensions = studioSizes[device];
  return (
    <div
      className={`bg-white text-[#171715] ${fullscreen ? "fixed inset-0 z-[80] overflow-auto" : "min-h-full"}`}
    >
      <header className={`sticky z-30 border-b border-black/10 bg-white p-4 ${fullscreen ? "top-0" : "top-[76px]"}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[.22em] text-[#806731]">
              Kessick staff workspace
            </p>
            <h1 className="text-2xl font-medium">Page Studio</h1>
            <p className="mt-1 text-xs" role="status" aria-live="polite">
              {status} · Live version {history.data?.publishedRevision ?? "…"}
            </p>
          </div>
          <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap">
            <button
              className={button}
              disabled={!canEdit || saving || !dirty || !validation.success}
              onClick={() => void save()}
            >
              Save Draft
            </button>
            <button className={button} onClick={() => setPreview(!preview)}>
              {preview ? "Back to Editor" : "Preview"}
            </button>
            <button
              className={`${button} bg-[#171715] text-white`}
              disabled={
                !canPublish ||
                dirty ||
                saving ||
                !validation.success ||
                !history.data ||
                history.isError
              }
              onClick={() => confirm("publish")}
            >
              Publish
            </button>
            <button
              className={button}
              onClick={() => setFullscreen(!fullscreen)}
            >
              {fullscreen ? "Exit Full Screen" : "Full Screen"}
            </button>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-xs">
            Page
            <select
              className={input}
              value={page}
              disabled={saving}
              onChange={(event) => changePage(event.target.value as PageKey)}
            >
              {studioPages.map((key) => (
                <option key={key} value={key}>
                  {key === "home" ? "Dealer home" : key}
                </option>
              ))}
            </select>
          </label>
          {(Object.keys(studioSizes) as (keyof typeof studioSizes)[]).map(
            (name) => (
              <button
                key={name}
                className={button}
                aria-pressed={device === name}
                onClick={() => {
                  setDevice(name);
                  rotate(false);
                }}
              >
                {name}
              </button>
            ),
          )}
          <button className={button} onClick={() => rotate(!rotated)}>
            Rotate
          </button>
          <span className="text-xs">
            {rotated ? dimensions[1] : dimensions[0]} ×{" "}
            {rotated ? dimensions[0] : dimensions[1]}
          </span>
          {!preview && (
            <>
              <button
                className={button}
                disabled={!canEdit || saving || !past.length}
                onClick={() => {
                  setFuture((values) => [document, ...values]);
                  setDocument(past[past.length - 1]);
                  setPast(past.slice(0, -1));
                }}
              >
                Undo
              </button>
              <button
                className={button}
                disabled={!canEdit || saving || !future.length}
                onClick={() => {
                  setPast((values) => [...values, document]);
                  setDocument(future[0]);
                  setFuture(future.slice(1));
                }}
              >
                Redo
              </button>
            </>
          )}
        </div>
        {error && (
          <div
            role="alert"
            className="mt-3 border border-red-700 bg-red-50 p-3 text-sm text-red-900"
          >
            {error}
            <button
              className="ml-3 underline"
              onClick={() => void resetFromServer()}
            >
              Reload server draft
            </button>
          </div>
        )}
        {!validation.success && (
          <p role="alert" className="mt-3 text-sm text-red-800">
            {validation.error.issues[0]?.message} — check the selected section
            before saving.
          </p>
        )}
        {!canPublish && (
          <p className="mt-3 text-xs">
            Publishing and restoring require a staff administrator. You can save
            drafts for review.
          </p>
        )}
      </header>
      {!preview && (
        <div
          className="flex gap-2 border-b border-black/15 p-3 xl:hidden"
          aria-label="Editor panels"
        >
          {(["layers", "canvas", "settings"] as const).map((name) => (
            <button
              key={name}
              className={button}
              aria-pressed={panel === name}
              onClick={() => setPanel(name)}
            >
              {name === "layers"
                ? "Layers"
                : name === "canvas"
                  ? "Canvas"
                  : "Settings"}
            </button>
          ))}
        </div>
      )}
      <div
        className={`grid items-start ${preview ? "" : "xl:grid-cols-[240px_minmax(0,1fr)_280px]"}`}
      >
        {!preview && (
          <aside
            className={`${panel === "layers" ? "block" : "hidden"} xl:block space-y-4 border-b border-black/15 p-4 xl:sticky xl:top-48 xl:max-h-[75vh] xl:overflow-auto xl:border-r`}
          >
            <label className="block text-xs font-semibold">
              Page title
              <input
                className={`${input} mt-2`}
                disabled={!canEdit || saving}
                value={document.title}
                maxLength={160}
                onChange={(event) =>
                  edit({ ...document, title: event.target.value })
                }
              />
            </label>
            <h2 className="font-semibold">Sections & layers</h2>
            <ol className="space-y-2">
              {document.sections.map((item, index) => (
                <li
                  key={item.id}
                  draggable={canEdit && !saving}
                  onDragStart={() => drag(item.id)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    event.preventDefault();
                    if (dragged) move(dragged, index);
                    drag(null);
                  }}
                  className={`border p-2 ${selected === item.id ? "border-[#806731] bg-[#B39862]/15" : "border-black/15"}`}
                >
                  <button
                    className="min-h-11 w-full break-words text-left text-sm"
                    aria-pressed={selected === item.id}
                    onClick={() => select(item.id)}
                  >
                    {index + 1}. {item.heading || item.type}
                    {item.hidden ? " (hidden)" : ""}
                  </button>
                  <div className="flex flex-wrap gap-1">
                    <button
                      className={button}
                      aria-label={`Move ${item.heading} up`}
                      disabled={!canEdit || saving || index === 0}
                      onClick={() => move(item.id, index - 1)}
                    >
                      ↑
                    </button>
                    <button
                      className={button}
                      aria-label={`Move ${item.heading} down`}
                      disabled={
                        !canEdit ||
                        saving ||
                        index === document.sections.length - 1
                      }
                      onClick={() => move(item.id, index + 1)}
                    >
                      ↓
                    </button>
                    <button
                      className={button}
                      disabled={!canEdit || saving}
                      onClick={() =>
                        edit({
                          ...document,
                          sections: document.sections.map((value) =>
                            value.id === item.id
                              ? { ...value, hidden: !value.hidden }
                              : value,
                          ),
                        })
                      }
                    >
                      {item.hidden ? "Show" : "Hide"}
                    </button>
                  </div>
                </li>
              ))}
            </ol>
            <label className="block text-xs font-semibold">
              Add a section
              <select
                aria-label="Add a section"
                className={`${input} mt-2`}
                value=""
                disabled={!canEdit || saving || document.sections.length >= 40}
                onChange={(event) => {
                  const next = newSection(
                    event.target.value as StudioSection["type"],
                  );
                  edit({ ...document, sections: [...document.sections, next] });
                  select(next.id);
                }}
              >
                <option value="" disabled>
                  Choose section…
                </option>
                <option value="hero">Hero</option>
                <option value="text">Text</option>
                <option value="content_grid">Content grid</option>
              </select>
            </label>
            <div className="border-t border-black/15 pt-4">
              <h2 className="font-semibold">Version History</h2>
              {history.isError ? (
                <button className={button} onClick={() => history.refetch()}>
                  Retry version history
                </button>
              ) : history.data?.history.length ? (
                history.data.history.map((item) => (
                  <div
                    key={item.revision}
                    className="mt-3 border-b border-black/10 pb-3 text-xs"
                  >
                    <p>
                      Version {item.revision}
                      {item.revision === history.data.publishedRevision
                        ? " · Live"
                        : ""}
                    </p>
                    <p className="my-2">
                      {new Date(item.publishedAt).toLocaleString()}
                    </p>
                    <button
                      className={button}
                      disabled={
                        !canPublish ||
                        saving ||
                        dirty ||
                        item.revision === history.data.publishedRevision
                      }
                      onClick={() => confirm(item.revision)}
                    >
                      Restore version {item.revision}
                    </button>
                  </div>
                ))
              ) : (
                <p className="mt-2 text-xs">No published versions yet.</p>
              )}
            </div>
          </aside>
        )}
        <main
          className={`${preview || panel === "canvas" ? "block" : "hidden"} xl:block min-w-0 space-y-4 bg-[#f0f1f2] p-3 md:p-5`}
        >
          <p className="text-xs">
            Draft changes are private until Publish. Existing dealer tools
            remain below these sections.
          </p>
          <PreviewFrame
            width={rotated ? dimensions[1] : dimensions[0]}
            height={rotated ? dimensions[0] : dimensions[1]}
          >
            <StudioPage
              document={document}
              preview
              selectedId={preview ? undefined : selected}
              onSelect={preview ? undefined : select}
            />
          </PreviewFrame>
        </main>
        {!preview && (
          <aside
            className={`${panel === "settings" ? "block" : "hidden"} xl:block space-y-4 border-t border-black/15 p-4 xl:sticky xl:top-48 xl:max-h-[75vh] xl:overflow-auto xl:border-l`}
          >
            <h2 className="font-semibold">Section settings</h2>
            {section ? (
              <fieldset
                disabled={!canEdit || saving}
                className="space-y-4 disabled:opacity-60"
              >
                <Field label="Heading">
                  <input
                    className={input}
                    value={section.heading}
                    maxLength={200}
                    onChange={(event) => patch({ heading: event.target.value })}
                  />
                </Field>
                <Field label="Background">
                  <select
                    className={input}
                    value={section.background}
                    onChange={(event) =>
                      patch({
                        background: event.target
                          .value as StudioSection["background"],
                      })
                    }
                  >
                    {["dark", "light", "gold"].map((value) => (
                      <option key={value}>{value}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Spacing">
                  <select
                    className={input}
                    value={section.spacing}
                    onChange={(event) =>
                      patch({
                        spacing: event.target.value as StudioSection["spacing"],
                      })
                    }
                  >
                    {["compact", "comfortable", "generous"].map((value) => (
                      <option key={value}>{value}</option>
                    ))}
                  </select>
                </Field>
                {section.type === "text" && (
                  <Field label="Body text">
                    <textarea
                      className={input}
                      rows={7}
                      maxLength={10000}
                      value={section.body}
                      onChange={(event) => patch({ body: event.target.value })}
                    />
                  </Field>
                )}
                {section.type === "hero" && (
                  <>
                    <Field label="Supporting text">
                      <textarea
                        className={input}
                        rows={4}
                        maxLength={2000}
                        value={section.description}
                        onChange={(event) =>
                          patch({ description: event.target.value })
                        }
                      />
                    </Field>
                    <Field label="Alignment">
                      <select
                        className={input}
                        value={section.alignment}
                        onChange={(event) =>
                          patch({
                            alignment: event.target.value as
                              "left" | "center" | "right",
                          })
                        }
                      >
                        {["left", "center", "right"].map((value) => (
                          <option key={value}>{value}</option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Hero image URL">
                      <input
                        className={input}
                        type="url"
                        value={section.image?.url ?? ""}
                        placeholder="https://…"
                        onChange={(event) =>
                          patch({
                            image: event.target.value
                              ? {
                                  url: event.target.value,
                                  alt:
                                    section.image?.alt ?? "Kessick wine cellar",
                                  fit: section.image?.fit ?? "cover",
                                  focalPoint: section.image?.focalPoint ?? {
                                    x: 50,
                                    y: 50,
                                  },
                                }
                              : undefined,
                          })
                        }
                      />
                    </Field>
                    {section.image && (
                      <>
                        <Field label="Image alternative text">
                          <input
                            className={input}
                            maxLength={300}
                            value={section.image.alt}
                            onChange={(event) =>
                              patch({
                                image: {
                                  ...section.image!,
                                  alt: event.target.value,
                                },
                              })
                            }
                          />
                        </Field>
                        <Field label="Image fit">
                          <select
                            className={input}
                            value={section.image.fit}
                            onChange={(event) =>
                              patch({
                                image: {
                                  ...section.image!,
                                  fit: event.target.value as
                                    "cover" | "contain",
                                },
                              })
                            }
                          >
                            <option>cover</option>
                            <option>contain</option>
                          </select>
                        </Field>
                        {(["x", "y"] as const).map((axis) => (
                          <Field key={axis} label={`Image focal point ${axis}`}>
                            <input
                              type="range"
                              className="w-full"
                              min={0}
                              max={100}
                              value={section.image!.focalPoint[axis]}
                              onChange={(event) =>
                                patch({
                                  image: {
                                    ...section.image!,
                                    focalPoint: {
                                      ...section.image!.focalPoint,
                                      [axis]: Number(event.target.value),
                                    },
                                  },
                                })
                              }
                            />
                          </Field>
                        ))}
                      </>
                    )}
                    {section.actions.map((action, index) => (
                      <div
                        key={index}
                        className="space-y-3 border-t border-black/15 pt-3"
                      >
                        <Field label={`Button ${index + 1} label`}>
                          <input
                            className={input}
                            value={action.label}
                            maxLength={80}
                            onChange={(event) =>
                              patch({
                                actions: section.actions.map((value, i) =>
                                  i === index
                                    ? { ...value, label: event.target.value }
                                    : value,
                                ),
                              })
                            }
                          />
                        </Field>
                        <Field label={`Button ${index + 1} destination`}>
                          <input
                            className={input}
                            value={action.href}
                            onChange={(event) =>
                              patch({
                                actions: section.actions.map((value, i) =>
                                  i === index
                                    ? { ...value, href: event.target.value }
                                    : value,
                                ),
                              })
                            }
                          />
                        </Field>
                        <button
                          className={button}
                          onClick={() =>
                            patch({
                              actions: section.actions.filter(
                                (_, i) => i !== index,
                              ),
                            })
                          }
                        >
                          Remove button {index + 1}
                        </button>
                      </div>
                    ))}
                    {section.actions.length < 2 && (
                      <button
                        className={button}
                        onClick={() =>
                          patch({
                            actions: [
                              ...section.actions,
                              {
                                label: "Explore Kessick",
                                href: "/portal/collections",
                              },
                            ],
                          })
                        }
                      >
                        Add button
                      </button>
                    )}
                  </>
                )}
                {section.type === "content_grid" && (
                  <>
                    <Field label="Content source">
                      <select
                        className={input}
                        value={section.source}
                        onChange={(event) =>
                          patch({
                            source: event.target.value as typeof section.source,
                            contentIds: [],
                          })
                        }
                      >
                        {[
                          "project",
                          "product_series",
                          "training",
                          "resource",
                          "announcement",
                        ].map((value) => (
                          <option key={value}>{value}</option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Maximum columns">
                      <select
                        className={input}
                        value={section.columns}
                        onChange={(event) =>
                          patch({
                            columns: Number(event.target.value) as
                              1 | 2 | 3 | 4,
                          })
                        }
                      >
                        {[1, 2, 3, 4].map((value) => (
                          <option key={value}>{value}</option>
                        ))}
                      </select>
                    </Field>
                    <p className="text-xs">
                      Only published records visible to each dealer appear.
                      Manage records and audience targeting in Content.
                    </p>
                  </>
                )}
                <div className="flex flex-wrap gap-2">
                  <button
                    className={button}
                    disabled={document.sections.length >= 40}
                    onClick={() => {
                      const duplicate = {
                        ...structuredClone(section),
                        id: crypto.randomUUID(),
                      };
                      edit({
                        ...document,
                        sections: [...document.sections, duplicate],
                      });
                      select(duplicate.id);
                    }}
                  >
                    Duplicate
                  </button>
                  <button
                    className={`${button} text-red-800`}
                    onClick={() => {
                      edit({
                        ...document,
                        sections: document.sections.filter(
                          (item) => item.id !== section.id,
                        ),
                      });
                      select(undefined);
                    }}
                  >
                    Remove section
                  </button>
                </div>
              </fieldset>
            ) : (
              <p className="text-sm">
                Select a section in the canvas or layers panel.
              </p>
            )}
          </aside>
        )}
      </div>
      <Dialog
        open={confirmation !== null}
        onOpenChange={(open) => {
          if (!saving && !open) confirm(null);
        }}
      >
        <DialogContent>
          <DialogTitle>
            {confirmation === "publish"
              ? `Publish ${document.title}?`
              : `Restore version ${confirmation}?`}
          </DialogTitle>
          <DialogDescription>
            {confirmation === "publish"
              ? `${document.sections.filter((item) => !item.hidden).length} visible sections from saved draft ${revision} will replace the page design for approved dealers. Live version: ${history.data?.publishedRevision ?? 0}.`
              : "The selected version will become a new live publication. Your working draft remains available."}
          </DialogDescription>
          <div className="flex gap-3">
            <button
              className={button}
              disabled={saving}
              onClick={() => confirm(null)}
            >
              Cancel
            </button>
            <button
              className={`${button} bg-[#171715] text-white`}
              disabled={saving}
              onClick={() => void publish()}
            >
              {saving
                ? "Working…"
                : confirmation === "publish"
                  ? "Confirm Publish"
                  : "Confirm Restore"}
            </button>
          </div>
          {error && (
            <p role="alert" className="text-sm text-red-800">
              {error}
            </p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-2 text-xs font-semibold">
      <span>{label}</span>
      {children}
    </label>
  );
}

function PreviewFrame({
  width,
  height,
  children,
}: {
  width: number;
  height: number;
  children: ReactNode;
}) {
  const host = useRef<HTMLDivElement>(null);
  const [available, setAvailable] = useState(width);
  const [body, setBody] = useState<HTMLElement | null>(null);
  useEffect(() => {
    if (!host.current) return;
    const observer = new ResizeObserver((entries) =>
      setAvailable(entries[0].contentRect.width),
    );
    observer.observe(host.current);
    return () => observer.disconnect();
  }, []);
  const scale = Math.min(1, available / width);
  return (
    <div ref={host} className="w-full overflow-hidden">
      <div
        className="mx-auto"
        style={{ width: width * scale, height: height * scale }}
      >
        <iframe
          title="Kessick draft device preview"
          srcDoc="<!doctype html><html><head></head><body style='margin:0'></body></html>"
          onLoad={(event) => {
            const frame = event.currentTarget.contentDocument;
            if (!frame) return;
            frame.head.replaceChildren(
              ...Array.from(
                window.document.head.querySelectorAll(
                  'link[rel="stylesheet"], style',
                ),
              ).map((node) => node.cloneNode(true)),
            );
            setBody(frame.body);
          }}
          style={{
            display: "block",
            border: 0,
            width,
            height,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
            background: "#10100f",
          }}
        />
        {body && createPortal(children, body)}
      </div>
    </div>
  );
}
