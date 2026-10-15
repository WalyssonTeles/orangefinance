import { useEffect, useState } from "react";

export type Route = "inicio" | "lancamentos" | "contas" | "orcamentos" | "ajustes";

const ROUTES: Route[] = ["inicio", "lancamentos", "contas", "orcamentos", "ajustes"];

function read(): Route {
  const name = window.location.hash.replace(/^#\/?/, "");
  return (ROUTES as string[]).includes(name) ? (name as Route) : "inicio";
}

export function navigate(route: Route) {
  window.location.hash = route === "inicio" ? "/" : `/${route}`;
}

export function useRoute(): Route {
  const [route, setRoute] = useState(read);
  useEffect(() => {
    const onChange = () => {
      setRoute(read());
      window.scrollTo({ top: 0 });
    };
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return route;
}
