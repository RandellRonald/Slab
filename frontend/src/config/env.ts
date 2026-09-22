const browserHost = globalThis.location?.hostname ?? "127.0.0.1";
const backendHost =
  browserHost === "localhost" || browserHost === "127.0.0.1"
    ? "127.0.0.1"
    : browserHost;
const apiProtocol = globalThis.location?.protocol === "https:" ? "https" : "http";
const wsProtocol = globalThis.location?.protocol === "https:" ? "wss" : "ws";

export const env = {
  apiUrl: import.meta.env.VITE_BACKEND_API_URL ?? `${apiProtocol}://${backendHost}:8000/api/v1`,
  wsUrl: import.meta.env.VITE_BACKEND_WS_URL ?? `${wsProtocol}://${backendHost}:8000`
};
