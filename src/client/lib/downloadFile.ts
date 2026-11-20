/** Hands `content` to the browser as a file download named `fileName`. */
export function downloadFile(content: string, type: string, fileName: string): void {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}
