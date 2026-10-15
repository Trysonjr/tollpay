import { api } from './client';

export const getWallet = () => api('/wallet');
export const getVehicles = () => api('/vehicles');
export const addVehicle = (p) => api('/vehicles', { method: 'POST', body: p });
export const updateVehicle = (id, p) => api(`/vehicles/${id}`, { method: 'PATCH', body: p });

export const getTransactions = (params = {}) => {
  const qs = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ''),
  ).toString();
  return api(`/transactions${qs ? `?${qs}` : ''}`);
};

export const getNotifications = () => api('/notifications');
export const markNotificationRead = (id) => api(`/notifications/${id}/read`, { method: 'PATCH' });

export const initiateTopup = (p) => api('/wallet/topup/initiate', { method: 'POST', body: p });
export const getTopup = (id) => api(`/wallet/topup/${id}`);
export const getTopups = (page = 1) => api(`/wallet/topups?page=${page}`);

export const getRates = () => api('/rates');
export const getPasses = () => api('/wallet/passes');
export const buyPass = (p) => api('/wallet/passes', { method: 'POST', body: p });

export const getOutbox = () => api('/dev/outbox');
export const momoApprove = (ref) => api(`/mock/momo/${ref}/approve`, { method: 'POST' });
export const momoDecline = (ref) => api(`/mock/momo/${ref}/decline`, { method: 'POST' });
export const momoTimeout = (ref) => api(`/mock/momo/${ref}/timeout`, { method: 'POST' });