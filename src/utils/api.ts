import axios from "axios";
import { getToken } from "./auth.js";

const api = axios.create({
  baseURL: process.env.ENCLAVE_API_URL || "http://localhost:4000/api",
  timeout: 10000,
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
