import axios from "axios";

const envApiUrl = (import.meta.env.VITE_API_URL || "").trim();

const getApiBaseUrl = () => {
  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    const isLocalHost =
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "::1" ||
      host === "[::1]";

    if (isLocalHost) {
      return "http://localhost:8000/api";
    }
  }

  return envApiUrl || "http://localhost:8000/api";
};

export const api = axios.create({
  baseURL: getApiBaseUrl(),
  withCredentials: true,
});
