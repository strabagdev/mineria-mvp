import "server-only";

import { createAuthUser, deleteAuthUser } from "@/server/auth/auth-admin";
import {
  APPROVAL_STATUS,
  USER_ROLES,
  isMissingAccessColumns,
} from "@/server/services/access.service";
import {
  findProfileApprovalByEmail,
  insertAccessRequestProfile,
  insertLegacyAccessRequestProfile,
} from "@/server/repositories/profile.repository";

export async function requestAccess(input: {
  name: string;
  email: string;
  password: string;
  isBootstrapAdmin: boolean;
}) {
  const existingProfile = await findProfileApprovalByEmail(input.email);

  if (existingProfile) {
    const message =
      existingProfile.approval_status === APPROVAL_STATUS.PENDING
        ? "Ya existe una solicitud pendiente para este correo."
        : "Este correo ya existe en el sistema. Intenta ingresar o pide revision a un administrador.";
    return { status: "conflict" as const, message };
  }

  const { data: createdAuthUser, error: authError } = await createAuthUser({
    email: input.email,
    password: input.password,
    name: input.name,
  });

  if (authError || !createdAuthUser.user) {
    return { status: "auth-error" as const };
  }

  try {
    await insertAccessRequestProfile({
      user_id: createdAuthUser.user.id,
      email: input.email,
      full_name: input.name,
      role: input.isBootstrapAdmin ? USER_ROLES.ADMIN : USER_ROLES.VIEWER,
      active: true,
      approval_status: input.isBootstrapAdmin
        ? APPROVAL_STATUS.APPROVED
        : APPROVAL_STATUS.PENDING,
    });
  } catch (profileError: unknown) {
    if (isMissingAccessColumns(profileError)) {
      try {
        await insertLegacyAccessRequestProfile({
          user_id: createdAuthUser.user.id,
          email: input.email,
          full_name: input.name,
        });
      } catch (legacyProfileError: unknown) {
        await deleteAuthUser(createdAuthUser.user.id).catch(() => undefined);
        throw legacyProfileError;
      }
    } else {
      await deleteAuthUser(createdAuthUser.user.id).catch(() => undefined);
      throw profileError;
    }
  }

  return { status: "created" as const };
}

