export function reconcileConfirmedProjectName(
  currentName: string,
  previousCloudName: string | undefined,
  confirmedName: string,
) {
  return previousCloudName !== undefined && currentName === previousCloudName
    ? confirmedName
    : currentName;
}

export function reconcileConfirmedProjectVersion(
  currentVersion: number,
  confirmedVersion: number,
) {
  return Math.max(currentVersion, confirmedVersion);
}

export function canRebaseConfirmedProjectRename(
  acknowledgedEditorVersion: number | null,
  actionProjectVersion: number,
) {
  return acknowledgedEditorVersion === actionProjectVersion;
}