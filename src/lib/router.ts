import { useEffect, useState } from "react";

export type Route = "inicio" | "lancamentos" | "contas" | "orcamentos" | "ajustes";

const ROUTES: Route[] = ["inicio", "lancamentos", "contas", "orcamentos", "ajustes"];

export interface AppLocation {
  route: Route;
  /** Second path segment, e.g. "perfil" in #/ajustes/perfil. */
  section: string | null;
  params: URLSearchParams;
}

export function parseHash(hash: string): AppLocation {
  const [path, query = ""] = hash.replace(/^#\/?/, "").split("?");
  const [name, section] = path.split("/");
  const route = (ROUTES as string[]).includes(name) ? (name as Route) : "inicio";
  return { route, section: route === "inicio" ? null : section || null, params: new URLSearchParams(query) };
}

export function routeHref(route: Route, section?: string | null, params?: Record<string, string>): string {
  const path = route === "inicio" ? "" : section ? `${route}/${section}` : route;
  const query = params && Object.keys(params).length ? `?${new URLSearchParams(params)}` : "";
  return `#/${path}${query}`;
}

export function navigate(route: Route, section?: string | null, params?: Record<string, string>) {
  const next = routeHref(route, section, params);
  if (window.location.hash === next) {
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  } else window.location.hash = next.slice(1);
}

export function navigateToTransactions(params: Record<string, string> = {}) {
  navigate("lancamentos", "lista", params);
}

/** Updates the URL without adding a history entry or triggering navigation. */
export function replaceParams(route: Route, section: string | null, params: Record<string, string>) {
  window.history.replaceState(window.history.state, "", routeHref(route, section, params));
}

export function useLocation(): AppLocation {
  const [current, setLocation] = useState(() => parseHash(window.location.hash));
  useEffect(() => {
    const onChange = () => {
      const next = parseHash(window.location.hash);
      setLocation((previous) => {
        if (previous.route !== next.route || previous.section !== next.section) window.scrollTo({ top: 0 });
        return next;
      });
    };
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return current;
}

export function useRoute(): Route {
  return useLocation().route;
}
