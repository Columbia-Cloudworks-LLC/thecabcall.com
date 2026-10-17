import { redirect } from "next/navigation";
import { AdminLoginClient } from "@/components/AdminLoginClient";
import { getCurrentAdminSession } from "@/lib/auth";
import { loadLocalEnvVars } from "@/lib/d1-bridge";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Admin Sign-In — Restricted Change Advisory Board Console",
};

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const nextPath =
    typeof params.next === "string" && params.next.startsWith("/admin")
      ? params.next
      : "/admin/users";

  const session = await getCurrentAdminSession();
  if (session) {
    redirect(nextPath);
  }

  const errorCode =
    typeof params.error === "string" ? params.error : undefined;
  const errorMessage =
    typeof params.message === "string" ? params.message : undefined;
  const emailParam =
    typeof params.email === "string" ? params.email : undefined;

  const envVars = loadLocalEnvVars();

  return (
    <AdminLoginClient
      ownerEmailHint={envVars.OWNER_ADMIN_EMAIL}
      initialErrorCode={errorCode}
      initialErrorMessage={errorMessage}
      initialEmail={emailParam}
      nextPath={nextPath}
    />
  );
}
