import { redirect } from "next/navigation";
import { getMe } from "@/lib/auth";
import { PageHeader } from "@/components/page-header";
import { NewCompanyForm } from "./new-company-form";

export const metadata = { title: "New company" };

export default async function NewCompanyPage() {
  const me = await getMe();
  if (me.role !== "staff") redirect("/my-tasks");
  return (
    <>
      <PageHeader title="New company" eyebrow="Client account, same as an Accelo company" />
      <main className="flex-1 overflow-auto px-4 py-6 md:px-8">
        <NewCompanyForm />
      </main>
    </>
  );
}
