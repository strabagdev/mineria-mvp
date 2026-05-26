import type { Dispatch, FormEventHandler, ReactNode, SetStateAction } from "react";
import { SheetPanel } from "@/components/ui/sheet-panel";

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

type CatalogLevel = {
  id: number;
  slug: string;
  label: string;
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

type LevelAdminForm = {
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

type EditLevelForm = {
  id: number;
  label: string;
};

type CatalogSheetProps = {
  catalog: CatalogCategory[];
  levels: CatalogLevel[];
  catalogLoading: boolean;
  catalogBusy: boolean;
  catalogFormError: string;
  typeForm: TypeAdminForm;
  setTypeForm: Dispatch<SetStateAction<TypeAdminForm>>;
  levelForm: LevelAdminForm;
  setLevelForm: Dispatch<SetStateAction<LevelAdminForm>>;
  detailForm: DetailAdminForm;
  setDetailForm: Dispatch<SetStateAction<DetailAdminForm>>;
  editingType: EditTypeForm | null;
  setEditingType: Dispatch<SetStateAction<EditTypeForm | null>>;
  editingLevel: EditLevelForm | null;
  setEditingLevel: Dispatch<SetStateAction<EditLevelForm | null>>;
  editingDetail: EditDetailForm | null;
  setEditingDetail: Dispatch<SetStateAction<EditDetailForm | null>>;
  syncDetailAdminForm: (form: DetailAdminForm, categories: CatalogCategory[]) => DetailAdminForm;
  onClose: () => void;
  onCreateType: FormEventHandler<HTMLFormElement>;
  onCreateLevel: FormEventHandler<HTMLFormElement>;
  onCreateDetail: FormEventHandler<HTMLFormElement>;
  onUpdateType: FormEventHandler<HTMLFormElement>;
  onUpdateLevel: FormEventHandler<HTMLFormElement>;
  onUpdateDetail: FormEventHandler<HTMLFormElement>;
  onDeleteType: (id: number) => void;
  onDeleteLevel: (id: number) => void;
  onDeleteDetail: (id: number) => void;
  customFieldsAdminSlot?: ReactNode;
};

export function CatalogSheet({
  catalog,
  levels,
  catalogLoading,
  catalogBusy,
  catalogFormError,
  typeForm,
  setTypeForm,
  levelForm,
  setLevelForm,
  detailForm,
  setDetailForm,
  editingType,
  setEditingType,
  editingLevel,
  setEditingLevel,
  editingDetail,
  setEditingDetail,
  syncDetailAdminForm,
  onClose,
  onCreateType,
  onCreateLevel,
  onCreateDetail,
  onUpdateType,
  onUpdateLevel,
  onUpdateDetail,
  onDeleteType,
  onDeleteLevel,
  onDeleteDetail,
  customFieldsAdminSlot,
}: CatalogSheetProps) {
  const detailTypesForAdmin =
    catalog.find((category) => category.slug === detailForm.category)?.types ?? [];

  return (
    <SheetPanel
      titleId="catalog-modal-title"
      eyebrow="Catalogo"
      title="Configuracion jerarquica"
      description="Aqui administras como se comporta el formulario: nivel, categoria, tipo y detalle."
      className="catalog-modal-card catalog-sheet-card"
      onClose={onClose}
    >
      <div className="catalog-admin-grid">
        <div className="catalog-admin-column">
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
            <p className="eyebrow">Nuevo nivel</p>
            <form className="modal-form" onSubmit={onCreateLevel}>
              <label className="field">
                Nombre del nivel
                <input
                  className="field-input"
                  value={levelForm.label}
                  onChange={(event) => setLevelForm({ label: event.target.value.toUpperCase() })}
                  placeholder="Ej: NTI"
                />
              </label>

              <button type="submit" className="button primary" disabled={catalogBusy || !levelForm.label.trim()}>
                Agregar nivel
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

          {catalogFormError ? <p className="feedback">{catalogFormError}</p> : null}

          {customFieldsAdminSlot}
        </div>

        <div className="catalog-tree">
          {catalogLoading ? <p className="body-copy">Cargando catalogo...</p> : null}

          <article className="catalog-category-card">
            <div className="catalog-category-header">
              <div>
                <p className="eyebrow">Niveles</p>
                <h3 className="card-title" style={{ marginTop: 10 }}>
                  Lista administrable
                </h3>
              </div>
              <span className="catalog-count">{levels.length} niveles</span>
            </div>

            <div className="catalog-detail-list">
              {levels.map((level) => (
                <div key={level.id} className="catalog-detail-row">
                  {editingLevel?.id === level.id ? (
                    <form className="catalog-edit-form detail" onSubmit={onUpdateLevel}>
                      <label className="field">
                        Nivel
                        <input
                          className="field-input"
                          value={editingLevel.label}
                          onChange={(event) =>
                            setEditingLevel((current) =>
                              current ? { ...current, label: event.target.value.toUpperCase() } : current
                            )
                          }
                        />
                      </label>

                      <div className="catalog-inline-actions">
                        <button type="submit" className="button small primary" disabled={catalogBusy || !editingLevel.label.trim()}>
                          Guardar
                        </button>
                        <button type="button" className="button small" onClick={() => setEditingLevel(null)}>
                          Cancelar
                        </button>
                      </div>
                    </form>
                  ) : (
                    <>
                      <span className="catalog-detail-chip">{level.label}</span>
                      <div className="catalog-inline-actions">
                        <button
                          type="button"
                          className="button small"
                          onClick={() =>
                            setEditingLevel({
                              id: level.id,
                              label: level.label,
                            })
                          }
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          className="button small danger"
                          onClick={() => onDeleteLevel(level.id)}
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
          </article>

          {catalog.map((category) => (
            <article key={category.slug} className="catalog-category-card">
              <div className="catalog-category-header">
                <div>
                  <p className="eyebrow">Categoria</p>
                  <h3 className="card-title" style={{ marginTop: 10 }}>
                    {category.label}
                  </h3>
                </div>
                <span className="catalog-count">{category.types.length} tipos</span>
              </div>

              <div className="catalog-type-list">
                {category.types.map((type) => (
                  <div key={type.id} className="catalog-type-card">
                    <div className="catalog-type-header">
                      <div className="catalog-type-heading">
                        <strong>{type.label}</strong>
                        <span className="catalog-count">{type.details.length} detalles</span>
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
                          onClick={() => onDeleteType(type.id)}
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
                                  onClick={() => onDeleteDetail(detail.id)}
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
          ))}
        </div>
      </div>
    </SheetPanel>
  );
}
