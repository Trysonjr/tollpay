// On the phone, import.meta.env uses your PC's LAN IP — see the .env.development line below.
export const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8080/api/v1';