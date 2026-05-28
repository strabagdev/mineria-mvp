import { CatalogAdminWorkspace, type CatalogAdminWorkspaceProps } from "@/components/planning/catalog-admin-workspace";
import { SheetPanel } from "@/components/ui/sheet-panel";

type CatalogSheetProps = CatalogAdminWorkspaceProps & {
  onClose: () => void;
};

export function CatalogSheet({ onClose, ...workspaceProps }: CatalogSheetProps) {
  return (
    <SheetPanel
      titleId="catalog-modal-title"
      eyebrow="Catalogo"
      title="Configuracion jerarquica"
      description="Aqui administras como se comporta el formulario: nivel, categoria, tipo y detalle."
      className="catalog-modal-card catalog-sheet-card"
      onClose={onClose}
    >
      <CatalogAdminWorkspace {...workspaceProps} />
    </SheetPanel>
  );
}
