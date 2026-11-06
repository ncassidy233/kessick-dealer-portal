import { validateAuthDestination } from "./auth-destination";
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');

export function getValidatedAuthRedirect(): string {
  return validateAuthDestination(new URLSearchParams(window.location.search).get('redirect_url'), window.location.origin, basePath);
}

export function authRouteWithRedirect(route: '/sign-in' | '/sign-up', redirect: string): string {
  return `${basePath}${route}?redirect_url=${encodeURIComponent(redirect)}`;
}
