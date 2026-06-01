import {
  Building2,
  ClipboardList,
  HardHat,
  Layers,
  Package,
  Tag,
  Truck,
  User,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import type { AssignmentTypeIconKey } from "@/modules/planning-assignments/contracts/planning-assignments";

export const ASSIGNMENT_TYPE_ICON_OPTIONS: Array<{
  key: AssignmentTypeIconKey;
  label: string;
  Icon: LucideIcon;
}> = [
  { key: "users", label: "Cuadrilla / personas", Icon: Users },
  { key: "hard-hat", label: "Casco / terreno", Icon: HardHat },
  { key: "truck", label: "Vehiculo / equipo", Icon: Truck },
  { key: "wrench", label: "Equipo / mantencion", Icon: Wrench },
  { key: "building", label: "Empresa / contratista", Icon: Building2 },
  { key: "package", label: "Recurso / paquete", Icon: Package },
  { key: "clipboard-list", label: "Lista operacional", Icon: ClipboardList },
  { key: "user", label: "Persona", Icon: User },
  { key: "layers", label: "Grupo / categoria", Icon: Layers },
];

export function getAssignmentTypeIcon(iconKey?: AssignmentTypeIconKey | null) {
  return ASSIGNMENT_TYPE_ICON_OPTIONS.find((option) => option.key === iconKey)?.Icon ?? Tag;
}
