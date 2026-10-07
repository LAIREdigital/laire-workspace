import { useCallback, useEffect, useState } from "react";
import type { Snapshot } from "../shared/types";
import { call } from "./api";
import { Sidebar } from "./components/sidebar";
import { EmptyState } from "./components/ui";
import { Login } from "./pages/login";
import { MyTasksPage } from "./pages/my-tasks";
import { InboxPage } from "./pages/inbox";
import { TimePage } from "./pages/time";
import { TeamPage } from "./pages/team";
import { CompanyPage, NewCompanyPage } from "./pages/company";
import { ProjectPage } from "./pages/project";
import { AppProvider, readToken, saveToken } from "./state";
import { useRoute, type Route } from "./router";

export function App() {
  const [token, setToken] = useState(readToken);
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(!!token);

  const signOut = useCallback(() => {
    saveToken("");
    setToken("");
    setSnap(null);
  }, []);

  useEffect(() => {
    if (!token) return;
    let live = true;
    call<Snapshot>("snapshot", token)
      .then((s) => live && setSnap(s))
      .catch(() => live && signOut())
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [token, signOut]);

  if (!token) {
    return (
      <Login
        onSignedIn={(t) => {
          saveToken(t);
          setLoading(true);
          setToken(t);
        }}
      />
    );
  }
  if (loading || !snap) {
    return (
      <div className="flex h-full items-center justify-center bg-plum">
        <p className="font-display text-sm font-semibold tracking-[0.2em] text-teal uppercase">Loading workspace</p>
      </div>
    );
  }
  return (
    <AppProvider initial={snap} token={token} onSignOut={signOut}>
      <Shell />
    </AppProvider>
  );
}

function Shell() {
  const route = useRoute();
  return (
    <div className="flex h-full">
      <Sidebar route={route} />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Page route={route} />
      </div>
    </div>
  );
}

function Page({ route }: { route: Route }) {
  const [section, id] = route.path;
  switch (section) {
    case "my-tasks":
      return <MyTasksPage route={route} />;
    case "inbox":
      return <InboxPage route={route} />;
    case "time":
      return <TimePage route={route} />;
    case "team":
      return <TeamPage />;
    case "companies":
      return id === "new" ? <NewCompanyPage /> : <CompanyPage id={id} />;
    case "projects":
      return <ProjectPage id={id} route={route} />;
    default:
      return (
        <div className="p-8">
          <EmptyState title="Page not found" />
        </div>
      );
  }
}
