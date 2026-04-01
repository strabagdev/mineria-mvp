export const planningOptions = {
  actividad: {
    unitaria: [
      "Perforacion",
      "Carguio",
      "Tronadura",
      "Fortificacion",
      "Extraccion",
      "Sostenimiento",
      "Acuñadura",
      "Levantamiento topografico",
    ],
  },
  interferencia: {
    mantencion: [
      "Mantencion de equipo",
      "Mantencion electrica",
      "Mantencion mecanica",
      "Mantencion programada",
    ],
    seguridad: [
      "Bloqueo de area",
      "Inspeccion de seguridad",
      "Incidente operacional",
      "Restriccion por ventilacion",
    ],
    operacional: [
      "Falta de equipo",
      "Falta de personal",
      "Detencion de proceso",
      "Interferencia por coordinacion",
    ],
    geotecnica: [
      "Caida de roca",
      "Condicion geotecnica",
      "Saneamiento de labor",
      "Revision de sostenimiento",
    ],
  },
} as const;

export type PlanningCategory = keyof typeof planningOptions;
export type PlanningType = string;
export type PlanningDetail = string;

export function getTypesByCategory(category: string) {
  const group = planningOptions[category as PlanningCategory];
  return group ? Object.keys(group) : [];
}

export function getDetailsByCategoryAndType(category: string, type: string) {
  const group = planningOptions[category as PlanningCategory];
  if (!group) {
    return [];
  }

  return group[type as keyof typeof group] ?? [];
}

export function isValidPlanningSelection(category: string, type: string, description: string) {
  const details = getDetailsByCategoryAndType(category, type);
  return details.includes(description);
}
