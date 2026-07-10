import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

const api = axios.create({
  baseURL: API_BASE_URL,
});

api.interceptors.request.use((config) => {
  let token = null;
  if (config.url && config.url.startsWith("/admin")) {
    token = localStorage.getItem("hcp_admin_token");
  } else if (config.url && config.url.startsWith("/api/doctor")) {
    token = localStorage.getItem("hcp_doctor_token");
  } else {
    token = localStorage.getItem("hcp_crm_token") || localStorage.getItem("hcp_admin_token");
  }
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

// Admin endpoints
export const getAdminUsers = () => api.get("/admin/users");
export const getAdminUserActivity = (userId) => api.get(`/admin/users/${userId}/activity`);
export const adminCreateHcp = (hcpData) => api.post("/admin/hcp", hcpData);
export const adminUpdateHcp = (hcpId, hcpData) => api.put(`/admin/hcp/${hcpId}`, hcpData);
export const adminToggleHcpApproval = (hcpId) => api.put(`/admin/hcp/${hcpId}/toggle-approval`);
export const adminToggleUserStatus = (userId) => api.put(`/admin/user/${userId}/toggle-status`);
export const adminListHcps = () => api.get("/admin/hcps");

// Doctor Portal endpoints
export const doctorLogin = (email, password) => api.post("/auth/doctor-login", { email, password });
export const getDoctorProfile = () => api.get("/api/doctor/profile");
export const getDoctorInteractions = () => api.get("/api/doctor/interactions");
export const doctorBypassLogin = (hcpId) => api.post("/auth/doctor-bypass", { hcp_id: hcpId });
export const updateDoctorProfile = (hcpData) => api.put("/api/doctor/profile", hcpData);
export const doctorAllList = () => api.get("/api/doctor/all-list");

export default api;
