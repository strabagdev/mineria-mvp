import {
  Building2,
  Calendar,
  ClipboardList,
  Clock,
  FileText,
  HardHat,
  Layers,
  MapPin,
  Package,
  ShieldAlert,
  Tag,
  Truck,
  User,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import type { PlanningCustomFieldIconKey } from "@/modules/planning-custom-fields/contracts/planning-custom-fields";

export type PlanningCustomFieldIconComponent = LucideIcon;

export const PLANNING_CUSTOM_FIELD_ICON_OPTIONS: Array<{
  key: PlanningCustomFieldIconKey;
  label: string;
  Icon: PlanningCustomFieldIconComponent;
}> = [
  { key: "truck", label: "Camion / equipo", Icon: Truck },
  { key: "hard-hat", label: "Casco / seguridad", Icon: HardHat },
  { key: "users", label: "Cuadrilla", Icon: Users },
  { key: "building", label: "Departamento", Icon: Building2 },
  { key: "calendar", label: "Calendario", Icon: Calendar },
  { key: "map-pin", label: "Ubicacion", Icon: MapPin },
  { key: "clipboard-list", label: "Lista operacional", Icon: ClipboardList },
  { key: "wrench", label: "Mantencion", Icon: Wrench },
  { key: "shield-alert", label: "Alerta / riesgo", Icon: ShieldAlert },
  { key: "file-text", label: "Documento", Icon: FileText },
  { key: "tag", label: "Etiqueta", Icon: Tag },
  { key: "clock", label: "Horario", Icon: Clock },
  { key: "user", label: "Responsable", Icon: User },
  { key: "package", label: "Material / recurso", Icon: Package },
  { key: "layers", label: "Capas / categoria", Icon: Layers },
];

export function getPlanningCustomFieldIcon(iconKey?: PlanningCustomFieldIconKey | null) {
  return PLANNING_CUSTOM_FIELD_ICON_OPTIONS.find((option) => option.key === iconKey)?.Icon ?? null;
}
