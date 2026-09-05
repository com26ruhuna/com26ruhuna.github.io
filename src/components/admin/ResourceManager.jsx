// src/components/admin/ResourceManager.jsx

import { useState } from "react";

import {
  addDoc,
  updateDoc,
  deleteDoc,
  setDoc,
  doc,
  collection,
  orderBy,
} from "firebase/firestore";

import { db } from "../../config/firebase";
import { useCollection } from "../../hooks/useFirestore";
import { StatusPill } from "../StatusPill";

import {
  Pencil,
  Trash2,
  Plus,
  X,
  Loader2,
} from "lucide-react";

const PILL_KEYS = new Set([
  "status",
  "type",
  "role",
]);

function refToId(value) {
  return value?.id ?? "";
}

function formatTime(value) {
  if (!value) return "—";

  const [hours, minutes] =
    String(value).split(":");

  if (
    hours === undefined ||
    minutes === undefined
  ) {
    return String(value);
  }

  const date = new Date();

  date.setHours(
    Number(hours),
    Number(minutes),
    0,
    0
  );

  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function displayValue(
  field,
  raw,
  refOptions
) {
  if (
    raw === undefined ||
    raw === null ||
    raw === ""
  ) {
    return "—";
  }

  if (field.type === "docRef") {
    const id = refToId(raw);

    const match =
      refOptions[field.ref]?.find(
        (option) => option.id === id
      );

    return match
      ? match[field.refLabel]
      : id || "—";
  }

  if (field.type === "docRefMulti") {
    const ids = (raw || []).map(refToId);

    if (!ids.length) {
      return "—";
    }

    return ids
      .map(
        (id) =>
          refOptions[field.ref]?.find(
            (option) =>
              option.id === id
          )?.[field.refLabel] || id
      )
      .join(", ");
  }

  if (field.type === "date") {
    return new Date(
      `${raw}T00:00:00`
    ).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  if (field.type === "time") {
    return formatTime(raw);
  }

  return String(raw);
}

export function ResourceManager({
  collectionName,
  fields,
  columns,
  orderByField,
  customId,
  emptyLabel = "Nothing here yet",
  allowCreate = true,
  helperText,
}) {
  const constraints = orderByField
    ? [orderBy(orderByField)]
    : [];

  const {
    data: items,
    loading,
  } = useCollection(
    collectionName,
    constraints
  );

  // Reference data used by docRef/docRefMulti fields.
  const {
    data: allUsers,
  } = useCollection("users");

  const {
    data: allGroups,
  } = useCollection("groups");

  const refOptions = {
    users: allUsers,
    groups: allGroups,
  };

  const [
    editingId,
    setEditingId,
  ] = useState(null);

  const [
    form,
    setForm,
  ] = useState({});

  const [
    customIdValue,
    setCustomIdValue,
  ] = useState("");

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [
    confirmDeleteId,
    setConfirmDeleteId,
  ] = useState(null);

  const columnFields = (
    columns && columns.length
      ? columns
      : fields
          .slice(0, 4)
          .map((field) => field.key)
  )
    .map((key) =>
      fields.find(
        (field) => field.key === key
      )
    )
    .filter(Boolean);

  const startCreate = () => {
    const initial = {};

    fields.forEach((field) => {
      initial[field.key] =
        field.type === "docRefMulti"
          ? []
          : "";
    });

    setForm(initial);
    setCustomIdValue("");
    setEditingId("new");
  };

  const startEdit = (item) => {
    const initial = {};

    fields.forEach((field) => {
      if (field.type === "docRef") {
        initial[field.key] =
          refToId(item[field.key]);
      } else if (
        field.type === "docRefMulti"
      ) {
        initial[field.key] = (
          item[field.key] || []
        ).map(refToId);
      } else {
        initial[field.key] =
          item[field.key] ?? "";
      }
    });

    setForm(initial);
    setEditingId(item.id);
  };

  const cancel = () => {
    setEditingId(null);
    setForm({});
    setCustomIdValue("");
    setConfirmDeleteId(null);
  };

  const setField = (
    key,
    value
  ) => {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const toggleMulti = (
    key,
    id
  ) => {
    setForm((prev) => {
      const current =
        prev[key] || [];

      return {
        ...prev,
        [key]: current.includes(id)
          ? current.filter(
              (value) =>
                value !== id
            )
          : [
              ...current,
              id,
            ],
      };
    });
  };

  const buildPayload = () => {
    const payload = {};

    fields.forEach((field) => {
      const value =
        form[field.key];

      if (
        field.type === "docRef"
      ) {
        payload[field.key] =
          value
            ? doc(
                db,
                field.ref,
                value
              )
            : null;
      } else if (
        field.type ===
        "docRefMulti"
      ) {
        payload[field.key] =
          (value || []).map(
            (id) =>
              doc(
                db,
                field.ref,
                id
              )
          );
      } else if (
        field.type === "number"
      ) {
        payload[field.key] =
          value === ""
            ? null
            : Number(value);
      } else {
        payload[field.key] =
          value ?? "";
      }
    });

    return payload;
  };

  const save = async () => {
    setSaving(true);

    try {
      const payload =
        buildPayload();

      if (
        editingId === "new"
      ) {
        if (
          customId &&
          customIdValue.trim()
        ) {
          await setDoc(
            doc(
              db,
              collectionName,
              customIdValue.trim()
            ),
            payload
          );
        } else {
          await addDoc(
            collection(
              db,
              collectionName
            ),
            payload
          );
        }
      } else {
        await updateDoc(
          doc(
            db,
            collectionName,
            editingId
          ),
          payload
        );
      }

      cancel();
    } catch (error) {
      console.error(
        "Failed to save:",
        error
      );

      alert(
        error?.message ||
          "Failed to save the record."
      );
    } finally {
      setSaving(false);
    }
  };

  const remove = async (
    id
  ) => {
    try {
      await deleteDoc(
        doc(
          db,
          collectionName,
          id
        )
      );

      setConfirmDeleteId(null);
    } catch (error) {
      console.error(
        "Failed to delete:",
        error
      );

      alert(
        error?.message ||
          "Failed to delete the record."
      );
    }
  };

  const canSave =
    !saving &&
    !(
      customId &&
      editingId === "new" &&
      !customIdValue.trim()
    );

  return (
    <div className="space-y-4">

      {/* Summary + Add */}
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-slate-500">
          {items.length}{" "}
          {items.length === 1
            ? "record"
            : "records"}
        </p>

        {editingId === null &&
          allowCreate && (
            <button
              type="button"
              onClick={startCreate}
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-3 py-2 rounded-lg transition-colors"
            >
              <Plus size={16} />
              Add new
            </button>
          )}
      </div>

      {helperText && (
        <p className="text-xs text-slate-400 -mt-2">
          {helperText}
        </p>
      )}

      {/* Add/Edit form */}
      {editingId !== null && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5 space-y-4">

          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-slate-800">
              {editingId === "new"
                ? "Add new"
                : "Edit record"}
            </h4>

            <button
              type="button"
              onClick={cancel}
              className="text-slate-400 hover:text-slate-600"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>

          {/* Custom document ID */}
          {editingId === "new" &&
            customId && (
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                  {customId.label}
                </label>

                <input
                  value={
                    customIdValue
                  }
                  onChange={(e) =>
                    setCustomIdValue(
                      e.target.value
                    )
                  }
                  placeholder={
                    customId.placeholder
                  }
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />

                {customId.hint && (
                  <p className="text-xs text-slate-400 mt-1">
                    {customId.hint}
                  </p>
                )}
              </div>
            )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

            {fields
              .filter(
                (field) =>
                  !field.showIf ||
                  field.showIf(form)
              )
              .map((field) => (
                <div
                  key={field.key}
                  className={
                    field.wide
                      ? "sm:col-span-2"
                      : ""
                  }
                >
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                    {field.label}
                  </label>

                  {/* Select */}
                  {field.type ===
                    "select" && (
                    <select
                      value={
                        form[field.key] ||
                        ""
                      }
                      onChange={(e) =>
                        setField(
                          field.key,
                          e.target.value
                        )
                      }
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">
                        Select…
                      </option>

                      {field.options.map(
                        (option) => (
                          <option
                            key={option}
                            value={option}
                          >
                            {option}
                          </option>
                        )
                      )}
                    </select>
                  )}

                  {/* Single reference */}
                  {field.type ===
                    "docRef" && (
                    <select
                      value={
                        form[field.key] ||
                        ""
                      }
                      onChange={(e) =>
                        setField(
                          field.key,
                          e.target.value
                        )
                      }
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">
                        None
                      </option>

                      {(
                        refOptions[
                          field.ref
                        ] || []
                      ).map(
                        (option) => (
                          <option
                            key={option.id}
                            value={option.id}
                          >
                            {
                              option[
                                field.refLabel
                              ]
                            }
                          </option>
                        )
                      )}
                    </select>
                  )}

                  {/* Multiple references */}
                  {field.type ===
                    "docRefMulti" && (
                    <div className="border border-slate-300 rounded-lg max-h-36 overflow-y-auto p-2 space-y-1">
                      {(
                        refOptions[
                          field.ref
                        ] || []
                      ).map(
                        (option) => (
                          <label
                            key={
                              option.id
                            }
                            className="flex items-center gap-2 text-sm text-slate-600"
                          >
                            <input
                              type="checkbox"
                              checked={(
                                form[
                                  field.key
                                ] || []
                              ).includes(
                                option.id
                              )}
                              onChange={() =>
                                toggleMulti(
                                  field.key,
                                  option.id
                                )
                              }
                            />

                            {
                              option[
                                field.refLabel
                              ]
                            }
                          </label>
                        )
                      )}

                      {(
                        refOptions[
                          field.ref
                        ] || []
                      ).length === 0 && (
                        <p className="text-xs text-slate-400">
                          No{" "}
                          {field.ref} yet
                        </p>
                      )}
                    </div>
                  )}

                  {/* Text / Number / Date / Time */}
                  {(
                    field.type ===
                      "text" ||
                    field.type ===
                      "number" ||
                    field.type ===
                      "date" ||
                    field.type ===
                      "time"
                  ) && (
                    <input
                      type={
                        field.type ===
                        "date"
                          ? "date"
                          : field.type ===
                            "time"
                          ? "time"
                          : field.type ===
                            "number"
                          ? "number"
                          : "text"
                      }
                      value={
                        form[field.key] ??
                        ""
                      }
                      placeholder={
                        field.placeholder
                      }
                      min={
                        field.type ===
                        "time"
                          ? "00:00"
                          : undefined
                      }
                      max={
                        field.type ===
                        "time"
                          ? "23:59"
                          : undefined
                      }
                      step={
                        field.type ===
                        "time"
                          ? 60
                          : undefined
                      }
                      onChange={(e) =>
                        setField(
                          field.key,
                          e.target.value
                        )
                      }
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  )}

                  {/* Textarea */}
                  {field.type ===
                    "textarea" && (
                    <textarea
                      value={
                        form[field.key] ??
                        ""
                      }
                      placeholder={
                        field.placeholder
                      }
                      onChange={(e) =>
                        setField(
                          field.key,
                          e.target.value
                        )
                      }
                      rows={3}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  )}
                </div>
              ))}
          </div>

          {/* Buttons */}
          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={save}
              disabled={!canSave}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              {saving
                ? "Saving…"
                : "Save"}
            </button>

            <button
              type="button"
              onClick={cancel}
              className="text-slate-500 hover:text-slate-700 text-sm font-medium px-4 py-2"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Data table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">

        {loading ? (
          <div className="p-8 flex justify-center text-slate-400">
            <Loader2
              className="animate-spin"
              size={20}
            />
          </div>
        ) : items.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-400">
            {emptyLabel}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left">
                  {columnFields.map(
                    (field) => (
                      <th
                        key={field.key}
                        className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap"
                      >
                        {field.label}
                      </th>
                    )
                  )}

                  <th className="px-4 py-3" />
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {items.map((item) => (
                  <tr key={item.id}>

                    {columnFields.map(
                      (field) => (
                        <td
                          key={field.key}
                          className="px-4 py-3 text-slate-600 whitespace-nowrap"
                        >
                          {PILL_KEYS.has(
                            field.key
                          ) &&
                          item[
                            field.key
                          ] ? (
                            <StatusPill
                              status={
                                item[
                                  field.key
                                ]
                              }
                            />
                          ) : (
                            displayValue(
                              field,
                              item[
                                field.key
                              ],
                              refOptions
                            )
                          )}
                        </td>
                      )
                    )}

                    <td className="px-4 py-3 text-right whitespace-nowrap">

                      <button
                        type="button"
                        onClick={() =>
                          startEdit(item)
                        }
                        className="p-1.5 text-slate-400 hover:text-blue-600"
                        aria-label="Edit"
                      >
                        <Pencil
                          size={16}
                        />
                      </button>

                      {confirmDeleteId ===
                      item.id ? (
                        <button
                          type="button"
                          onClick={() =>
                            remove(
                              item.id
                            )
                          }
                          className="p-1.5 text-red-600 font-medium text-xs"
                        >
                          Confirm?
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() =>
                            setConfirmDeleteId(
                              item.id
                            )
                          }
                          className="p-1.5 text-slate-400 hover:text-red-600"
                          aria-label="Delete"
                        >
                          <Trash2
                            size={16}
                          />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}