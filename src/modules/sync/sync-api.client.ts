import { assertBrowserOnline } from "@/lib/networkStatus";
import type { SyncPullResponse, SyncPushMutation, SyncPushResponse } from "./sync-contracts";

export class SyncApiRequestError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "SyncApiRequestError";
    this.status = status;
  }
}

async function readSyncApiError(response: Response, fallback: string) {
  const json = await response.json().catch(() => ({}));
  const message = (json as { error?: unknown; message?: unknown }).error ?? (json as { message?: unknown }).message;

  return typeof message === "string" && message.trim()
    ? message.trim()
    : `${fallback} (${response.status} ${response.statusText || "HTTP error"})`;
}

export async function pushSyncMutations(mutations: SyncPushMutation[], accessToken?: string) {
  assertBrowserOnline();

  if (!accessToken) {
    throw new Error("Necesitas iniciar sesion para sincronizar cambios.");
  }

  const response = await fetch("/api/sync/push", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ mutations }),
  });

  if (!response.ok) {
    throw new SyncApiRequestError(
      await readSyncApiError(response, "No se pudo enviar cambios pendientes."),
      response.status
    );
  }

  return response.json() as Promise<SyncPushResponse>;
}

export async function pullSyncChanges(cursor: number, accessToken?: string) {
  assertBrowserOnline();

  if (!accessToken) {
    throw new Error("Necesitas iniciar sesion para sincronizar cambios.");
  }

  const response = await fetch(`/api/sync/pull?cursor=${encodeURIComponent(String(cursor))}`, {
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new SyncApiRequestError(
      await readSyncApiError(response, "No se pudo recibir cambios remotos."),
      response.status
    );
  }

  return response.json() as Promise<SyncPullResponse>;
}
