import { useEffect, useState } from 'react';

/** Hash routes keep the app working from any static host and from a notification click. */
export function currentPath(): string[] {
  const h = window.location.hash.replace(/^#\/?/, '');
  return h.split('/').filter(Boolean).map(decodeURIComponent);
}

export function navigate(path: string, replace = false): void {
  const target = '#' + (path.startsWith('/') ? path : '/' + path);
  if (replace) window.location.replace(target);
  else window.location.hash = target;
}

export function useRoute(): string[] {
  const [path, setPath] = useState(currentPath);
  useEffect(() => {
    const on = () => {
      setPath(currentPath());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return path;
}
