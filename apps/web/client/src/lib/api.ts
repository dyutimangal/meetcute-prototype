const rawBaseUrl = import.meta.env.VITE_API_BASE_URL || "";
const apiBaseUrl = rawBaseUrl.replace(/\/+$/, "");

export const apiUrl = (path: string) => {
  if (!path.startsWith("/")) return `${apiBaseUrl}/${path}`;
  return `${apiBaseUrl}${path}`;
};
