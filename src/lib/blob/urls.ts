/** Build a same-origin URL that streams a private blob through our API. */
export function blobProxyUrl(pathname: string) {
  const normalized = pathname.replace(/^\/+/, "");
  return `/api/blob/${normalized.split("/").map(encodeURIComponent).join("/")}`;
}

export function canAccessBlobPath(organizationId: string, pathname: string) {
  const normalized = pathname.replace(/^\/+/, "");
  return normalized.startsWith(`properties/${organizationId}/`);
}
