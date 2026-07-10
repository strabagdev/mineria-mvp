import { useState, type Dispatch, type FormEventHandler, type SetStateAction } from "react";
import { DeleteConfirmationDialog } from "@/components/planning/delete-confirmation-dialog";

type CatalogDetail = {
  id: number;
  label: string;
};

type CatalogType = {
  id: number;
  slug: string;
  label: string;
  details: CatalogDetail[];
};

type CatalogCategory = {
  slug: "actividad" | "interferencia";
  label: string;
  types: CatalogType[];
};

type TypeAdminForm = {
  category: "actividad" | "interferencia";
  label: string;
};

type DetailAdminForm = {
  category: "actividad" | "interferencia";
  typeId: string;
  label: string;
};

type EditTypeForm = {
  id: number;
  category: "actividad" | "interferencia";
  label: string;
};

type EditDetailForm = {
  id: number;
  category: "actividad" | "interferencia";
  typeId: string;
  label: string;
};

export type CatalogAdminSection = "all" | "activities";

export type CatalogAdminWorkspaceProps = {
  catalog: CatalogCategory[];
  catalogLoading: boolean;
  catalogBusy: boolean;
  catalogFormError: string;
  typeForm: TypeAdminForm;
  setTypeForm: Dispatch<SetStateAction<TypeAdminForm>>;
  detailForm: DetailAdminForm;
  setDetailForm: Dispatch<SetStateAction<DetailAdminForm>>;
  editingType: EditTypeForm | null;
  setEditingType: Dispatch<SetStateAction<EditTypeForm | null>>;
  editingDetail: EditDetailForm | null;
  setEditingDetail: Dispatch<SetStateAction<EditDetailForm | null>>;
  syncDetailAdminForm: (form: DetailAdminForm, categories: CatalogCategory[]) => DetailAdminForm;
  onCreateType: FormEventHandler<HTMLFormElement>;
  onCreateDetail: FormEventHandler<HTMLFormElement>;
  onUpdateType: FormEventHandler<HTMLFormElement>;
  onUpdateDetail: FormEventHandler<HTMLFormElement>;
  onDeleteType: (id: number) => void;
  onDeleteDetail: (id: number) => void;
  activeSection?: CatalogAdminSection;
  showCounts?: boolean;
};

type CatalogDeletionRequest = {
  entityType: string;
  label: string;
  warning: string;
  onConfirm: () => void;
};

export function CatalogAdminWorkspace({
  catalog,
  catalogLoading,
  catalogBusy,
  catalogFormError,
  typeForm,
  setTypeForm,
  detailForm,
  setDetailForm,
  editingType,
  setEditingType,
  editingDetail,
  setEditingDetail,
  syncDetailAdminForm,
  onCreateType,
  onCreateDetail,
  onUpdateType,
  onUpdateDetail,
  onDeleteType,
  onDeleteDetail,
  activeSection = "all",
  showCounts = true,
}: CatalogAdminWorkspaceProps) {
  const [pendingDeletion, setPendingDeletion] = useState<CatalogDeletionRequest | null>(null);
  const detailTypesForAdmin =
    catalog.find((category) => category.slug === detailForm.category)?.types ?? [];
  const showActivities = activeSection === "all" || activeSection === "activities";
  const showTree = showActivities;

  function requestDeletion(request: CatalogDeletionRequest) {
    setPendingDeletion(request);
  }

  function confirmDeletion() {
    if (!pendingDeletion) {
      return;
    }

    pendingDeletion.onConfirm();
    setPendingDeletion(null);
  }

  return (
    <div className="catalog-admin-grid">
      {pendingDeletion ? (
        <DeleteConfirmationDialog
          title="Eliminar elemento del catalogo"
          entityType={pendingDeletion.entityType}
          label={pendingDeletion.label}
          warning={pendingDeletion.warning}
          busy={catalogBusy}
          onCancel={() => setPendingDeletion(null)}
          onConfirm={confirmDeletion}
        />
      ) : null}

      <div className="catalog-admin-column" id="catalog-create">
        {showActivities ? (
          <>
            <article className="surface-card soft padded">
              <p className="eyebrow">Nuevo tipo</p>
              <form className="modal-form" onSubmit={onCreateType}>
                <label className="field">
                  Categoria
                  <select
                    className="field-input"
                    value={typeForm.category}
                    onChange={(event) =>
                      setTypeForm((current) => ({
                        ...current,
                        category: event.target.value as "actividad" | "interferencia",
                      }))
                    }
                  >
                    {catalog.map((category) => (
                      <option key={category.slug} value={category.slug}>
                        {category.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field">
                  Nombre del tipo
                  <input
                    className="field-input"
                    value={typeForm.label}
                    onChange={(event) =>
                      setTypeForm((current) => ({ ...current, label: event.target.value }))
                    }
                    placeholder="Ej: logistica"
                  />
                </label>

                <button type="submit" className="button primary" disabled={catalogBusy || !typeForm.label.trim()}>
                  Agregar tipo
                </button>
              </form>
            </article>

            <article className="surface-card soft padded">
              <p className="eyebrow">Nuevo detalle</p>
              <form className="modal-form" onSubmit={onCreateDetail}>
                <label className="field">
                  Categoria
                  <select
                    className="field-input"
                    value={detailForm.category}
                    onChange={(event) =>
                      setDetailForm((current) =>
                        syncDetailAdminForm(
                          {
                            ...current,
                            category: event.target.value as "actividad" | "interferencia",
                            typeId: "",
                          },
                          catalog
                        )
                      )
                    }
                  >
                    {catalog.map((category) => (
                      <option key={category.slug} value={category.slug}>
                        {category.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field">
                  Tipo
                  <select
                    className="field-input"
                    value={detailForm.typeId}
                    onChange={(event) =>
                      setDetailForm((current) => ({ ...current, typeId: event.target.value }))
                    }
                  >
                    {detailTypesForAdmin.map((type) => (
                      <option key={type.id} value={type.id}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field">
                  Nombre del detalle
                  <input
                    className="field-input"
                    value={detailForm.label}
                    onChange={(event) =>
                      setDetailForm((current) => ({ ...current, label: event.target.value }))
                    }
                    placeholder="Ej: Desviacion de trafico interior mina"
                  />
                </label>

                <button
                  type="submit"
                  className="button primary"
                  disabled={catalogBusy || !detailForm.typeId || !detailForm.label.trim()}
                >
                  Agregar detalle
                </button>
              </form>
            </article>
          </>
        ) : null}

        {catalogFormError && showActivities ? <p className="feedback">{catalogFormError}</p> : null}

      </div>

      {showTree ? <div className="catalog-tree">
        {catalogLoading ? <p className="body-copy">Cargando catalogo...</p> : null}

        {showActivities ? catalog.map((category) => (
          <article key={category.slug} className="catalog-category-card">
            <div className="catalog-category-header">
              <div>
                <p className="eyebrow">Categoria</p>
                <h3 className="card-title" style={{ marginTop: 10 }}>
                  {category.label}
                </h3>
              </div>
              {showCounts ? <span className="catalog-count">{category.types.length} tipos</span> : null}
            </div>

            <div className="catalog-type-list">
              {category.types.map((type) => (
                <div key={type.id} className="catalog-type-card">
                  <div className="catalog-type-header">
                    <div className="catalog-type-heading">
                      <strong>{type.label}</strong>
                      {showCounts ? <span className="catalog-count">{type.details.length} detalles</span> : null}
                    </div>
                    <div className="catalog-inline-actions">
                      <button
                        type="button"
                        className="button small"
                        onClick={() =>
                          setEditingType({
                            id: type.id,
                            category: category.slug,
                            label: type.label,
                          })
                        }
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        className="button small danger"
                        onClick={() =>
                          requestDeletion({
                            entityType: "Tipo",
                            label: type.label,
                            warning: "Los detalles asociados tambien seran eliminados.",
                            onConfirm: () => onDeleteType(type.id),
                          })
                        }
                        disabled={catalogBusy}
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>

                  {editingType?.id === type.id ? (
                    <form className="catalog-edit-form" onSubmit={onUpdateType}>
                      <label className="field">
                        Categoria
                        <select
                          className="field-input"
                          value={editingType.category}
                          onChange={(event) =>
                            setEditingType((current) =>
                              current
                                ? {
                                    ...current,
                                    category: event.target.value as "actividad" | "interferencia",
                                  }
                                : current
                            )
                          }
                        >
                          {catalog.map((entry) => (
                            <option key={entry.slug} value={entry.slug}>
                              {entry.label}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="field">
                        Nombre del tipo
                        <input
                          className="field-input"
                          value={editingType.label}
                          onChange={(event) =>
                            setEditingType((current) =>
                              current ? { ...current, label: event.target.value } : current
                            )
                          }
                        />
                      </label>

                      <div className="catalog-inline-actions">
                        <button type="submit" className="button small primary" disabled={catalogBusy || !editingType.label.trim()}>
                          Guardar
                        </button>
                        <button type="button" className="button small" onClick={() => setEditingType(null)}>
                          Cancelar
                        </button>
                      </div>
                    </form>
                  ) : null}

                  <div className="catalog-detail-list">
                    {type.details.map((detail) => (
                      <div key={detail.id} className="catalog-detail-row">
                        {editingDetail?.id === detail.id ? (
                          <form className="catalog-edit-form detail" onSubmit={onUpdateDetail}>
                            <label className="field">
                              Categoria
                              <select
                                className="field-input"
                                value={editingDetail.category}
                                onChange={(event) =>
                                  setEditingDetail((current) =>
                                    current
                                      ? {
                                          ...current,
                                          ...syncDetailAdminForm(
                                            {
                                              ...current,
                                              category: event.target.value as "actividad" | "interferencia",
                                              typeId: "",
                                            },
                                            catalog
                                          ),
                                        }
                                      : current
                                  )
                                }
                              >
                                {catalog.map((entry) => (
                                  <option key={entry.slug} value={entry.slug}>
                                    {entry.label}
                                  </option>
                                ))}
                              </select>
                            </label>

                            <label className="field">
                              Tipo
                              <select
                                className="field-input"
                                value={editingDetail.typeId}
                                onChange={(event) =>
                                  setEditingDetail((current) =>
                                    current ? { ...current, typeId: event.target.value } : current
                                  )
                                }
                              >
                                {(catalog.find((entry) => entry.slug === editingDetail.category)?.types ?? []).map((entry) => (
                                  <option key={entry.id} value={entry.id}>
                                    {entry.label}
                                  </option>
                                ))}
                              </select>
                            </label>

                            <label className="field">
                              Detalle
                              <input
                                className="field-input"
                                value={editingDetail.label}
                                onChange={(event) =>
                                  setEditingDetail((current) =>
                                    current ? { ...current, label: event.target.value } : current
                                  )
                                }
                              />
                            </label>

                            <div className="catalog-inline-actions">
                              <button type="submit" className="button small primary" disabled={catalogBusy || !editingDetail.label.trim() || !editingDetail.typeId}>
                                Guardar
                              </button>
                              <button type="button" className="button small" onClick={() => setEditingDetail(null)}>
                                Cancelar
                              </button>
                            </div>
                          </form>
                        ) : (
                          <>
                            <span className="catalog-detail-chip">{detail.label}</span>
                            <div className="catalog-inline-actions">
                              <button
                                type="button"
                                className="button small"
                                onClick={() =>
                                  setEditingDetail({
                                    id: detail.id,
                                    category: category.slug,
                                    typeId: String(type.id),
                                    label: detail.label,
                                  })
                                }
                              >
                                Editar
                              </button>
                              <button
                                type="button"
                                className="button small danger"
                                onClick={() =>
                                  requestDeletion({
                                    entityType: "Detalle",
                                    label: detail.label,
                                    warning: "El detalle dejara de estar disponible para nuevas selecciones del catalogo.",
                                    onConfirm: () => onDeleteDetail(detail.id),
                                  })
                                }
                                disabled={catalogBusy}
                              >
                                Eliminar
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </article>
        )) : null}
      </div> : null}
    </div>
  );
}
