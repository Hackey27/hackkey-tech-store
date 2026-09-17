import { User } from 'firebase/auth';
import { AdminData } from './types';

export class AdminApiError extends Error {
  status: number;
  validationErrors?: Array<{ row?: number; field?: string; message: string }>;

  constructor(message: string, status: number, validationErrors?: Array<{ row?: number; field?: string; message: string }>) {
    super(message);
    this.status = status;
    this.validationErrors = validationErrors;
  }
}

export async function adminRequest<T>(user: User, path: string, init: RequestInit = {}): Promise<T> {
  const token = await user.getIdToken();
  const response = await fetch(`/api/admin${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers || {})
    }
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new AdminApiError(body.error || `Request failed (${response.status}).`, response.status, body.validationErrors);
  }
  return body as T;
}

export const loadAdminData = (user: User) => adminRequest<AdminData>(user, '/data');
