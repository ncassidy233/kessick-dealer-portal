# Kessick Concierge: team knowledge and insights

## What “learning” means

The concierge searches approved documents and uses relevant passages as cited
sources when answering questions. Uploading does not retrain a model. Documents
do not become available to the concierge until a team member reviews and
activates them.

This library is separate from the dealer portal's downloadable resources.
Uploading a knowledge document does not publish it as a dealer resource.

## Team workflow

1. Sign in with an approved, persisted Kessick administrator or content-manager
   account and open **Knowledge** in the administration navigation.
2. Upload a text-based PDF or UTF-8 TXT file, up to 10 MiB. Give it a useful title
   and category.
3. Review the extracted text. Correct extraction mistakes before activation.
   Scanned PDFs need OCR outside the portal; an image-only file is not silently
   treated as learned material. Encrypted or interactive PDFs may be rejected.
4. Leave the audience as **Staff** for internal policies and private information.
   Choose **Approved dealers** only for material suitable for every approved
   dealer; explicitly confirm that choice.
5. Activate the document. Only active, audience-eligible material is searched.
6. Click **Test concierge** on the Knowledge page and ask a question answered by
   the document. The existing concierge panel opens without leaving the page or
   requiring a project. Review the exact quoted passage and citation, and any
   provider or credit-consent message, before sharing the material more widely.

Editing a document returns it to review. Reactivate it when the revised text is
ready. Deactivate, archive, or delete outdated documents to stop future use.
Removing a document does not recall copies someone has already downloaded.

Use descriptive product names, model numbers, and terminology in the documents:
retrieval is keyword-based, and uploading a document does not guarantee it will
be relevant to every question.

## Exporting knowledge

The library can be exported as JSON or plain text. These exports contain
document metadata and extracted text, not private storage URLs. Treat them as
confidential files because they can include staff-only material.

## Reviewing insights

Administrators can open **Concierge insights**, choose a date range, and export
the report as CSV. Dates are inclusive UTC calendar days, with a maximum
366-day range.

Reports show actual operational counts: conversations, answer outcomes, source
usage, and fixed knowledge-gap reasons. They deliberately exclude raw questions,
transcripts, project names, account names, and document quotations. They are not
AI-generated market research or a list of customer intentions.

## Access and operational notes

- Administrators and content managers manage the knowledge library.
- Only administrators view aggregate cross-account insights.
- Ordinary customers cannot retrieve either staff or approved-dealer knowledge.
- Approved-dealer knowledge additionally requires an approved organization and
  membership.
- AI answers retain the existing provider configuration and credit-consent
  requirements. Uploading and reviewing documents does not bypass those checks.
- New code and development data do not automatically change the published app.
  Consult `concierge-knowledge-api.md` for the deployment/schema instructions
  before publishing the portal and API together.