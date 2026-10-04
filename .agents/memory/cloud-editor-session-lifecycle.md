---
name: Cloud editor session lifecycle
description: Prevents stale initialization and transient refetch failures from replacing active in-memory work.
---

A cloud editor must wait for a successful authoritative fetch before initialization. Once initialized, keep that exact editor session mounted through later project or account background-fetch failures; refresh cache state without reinitializing active runtime state.

Never acknowledge a project revision as saved while its current room-image reference is local-only. The image must be finalized as an authorized cloud image first, and every exit path must continue treating an unbacked image as dirty.

Keep session-scoped photo bytes keyed by image ID for as long as editor history can restore those IDs. Changing the active image may cancel its upload and clear display state, but must not destroy the bytes needed by undo/redo.

**Why:** Starting from a stale cached snapshot causes version conflicts, while replacing the editor on a transient fetch error discards unsaved in-memory work because cloud editors intentionally disable local persistence. Saving a local image ID before upload completion creates a falsely “saved” snapshot whose only photo bytes disappear on reload. A single active-image memory slot also makes undo/redo restore an ID whose bytes were already discarded.

**How to apply:** On each project-route mount, require a fresh fetch before creating the editor provider, update the exact project cache after saves, preserve children in parent account guards when cached identity data exists, and surface later fetch errors as non-destructive retry notices. Gate project writes and unload/navigation on the current image ID being cloud-backed. Cache photo bytes by ID only for the mounted editor session and clear the cache when that session ends.