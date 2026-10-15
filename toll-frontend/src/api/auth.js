import { api, clearTokens } from './client';

export const register = (payload) =>
  api('/auth/register', { method: 'POST', body: payload });

export const verifyOtp = (phone, code) =>
  api('/auth/verify-otp', { method: 'POST', body: { phone_number: phone, code } });

export const resendOtp = (phone) =>
  api('/auth/resend-otp', { method: 'POST', body: { phone_number: phone } });

export const login = (identifier, password) => {
  const body = identifier.includes('@')
    ? { email: identifier, password }
    : { phone_number: identifier, password };
  return api('/auth/login', { method: 'POST', body });
};

export const forgotPassword = (phone) =>
  api('/auth/forgot-password', { method: 'POST', body: { phone_number: phone } });

export const resetPassword = (phone, code, newPassword) =>
  api('/auth/reset-password', {
    method: 'POST',
    body: { phone_number: phone, code, new_password: newPassword },
  });

export const getMe = () => api('/auth/me');

export const logout = () => clearTokens();