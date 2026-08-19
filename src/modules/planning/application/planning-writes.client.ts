import { assertBrowserOnline } from "@/lib/networkStatus";
import type {
  PlanningCatalogCreateRequestDto,
  PlanningCatalogDeleteRequestDto,
  PlanningCatalogUpdateRequestDto,
} from "@/modules/planning/contracts/planning-catalog";
import type { PlanningItemMutationPayloadDto } from "@/modules/planning/contracts/planning-items";
import type { PlanningAssignmentInputDto } from "@/modules/planning-assignments/contracts/planning-assignments";
import { pushSyncMutations, SyncApiRequestError } from "@/modules/sync/sync-api.client";
import type { SyncMutationOperation } from "@/modules/sync/sync-contracts";

export type PlanningWriteMethod = "POST" | "PATCH" | "DELETE";
export type PlanningMutationRequestPayloadDto =
  PlanningItemMutationPayloadDto & Record<string, unknown>;
export type PlanningCatalogMutationPayloadDto =
  | PlanningCatalogCreateRequestDto
  | PlanningCatalogUpdateRequestDto
  | PlanningCatalogDeleteRequestDto;

export class PlanningMutationRequestError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "PlanningMutationRequestError";
    this.status = status;
  }
}

async function readApiErrorMessage(response: Response, fallback: string) {
  const rawText = await response.text().catch(() => "");

  if (rawText) {
    try {
      const parsed = JSON.parse(rawText) as { error?: unknown; message?: unknown };
      const parsedMessage = parsed.error ?? parsed.message;

      if (typeof parsedMessage === "string" && parsedMessage.trim()) {
        return parsedMessage.trim();
      }
    } catch {
      const plainText = rawText.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

      if (/invalid session/i.test(plainText)) {
        return "Invalid session";
      }

      if (plainText) {
        return plainText.slice(0, 240);
      }
    }
  }

  return `${fallback} (${response.status} ${response.statusText || "HTTP error"})`;
}

export async function sendPlanningMutation(
  method: PlanningWriteMethod,
  payload: PlanningMutationRequestPayloadDto,
  accessToken?: string
) {
  assertBrowserOnline();

  if (!accessToken) {
    throw new Error("Necesitas iniciar sesion para registrar actividades.");
  }

  const response = await fetch("/api/planning-items", {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new PlanningMutationRequestError(
      await readApiErrorMessage(response, "No se pudo sincronizar el registro."),
      response.status
    );
  }

  return response.json().catch(() => ({}));
}

function toSyncOperation(method: PlanningWriteMethod): SyncMutationOperation {
  if (method === "POST") {
    return "create";
  }

  if (method === "PATCH") {
    return "update";
  }

  return "delete";
}

export async function sendPlanningSyncMutation(
  method: PlanningWriteMethod,
  payload: PlanningMutationRequestPayloadDto,
  accessToken?: string,
  assignmentPayload?: PlanningAssignmentInputDto[]
) {
  const mutationId = String(payload.client_mutation_id ?? "").trim() || crypto.randomUUID();
  let response;

  try {
    response = await pushSyncMutations([
      {
        mutationId,
        domain: "planning",
        operation: toSyncOperation(method),
        entityId: payload.id ?? null,
        baseRevision: typeof payload.expected_updated_at === "string" ? payload.expected_updated_at : null,
        payload,
        assignmentPayload,
      },
    ], accessToken);
  } catch (error) {
    if (error instanceof SyncApiRequestError) {
      throw new PlanningMutationRequestError(error.message, error.status);
    }

    throw error;
  }

  return response.results[0]?.response ?? {};
}

export async function mutatePlanningCatalog(
  method: PlanningWriteMethod,
  payload: PlanningCatalogMutationPayloadDto,
  accessToken?: string
) {
  assertBrowserOnline();

  if (!accessToken) {
    throw new Error("Necesitas iniciar sesion para administrar el catalogo.");
  }

  const response = await fetch("/api/planning-catalog", {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
  });
  const json = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(String(json.error ?? "No se pudo actualizar el catalogo."));
  }

  return json;
}
