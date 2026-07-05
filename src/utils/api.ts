import axios from "axios";
import { getToken } from "./auth.js";

// Production API URL — can be overridden via ENCLAVE_API_URL env var for self-hosted instances
const DEFAULT_API_URL = "https://enclaveapi.ankitbhavarthe.xyz/api";

const api = axios.create({
  baseURL: process.env.ENCLAVE_API_URL || DEFAULT_API_URL,
  timeout: 15000,
});

// Interceptor to inject PAT from keytar/secure file storage on every request
api.interceptors.request.use(
  async (config) => {
    const token = await getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export default api;

