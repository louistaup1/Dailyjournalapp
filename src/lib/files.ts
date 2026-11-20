/**
 * Hand a file to the person. On phones that support sharing files (iOS Safari,
 * Android Chrome) this opens the share sheet, which is the reliable way to save
 * from an installed web app. Elsewhere it downloads.
 */
export async function saveFile(name: string, mime: string, content: string): Promise<void> {
  const blob = new Blob([content], { type: mime });
  const file = new File([blob], name, { type: mime });
  const coarse = window.matchMedia?.('(pointer: coarse)').matches;
  if (coarse && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: name });
      return;
    } catch (e) {
      if ((e as DOMException)?.name === 'AbortError') return;
      // fall through to a download
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
