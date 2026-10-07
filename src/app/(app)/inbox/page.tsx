import { getNotifications, getPeople } from "@/lib/data";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/ui";
import { InboxList } from "./inbox-list";

export const metadata = { title: "Inbox" };

export default async function InboxPage() {
  const [items, people] = await Promise.all([getNotifications(), getPeople()]);
  return (
    <>
      <PageHeader title="Inbox" />
      <main className="flex-1 overflow-auto px-4 py-6 md:px-8">
        {items.length === 0 ? (
          <EmptyState title="Nothing new">Assignments, comments, mentions and approvals show up here.</EmptyState>
        ) : (
          <InboxList items={items} people={people} />
        )}
      </main>
    </>
  );
}
