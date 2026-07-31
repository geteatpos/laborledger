import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { AdminSessionBar } from "../../components/admin-session-bar";
import { AdminNav } from "../../components/admin-nav";
import { fetchAuthMe, WorkspaceApiError } from "../../lib/workspace-auth";
import { requireSessionCookie } from "../../lib/api-bff";

type WorkspaceLayoutProps = {
  readonly children: ReactNode;
};

export default async function WorkspaceLayout({ children }: WorkspaceLayoutProps) {
  const cookieHeader = await requireSessionCookie();

  if (!cookieHeader) {
    redirect("/login");
  }

  let session;

  try {
    session = await fetchAuthMe(cookieHeader);
  } catch (error) {
    if (error instanceof WorkspaceApiError && error.status === 401) {
      redirect("/login");
    }

    throw error;
  }

  if (session.requiresCompanySelection) {
    redirect("/choose-company");
  }

  return (
    <div className="min-h-screen bg-surface">
      <div className="md:pl-[280px]">
        <AdminSessionBar session={session} />
      </div>
      <div className="border-b border-outline-variant/10 bg-surface-container-low-40 px-4 py-3 md:ml-[280px] md:hidden">
        <AdminNav variant="mobile" />
      </div>
      {children}
    </div>
  );
}
