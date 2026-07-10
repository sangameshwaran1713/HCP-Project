import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

const api = axios.create({
  baseURL: API_BASE_URL,
});

api.interceptors.request.use((config) => {
  const token = config.url && config.url.startsWith("/admin")
    ? localStorage.getItem("hcp_admin_token")
    : localStorage.getItem("hcp_crm_token") || localStorage.getItem("hcp_admin_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auth endpoints
export const sendOtp = (name, email) => api.post("/auth/send-otp", { name, email });
export const verifyOtp = (email, otp) => api.post("/auth/verify-otp", { email, otp });
export const adminLogin = (password) => api.post("/auth/admin-login", { password });
export const trackActivity = (action, route) => api.post("/api/activity", { action, route });

// Core HCP / CRM endpoints
export const listHcps = (q = "") => api.get("/api/hcp", { params: { q } });
export const retrieveHcpData = (id) => api.get(`/api/hcp/${id}`);

export const listInteractions = () => api.get("/api/interactions");
export const getInteraction = (id) => api.get(`/api/interactions/${id}`);

// Specialized tool wrappers
export const logInteraction = (data) => api.post("/api/interactions/log", data);
export const editInteraction = (id, field, new_value) => api.put(`/api/interactions/${id}`, { field, new_value });
export const scheduleFollowup = (id, followup_preference) => 
  api.post(`/api/interactions/${id}/schedule-followup`, { followup_preference });
export const extractActionItems = (id) => api.get(`/api/interactions/${id}/action-items`);

// Tools Demo
export const runToolsDemo = () => api.get("/api/tools/demo");

// Chat conversational workspace
export const sendChatMessage = (message, history = []) => api.post("/api/chat", { message, history });

export default api;
