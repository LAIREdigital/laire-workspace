import { useEffect, useState } from "react";

export type Route = { path: string[]; query: URLSearchParams; href: string };

function parse(): Route {
  const raw = window.location.hash.replace(/^#/, "") || "/my-tasks";
  const [p, q = ""] = raw.split("?");
  return { path: p.split("/").filter(Boolean), query: new URLSearchParams(q), href: raw };
}

export function useRoute() {
  const [route, setRoute] = useState(parse);
  useEffect(() => {
    const on = () => setRoute(parse());
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return route;
}

export function navigate(href: string) {
  window.location.hash = href;
}

// Builds a link to the current page with some query values changed.
export function withQuery(route: Route, changes: Record<string, string | null | undefined>) {
  const q = new URLSearchParams(route.query);
  for (const [k, v] of Object.entries(changes)) {
    if (v) q.set(k, v);
    else q.delete(k);
  }
  const s = q.toString();
  return `/${route.path.join("/")}${s ? `?${s}` : ""}`;
}

export function Link({
  href,
  children,
  ...rest
}: { href: string } & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href">) {
  return (
    <a href={`#${href}`} target="_self" {...rest}>
      {children}
    </a>
  );
}
