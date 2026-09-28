const browserHost = globalThis.location?.hostname ?? "127.0.0.1";
const backendHost =
  browserHost === "localhost" || browserHost === "127.0.0.1"
    ? "127.0.0.1"
    : browserHost;
const wsProtocol = globalThis.location?.protocol === "https:" ? "wss" : "ws";
const frontendHost = globalThis.location?.host;
const apiUrl = import.meta.env.VITE_BACKEND_API_URL ?? "/api/v1";

export const env = {
  apiUrl,
  wsUrl: import.meta.env.VITE_BACKEND_WS_URL ?? `${wsProtocol}://${frontendHost || `${backendHost}:8000`}`
};
