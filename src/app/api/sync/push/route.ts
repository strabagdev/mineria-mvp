import { NextResponse } from "next/server";
import type { SyncPushMutation, SyncPushResponse } from "@/modules/sync/sync-contracts";
import { POST as createPlanningItem, PATCH as updatePlanningItem, DELETE as deletePlanningItem } from "@/app/api/planning-items/route";
import { getErrorMessage, getErrorStatus } from "@/lib/errorMessage";

type PushBody = {
  mutations?: SyncPushMutation[];
};

function toPlanningMethod(operation: SyncPushMutation["operation"]) {
  if (operation === "create") {
    return "POST";
  }

  if (operation === "update") {
    return "PATCH";
  }

  return "DELETE";
}

async function dispatchPlanningMutation(req: Request, mutation: SyncPushMutation): Promise<Response> {
  const method = toPlanningMethod(mutation.operation);
  const headers = new Headers(req.headers);
  headers.set("Content-Type", "application/json");
  const payload = {
    ...mutation.payload,
    id: mutation.payload.id ?? mutation.entityId ?? undefined,
    client_mutation_id: mutation.mutationId,
    expected_updated_at: mutation.payload.expected_updated_at ?? mutation.baseRevision ?? undefined,
  };
  const planningRequest = new Request("http://local.test/api/planning-items", {
    method,
    headers,
    body: JSON.stringify(payload),
  });

  if (method === "POST") {
    const response = await createPlanningItem(planningRequest);
    if (!response) {
      throw new Error("La mutacion de planning no genero respuesta.");
    }
    return response;
  }

  if (method === "PATCH") {
    const response = await updatePlanningItem(planningRequest);
    if (!response) {
      throw new Error("La mutacion de planning no genero respuesta.");
    }
    return response;
  }

  const response = await deletePlanningItem(planningRequest);
  if (!response) {
    throw new Error("La mutacion de planning no genero respuesta.");
  }
  return response;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as PushBody;
    const mutations = Array.isArray(body.mutations) ? body.mutations : [];

    if (!mutations.length) {
      return NextResponse.json({ results: [] } satisfies SyncPushResponse);
    }

    const results: SyncPushResponse["results"] = [];

    for (const mutation of mutations) {
      if (mutation.domain !== "planning" || !mutation.mutationId || !mutation.payload) {
        return NextResponse.json({ error: "Mutacion de sync invalida." }, { status: 400 });
      }

      const response = await dispatchPlanningMutation(req, mutation);
      const responseBody = await response.json().catch(() => ({}));

      if (!response.ok) {
        return NextResponse.json(responseBody, { status: response.status });
      }

      results.push({
        mutationId: mutation.mutationId,
        status: response.status === 200 ? "existing" : "applied",
        response: responseBody,
      });
    }

    return NextResponse.json({ results } satisfies SyncPushResponse);
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: getErrorStatus(error) });
  }
}
