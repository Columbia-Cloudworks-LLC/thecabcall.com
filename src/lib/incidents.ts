import { revalidatePath } from "next/cache";
import {
  createLocalR2AudioAdapter,
  createLocalSqliteD1Adapter,
  ensureD1Snapshot,
  getEffectiveWorkerUrl,
  loadLocalEnvVars,
  shouldUseRemoteWorker,
} from "./d1-bridge";
import { appendAuditEntry } from "@/pipeline/audit";
import {
  AdminIncidentRecord,
  attachIncidentImage,
  EditorialAdminActor,
  ensureEditorialPipelineSchema,
  getAdminIncidentById,
  ImageSourceType,
  listAdminIncidentsAndTransforms,
  listPipelineTransforms,
  overrideIncidentBriefAndClassification,
  PipelineTransformRecord,
  rewriteIncidentTitle,
  updatePipelineTransform,
  uploadAdminMediaToR2,
} from "@/pipeline/editorial";
import { JevSreFailureModeKey, JevWorkingToolKey } from "@/pipeline/jev";
import { runSynthesizePipeline } from "@/pipeline/synthesize";

export * from "@/pipeline/editorial";

function buildAdminHeaders(actor?: EditorialAdminActor): Record<string, string> {
  const envVars = loadLocalEnvVars();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    "x-admin-secret": envVars.ADMIN_SECRET,
  };
  if (actor?.actorEmail) {
    headers["x-actor-email"] = actor.actorEmail;
  }
  if (actor?.actorRole) {
    headers["x-actor-role"] = actor.actorRole;
  }
  if (actor?.authMethod) {
    headers["x-actor-auth-method"] = actor.authMethod;
  }
  return headers;
}

export function invalidateIncidentPublicCaches(): void {
  try {
    revalidatePath("/");
    revalidatePath("/archive");
    revalidatePath("/admin/incidents");
    revalidatePath("/admin/transforms");
    revalidatePath("/admin/audit");
    revalidatePath("/admin");
  } catch {
    // revalidatePath may throw outside Next.js request context
  }
}

export async function getAdminIncidentsAndTransformsBridge(filters?: {
  status?: string;
  search?: string;
  rewrittenOnly?: boolean;
  limit?: number;
}): Promise<{
  incidents: AdminIncidentRecord[];
  transforms: PipelineTransformRecord[];
  counts: {
    total: number;
    synthesized: number;
    triaged: number;
    quarantined: number;
    dropped: number;
    rewritten: number;
    withImage: number;
    pinned: number;
    hidden: number;
  };
}> {
  if (shouldUseRemoteWorker()) {
    try {
      const workerUrl = getEffectiveWorkerUrl();
      const params = new URLSearchParams();
      if (filters?.status) params.set("status", filters.status);
      if (filters?.search) params.set("search", filters.search);
      if (filters?.rewrittenOnly) params.set("rewrittenOnly", "true");
      if (filters?.limit) params.set("limit", String(filters.limit));
      const qs = params.toString();

      const response = await fetch(
        `${workerUrl}/api/admin/incidents${qs ? `?${qs}` : ""}`,
        {
          method: "GET",
          headers: buildAdminHeaders(),
          cache: "no-store",
        }
      );

      if (response.ok) {
        const data = (await response.json()) as {
          ok?: boolean;
          incidents?: AdminIncidentRecord[];
          transforms?: PipelineTransformRecord[];
          counts?: {
            total: number;
            synthesized: number;
            triaged: number;
            quarantined: number;
            dropped: number;
            rewritten?: number;
            titleRewritten?: number;
            withImage: number;
            pinned: number;
            hidden: number;
          };
        };
        if (Array.isArray(data.incidents) && Array.isArray(data.transforms)) {
          return {
            incidents: data.incidents,
            transforms: data.transforms,
            counts: {
              total: data.counts?.total ?? data.incidents.length,
              synthesized:
                data.counts?.synthesized ??
                data.incidents.filter((i) => i.status === "synthesized").length,
              triaged:
                data.counts?.triaged ??
                data.incidents.filter((i) => i.status === "triaged").length,
              quarantined:
                data.counts?.quarantined ??
                data.incidents.filter((i) => i.status === "QUARANTINED").length,
              dropped:
                data.counts?.dropped ??
                data.incidents.filter((i) => i.status === "dropped").length,
              rewritten:
                data.counts?.rewritten ??
                data.counts?.titleRewritten ??
                data.incidents.filter((i) => i.titleRewritten).length,
              withImage:
                data.counts?.withImage ??
                data.incidents.filter((i) => Boolean(i.imageUrl)).length,
              pinned:
                data.counts?.pinned ??
                data.incidents.filter((i) => i.isPinned).length,
              hidden:
                data.counts?.hidden ??
                data.incidents.filter((i) => i.isHidden).length,
            },
          };
        }
      }
    } catch {
      // Fallback to local SQLite
    }
  }

  const db = createLocalSqliteD1Adapter();
  if (!db) {
    return {
      incidents: [],
      transforms: [],
      counts: {
        total: 0,
        synthesized: 0,
        triaged: 0,
        quarantined: 0,
        dropped: 0,
        rewritten: 0,
        withImage: 0,
        pinned: 0,
        hidden: 0,
      },
    };
  }

  const res = await listAdminIncidentsAndTransforms(db, {
    status: filters?.status,
    search: filters?.search,
    onlyRewritten: filters?.rewrittenOnly,
    limit: filters?.limit,
  });

  return {
    incidents: res.incidents,
    transforms: res.transforms,
    counts: {
      total: res.counts.total,
      synthesized: res.counts.synthesized,
      triaged: res.counts.triaged,
      quarantined: res.counts.quarantined,
      dropped: res.counts.dropped,
      rewritten: res.counts.titleRewritten,
      withImage: res.counts.withImage,
      pinned: res.counts.pinned,
      hidden: res.counts.hidden,
    },
  };
}

export async function mutateAdminIncidentBridge(
  payload: {
    action?:
      | "rewrite_title"
      | "attach_image"
      | "override_brief"
      | "resynthesize"
      | "update_transform";
    incidentId?: number | string;
    id?: number | string;
    newTitle?: string;
    autoDeescalate?: boolean;
    restoreOriginal?: boolean;
    imageUrl?: string | null;
    imageAlt?: string | null;
    imageCaption?: string | null;
    imageSourceType?: ImageSourceType;
    extractFromSource?: boolean;
    generateSvgCard?: boolean;
    executiveSummary?: string;
    socraticBrief?: string;
    noiseOverblown?: string;
    structuralSignal?: string;
    questions?: string[];
    primaryTool?: JevWorkingToolKey;
    secondaryTool?: JevWorkingToolKey;
    sreFailureMode?: JevSreFailureModeKey;
    status?:
      | "dropped"
      | "triaged"
      | "synthesized"
      | "QUARANTINED"
      | "PENDING_RETRY";
    isPinned?: boolean;
    isHidden?: boolean;
    isLeadPostMortem?: boolean;
    leadPostMortemAnalysis?: string | null;
    editorialNotes?: string | null;
    transformKey?: string;
    enabled?: boolean;
    config?: Record<string, unknown>;
    reason?: string;
  },
  actor: EditorialAdminActor
): Promise<Record<string, unknown>> {
  if (shouldUseRemoteWorker()) {
    const workerUrl = getEffectiveWorkerUrl();
    const response = await fetch(`${workerUrl}/api/admin/incidents`, {
      method: "PUT",
      headers: buildAdminHeaders(actor),
      body: JSON.stringify({
        ...payload,
        actorEmail: actor.actorEmail,
        actorRole: actor.actorRole,
        authMethod: actor.authMethod,
      }),
      cache: "no-store",
    });

    const data = (await response.json()) as Record<string, unknown>;
    if (!response.ok || data.ok === false) {
      throw new Error(
        typeof data.error === "string"
          ? data.error
          : `Worker incident mutation failed (${response.status})`
      );
    }

    await ensureD1Snapshot(true);
    invalidateIncidentPublicCaches();
    return data;
  }

  const db = createLocalSqliteD1Adapter();
  if (!db) {
    throw new Error("Local D1 SQLite adapter is unavailable.");
  }
  const envVars = loadLocalEnvVars();
  const action = payload.action || "override_brief";

  if (action === "update_transform") {
    if (!payload.transformKey) {
      throw new Error("Missing required transformKey");
    }
    const res = await updatePipelineTransform(
      db,
      {
        idOrKey: payload.transformKey,
        enabled: payload.enabled,
        config: payload.config,
        reason: payload.reason,
      },
      actor
    );
    const snapshot = await listAdminIncidentsAndTransforms(db, { limit: 100 });
    invalidateIncidentPublicCaches();
    return {
      ok: true,
      ...res,
      ...snapshot,
      counts: {
        ...snapshot.counts,
        rewritten: snapshot.counts.titleRewritten,
      },
    };
  }

  const rawId = payload.incidentId ?? payload.id;
  const incidentId = Number(String(rawId || "").replace(/^d1-inc-/i, ""));
  if (!Number.isFinite(incidentId) || incidentId <= 0) {
    throw new Error("Valid incidentId is required.");
  }

  if (action === "rewrite_title") {
    const mode = payload.restoreOriginal
      ? "restore_original"
      : payload.autoDeescalate
      ? "ai_deescalate"
      : "manual_override";
    const res = await rewriteIncidentTitle(
      db,
      {
        id: incidentId,
        mode,
        newTitle: payload.newTitle,
        reason: payload.reason,
        geminiApiKey: envVars.GEMINI_API_KEY,
      },
      actor
    );
    const snapshot = await listAdminIncidentsAndTransforms(db, { limit: 100 });
    invalidateIncidentPublicCaches();
    return {
      ok: true,
      ...res,
      ...snapshot,
      counts: {
        ...snapshot.counts,
        rewritten: snapshot.counts.titleRewritten,
      },
    };
  }

  if (action === "attach_image") {
    const mode = payload.generateSvgCard
      ? "generated_card"
      : payload.imageSourceType === "wikimedia_commons"
      ? "wikimedia_commons"
      : payload.extractFromSource
      ? "rss_extracted"
      : !payload.imageUrl || payload.imageSourceType === "none"
      ? "remove"
      : payload.imageSourceType === "r2_upload" ||
        payload.imageSourceType === "upload" ||
        payload.imageUrl.startsWith("/media/")
      ? "r2_upload"
      : "external_url";

    const res = await attachIncidentImage(
      db,
      {
        id: incidentId,
        mode,
        imageUrl: payload.imageUrl,
        imageAlt: payload.imageAlt,
        imageCaption: payload.imageCaption,
        reason: payload.reason,
        audioBucket: createLocalR2AudioAdapter(),
      },
      actor
    );
    const snapshot = await listAdminIncidentsAndTransforms(db, { limit: 100 });
    invalidateIncidentPublicCaches();
    return {
      ok: true,
      ...res,
      ...snapshot,
      counts: {
        ...snapshot.counts,
        rewritten: snapshot.counts.titleRewritten,
      },
    };
  }

  if (action === "resynthesize") {
    await ensureEditorialPipelineSchema(db);
    const beforeIncident = await getAdminIncidentById(db, incidentId);
    if (!beforeIncident) {
      throw new Error(`Incident #${incidentId} not found.`);
    }
    const synthSummary = await runSynthesizePipeline({
      db,
      geminiApiKey: envVars.GEMINI_API_KEY,
      articleIds: [incidentId],
      limit: 1,
    });
    const afterIncident = await getAdminIncidentById(db, incidentId);
    const auditEntry = await appendAuditEntry(db, {
      actorEmail: actor.actorEmail,
      actorRole: actor.actorRole,
      authMethod: actor.authMethod,
      actorIpHash: actor.actorIpHash,
      actionType: "incident.override_brief",
      targetType: "incident_article",
      targetId: String(incidentId),
      reason:
        payload.reason ||
        `Re-triggered System-2 Gemini synthesis for incident #${incidentId}.`,
      beforeState: beforeIncident.row,
      afterState: afterIncident?.row ?? null,
    });
    const snapshot = await listAdminIncidentsAndTransforms(db, { limit: 100 });
    invalidateIncidentPublicCaches();
    return {
      ok: true,
      incident: afterIncident?.record,
      synthesis: synthSummary,
      auditEventId: auditEntry.eventId,
      ...snapshot,
      counts: {
        ...snapshot.counts,
        rewritten: snapshot.counts.titleRewritten,
      },
    };
  }

  const res = await overrideIncidentBriefAndClassification(
    db,
    {
      id: incidentId,
      executiveSummary: payload.executiveSummary,
      socraticBrief: payload.socraticBrief,
      noiseOverblown: payload.noiseOverblown,
      structuralSignal: payload.structuralSignal,
      questions: payload.questions,
      primaryTool: payload.primaryTool,
      secondaryTool: payload.secondaryTool,
      sreFailureMode: payload.sreFailureMode,
      status: payload.status,
      isPinned: payload.isPinned,
      isHidden: payload.isHidden,
      isLeadPostMortem: payload.isLeadPostMortem,
      leadPostMortemAnalysis: payload.leadPostMortemAnalysis,
      editorialNotes: payload.editorialNotes,
      reason: payload.reason,
    },
    actor
  );
  const snapshot = await listAdminIncidentsAndTransforms(db, { limit: 100 });
  invalidateIncidentPublicCaches();
  return {
    ok: true,
    ...res,
    ...snapshot,
    counts: {
      ...snapshot.counts,
      rewritten: snapshot.counts.titleRewritten,
    },
  };
}

export async function listPipelineTransformsBridge(): Promise<
  PipelineTransformRecord[]
> {
  if (shouldUseRemoteWorker()) {
    try {
      const workerUrl = getEffectiveWorkerUrl();
      const response = await fetch(`${workerUrl}/api/admin/transforms`, {
        method: "GET",
        headers: buildAdminHeaders(),
        cache: "no-store",
      });
      if (response.ok) {
        const data = (await response.json()) as {
          transforms?: PipelineTransformRecord[];
        };
        if (Array.isArray(data.transforms)) {
          return data.transforms;
        }
      }
    } catch {
      // Fallback to local SQLite
    }
  }

  const db = createLocalSqliteD1Adapter();
  if (!db) return [];
  return listPipelineTransforms(db);
}

export async function updatePipelineTransformBridge(
  payload: {
    transformKey: string;
    enabled?: boolean;
    config?: Record<string, unknown>;
    reason?: string;
  },
  actor: EditorialAdminActor
): Promise<{
  transform: PipelineTransformRecord;
  transforms: PipelineTransformRecord[];
  auditEventId: string;
}> {
  if (shouldUseRemoteWorker()) {
    const workerUrl = getEffectiveWorkerUrl();
    const response = await fetch(`${workerUrl}/api/admin/transforms`, {
      method: "PUT",
      headers: buildAdminHeaders(actor),
      body: JSON.stringify({
        ...payload,
        actorEmail: actor.actorEmail,
        actorRole: actor.actorRole,
        authMethod: actor.authMethod,
      }),
      cache: "no-store",
    });

    const data = (await response.json()) as {
      ok?: boolean;
      error?: string;
      transform: PipelineTransformRecord;
      transforms: PipelineTransformRecord[];
      auditEventId: string;
    };
    if (!response.ok || data.ok === false) {
      throw new Error(
        data.error || `Failed to update transform (${response.status})`
      );
    }
    invalidateIncidentPublicCaches();
    return data;
  }

  const db = createLocalSqliteD1Adapter();
  if (!db) {
    throw new Error("Local D1 SQLite adapter is unavailable.");
  }
  const result = await updatePipelineTransform(
    db,
    {
      idOrKey: payload.transformKey,
      enabled: payload.enabled,
      config: payload.config,
      reason: payload.reason,
    },
    actor
  );
  const transforms = await listPipelineTransforms(db);
  invalidateIncidentPublicCaches();
  return {
    transform: result.transform,
    transforms,
    auditEventId: result.auditEntry.eventId,
  };
}

export async function uploadAdminMediaBridge(
  payload: {
    filename: string;
    contentType: string;
    bytes: Uint8Array;
    base64Data?: string;
    incidentId?: number;
    imageAlt?: string;
    imageCaption?: string;
    reason?: string;
  },
  actor: EditorialAdminActor
): Promise<{
  mediaKey: string;
  mediaUrl: string;
  contentType: string;
  byteLength: number;
  incident?: AdminIncidentRecord;
  auditEventId?: string;
}> {
  if (shouldUseRemoteWorker()) {
    const workerUrl = getEffectiveWorkerUrl();
    const base64Data =
      payload.base64Data || Buffer.from(payload.bytes).toString("base64");
    const response = await fetch(`${workerUrl}/api/admin/media/upload`, {
      method: "POST",
      headers: buildAdminHeaders(actor),
      body: JSON.stringify({
        filename: payload.filename,
        contentType: payload.contentType,
        base64Data,
        incidentId: payload.incidentId,
        imageAlt: payload.imageAlt,
        imageCaption: payload.imageCaption,
        reason: payload.reason,
        actorEmail: actor.actorEmail,
        actorRole: actor.actorRole,
        authMethod: actor.authMethod,
      }),
      cache: "no-store",
    });

    const data = (await response.json()) as {
      ok?: boolean;
      error?: string;
      key?: string;
      url?: string;
      sizeBytes?: number;
      mediaKey?: string;
      mediaUrl?: string;
      contentType: string;
      byteLength?: number;
      incident?: AdminIncidentRecord;
      auditEventId?: string;
    };
    if (!response.ok || data.ok === false) {
      throw new Error(
        data.error || `Worker media upload failed (${response.status})`
      );
    }
    await ensureD1Snapshot(true);
    invalidateIncidentPublicCaches();
    return {
      mediaKey: data.mediaKey || data.key || "",
      mediaUrl: data.mediaUrl || data.url || "",
      contentType: data.contentType,
      byteLength: data.byteLength ?? data.sizeBytes ?? payload.bytes.byteLength,
      incident: data.incident,
      auditEventId: data.auditEventId,
    };
  }

  const db = createLocalSqliteD1Adapter();
  if (!db) {
    throw new Error("Local D1 SQLite adapter is unavailable.");
  }
  const audioBucket = createLocalR2AudioAdapter();
  const res = await uploadAdminMediaToR2({
    db,
    audioBucket,
    filename: payload.filename,
    contentType: payload.contentType,
    bytes: payload.bytes,
    incidentId: payload.incidentId,
    imageAlt: payload.imageAlt,
    imageCaption: payload.imageCaption,
    reason: payload.reason,
    actor,
  });
  invalidateIncidentPublicCaches();
  return {
    mediaKey: res.key,
    mediaUrl: res.url,
    contentType: res.contentType,
    byteLength: res.sizeBytes,
    incident: res.incident,
    auditEventId: res.auditEntry?.eventId,
  };
}
