const browserHost = globalThis.location?.hostname ?? "127.0.0.1";
const backendHost =
  browserHost === "localhost" || browserHost === "127.0.0.1"
    ? "127.0.0.1"
    : browserHost;
const wsProtocol = globalThis.location?.protocol === "https:" ? "wss" : "ws";
const frontendHost = globalThis.location?.host;

export const env = {
  apiUrl: import.meta.env.VITE_BACKEND_API_URL ?? "/api/v1",
  wsUrl: import.meta.env.VITE_BACKEND_WS_URL ?? `${wsProtocol}://${frontendHost || `${backendHost}:8000`}`
};
