import { getMe } from "@/lib/auth";
import { getCompanies, getProjects, getUnreadCount } from "@/lib/data";
import { Sidebar } from "@/components/sidebar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [me, companies, projects, unread] = await Promise.all([
    getMe(),
    getCompanies(),
    getProjects(),
    getUnreadCount(),
  ]);
  return (
    <div className="flex h-full">
      <Sidebar me={me} companies={companies} projects={projects} unread={unread} />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">{children}</div>
    </div>
  );
}
