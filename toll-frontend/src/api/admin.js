import { api } from './client';

const qs = (params = {}) => {
  const s = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ''),
  ).toString();
  return s ? `?${s}` : '';
};

export const getSummary = () => api('/admin/summary');
export const getTariffs = () => api('/admin/tariffs');
export const createTariff = (p) => api('/admin/tariffs', { method: 'POST', body: p });
export const updateTariff = (id, p) => api(`/admin/tariffs/${id}`, { method: 'PATCH', body: p });
export const getGates = () => api('/admin/gates');
export const createGate = (p) => api('/admin/gates', { method: 'POST', body: p });
export const getUsers = (params = {}) => api(`/admin/users${qs(params)}`);
export const createUser = (p) => api('/admin/users', { method: 'POST', body: p });
export const setUserStatus = (id, status) =>
  api(`/admin/users/${id}/status`, { method: 'PATCH', body: { status } });
export const getAdminTransactions = (params = {}) => api(`/admin/transactions${qs(params)}`);
export const getRevenue = (params = {}) => api(`/admin/reports/revenue${qs(params)}`);
export const getAuditLog = (params = {}) => api(`/admin/reports/audit${qs(params)}`);
export const getViolations = (params = {}) => api(`/admin/violations${qs(params)}`);