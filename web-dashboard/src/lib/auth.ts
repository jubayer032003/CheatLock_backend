import type { AuthUser } from "../types";

const TOKEN_KEY = "cheatlock.teacher.token";
const USER_KEY = "cheatlock.teacher.user";

export function saveAuth(token: string, user: AuthUser) {
  sessionStorage.setItem(TOKEN_KEY, token);
  sessionStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function getAuthToken() {
  return sessionStorage.getItem(TOKEN_KEY);
}

export function getAuthUser(): AuthUser | null {
  const rawUser = sessionStorage.getItem(USER_KEY);
  if (!rawUser) return null;

  try {
    return JSON.parse(rawUser) as AuthUser;
  } catch {
    clearAuth();
    return null;
  }
}

export function clearAuth() {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(USER_KEY);
}

export function isTeacherAuthenticated() {
  return Boolean(getAuthToken() && getAuthUser()?.role === "TEACHER");
}

