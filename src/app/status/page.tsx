import React from "react";
import { ensureD1Snapshot } from "@/lib/store";
import { SystemStatusClient } from "@/components/SystemStatusClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "About & Feeds — Editorial Charter & Syndication Ledger",
};

export default async function SystemStatusPage() {
  await ensureD1Snapshot();

  return <SystemStatusClient />;
}
