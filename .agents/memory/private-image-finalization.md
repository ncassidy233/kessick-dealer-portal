---
name: Private image finalization
description: Safety rule for promoting direct uploads into protected, same-origin image delivery.
---

Never serve a private object that can still be changed through a live signed upload URL. Bind the upload to a server-recorded actor/project intent, validate the exact object generation, and promote it to a separate create-only object before recording it as deliverable.

**Why:** A metadata-valid image could otherwise be finalized and then overwritten through the still-live upload URL with executable same-origin content.

**How to apply:** For any new protected direct-upload flow, keep upload targets temporary, finalize the validated generation to a different object path, and force the recorded safe content type with no-sniff response headers.

Upload authorization must also survive requests reaching different Autoscale instances; never keep a multi-request upload intent solely in process memory.

**Why:** A request, byte transfer, and completion can each land on a different instance. A process-local intent breaks valid uploads and encourages unsafe fallback behavior.

**How to apply:** Use persistent actor-bound intents or signed short-lived actor/path/type/size-bound tokens, with create-only object writes to prevent replay overwrite. Enforce byte limits during transfer, not only after storage has accepted the file.