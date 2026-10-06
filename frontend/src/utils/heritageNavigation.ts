import type { ViewType } from '../types';

const views: ViewType[] = ['home', 'explore', 'map', 'events', 'plan', 'saved', 'about', 'contact', 'tourism-office', 'admin'];

export function parseHeritageRoute(hash: string): { view: ViewType; siteId: string | null } {
  if (hash.startsWith('#/heritage')) {
    const match = /^#\/heritage\/([1-9]\d*)\/?$/.exec(hash);
    return { view: 'site-detail', siteId: match?.[1] || null };
  }
  const view = hash.replace(/^#\//, '') as ViewType;
  return { view: views.includes(view) ? view : 'home', siteId: null };
}

export function heritageSiteUrl(id: string, href: string): string {
  const url = new URL(href);
  url.hash = `/heritage/${encodeURIComponent(id)}`;
  return url.href;
}
