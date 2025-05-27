import { getCookie } from "typescript-cookie";

export function headersWithAuth() {
    const token = getCookie('token');
    if (!token) return {};
    return {
        'Authorization': `Bearer ${token}`
    }
}