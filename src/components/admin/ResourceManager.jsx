// src/components/admin/ResourceManager.jsx
//
// Generic CRUD table + form for a single Firestore collection. Admin.jsx
// mounts one of these per tab (Users / Groups / Lab Sessions / Lectures /
// Assessments) instead of five bespoke forms.
//
// Supported field types: text | textarea | number | date | select |
// docRef | docRefMulti
//
// docRef / docRefMulti fields store real Firestore DocumentReferences
// (matching how AuthContext/Attendance/LabCalendar already read
// groupId / groupIds / members) and are rendered as a dropdown or
// checkbox list sourced from the "users" or "groups" collections.

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
import { Pencil, Trash2, Plus, X, Loader2 } from "lucide-react";

// Fields whose values get rendered as a colored StatusPill in the table
// instead of plain text.
const PILL_KEYS = new Set(["status", "type", "role"]);

function refToId(value) {
  return value?.id ?? "";
}

function displayValue(field, raw, refOptions) {
  if (raw === undefined || raw === null || raw === "") return "—";

  if (field.type === "docRef") {
    const id = refToId(raw);
    const match = refOptions[field.ref]?.find((o) => o.id === id);
    return match ? match[field.refLabel] : id || "—";
  }

  if (field.type === "docRefMulti") {
    const ids = (raw || []).map(refToId);
    if (!ids.length) return "—";
    return ids
      .map((id) => refOptions[field.ref]?.find((o) => o.id === id)?.[field.refLabel] || id)
      .join(", ");
  }

  if (field.type === "date") {
    return new Date(raw + "T00:00:00").toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  return String(raw);
}

export function ResourceManager({
  collectionName,
  fields,
  columns, // which field keys to show in the table; defaults to first 4
  orderByField,
  customId, // { label, placeholder, hint } — when set, creation asks for an explicit doc ID
  emptyLabel = "Nothing here yet",
  allowCreate = true, // set false for collections that populate themselves (e.g. users, via sign-in)
  helperText, // optional note shown above the table, e.g. explaining where rows come from
}) {
  const constraints = orderByField ? [orderBy(orderByField)] : [];
  const { data: items, loading } = useCollection(collectionName, constraints);

  // The only two collections anything currently references. Always
  // subscribed (cheap) so hook count stays constant across renders.
  const { data: allUsers } = useCollection("users");
  const { data: allGroups } = useCollection("groups");
  const refOptions = { users: allUsers, groups: allGroups };

  const [editingId, setEditingId] = useState(null); // null | "new" | <docId>
  const [form, setForm] = useState({});
  const [customIdValue, setCustomIdValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const columnFields = (columns && columns.length ? columns : fields.slice(0, 4).map((f) => f.key))
    .map((key) => fields.find((f) => f.key === key))
    .filter(Boolean);

  const startCreate = () => {
    setForm(Object.fromEntries(fields.map((f) => [f.key, f.type === "docRefMulti" ? [] : ""])));
    setCustomIdValue("");
    setEditingId("new");
  };

  const startEdit = (item) => {
    const initial = {};
    fields.forEach((f) => {
      if (f.type === "docRef") initial[f.key] = refToId(item[f.key]);
      else if (f.type === "docRefMulti") initial[f.key] = (item[f.key] || []).map(refToId);
      else initial[f.key] = item[f.key] ?? "";
    });
    setForm(initial);
    setEditingId(item.id);
  };

  const cancel = () => {
    setEditingId(null);
    setForm({});
  };

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const toggleMulti = (key, id) =>
    setForm((prev) => {
      const current = prev[key] || [];
      return {
        ...prev,
        [key]: current.includes(id) ? current.filter((v) => v !== id) : [...current, id],
      };
    });

  const buildPayload = () => {
    const payload = {};
    fields.forEach((f) => {
      const value = form[f.key];
      if (f.type === "docRef") {
        payload[f.key] = value ? doc(db, f.ref, value) : null;
      } else if (f.type === "docRefMulti") {
        payload[f.key] = (value || []).map((id) => doc(db, f.ref, id));
      } else if (f.type === "number") {
        payload[f.key] = value === "" ? null : Number(value);
      } else {
        payload[f.key] = value ?? "";
      }
    });
    return payload;
  };

  const save = async () => {
    setSaving(true);
    try {
      const payload = buildPayload();
      if (editingId === "new") {
        if (customId) {
          await setDoc(doc(db, collectionName, customIdValue.trim()), payload);
        } else {
          await addDoc(collection(db, collectionName), payload);
        }
      } else {
        await updateDoc(doc(db, collectionName, editingId), payload);
      }
      cancel();
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    await deleteDoc(doc(db, collectionName, id));
    setConfirmDeleteId(null);
  };

  const canSave =
    !saving && !(customId && editingId === "new" && !customIdValue.trim());

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          {items.length} {items.length === 1 ? "record" : "records"}
        </p>
        {editingId === null && allowCreate && (
          <button
            onClick={startCreate}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-3 py-2 rounded-lg transition-colors"
          >
            <Plus size={16} /> Add new
          </button>
        )}
      </div>

      {helperText && <p className="text-xs text-slate-400 -mt-2">{helperText}</p>}

      {editingId !== null && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-slate-800">
              {editingId === "new" ? "Add new" : "Edit record"}
            </h4>
            <button onClick={cancel} className="text-slate-400 hover:text-slate-600">
              <X size={18} />
            </button>
          </div>

          {editingId === "new" && customId && (
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                {customId.label}
              </label>
              <input
                value={customIdValue}
                onChange={(e) => setCustomIdValue(e.target.value)}
                placeholder={customId.placeholder}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {customId.hint && <p className="text-xs text-slate-400 mt-1">{customId.hint}</p>}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {fields
              .filter((f) => !f.showIf || f.showIf(form))
              .map((f) => (
                <div key={f.key} className={f.wide ? "sm:col-span-2" : ""}>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                    {f.label}
                  </label>

                  {f.type === "select" && (
                    <select
                      value={form[f.key] || ""}
                      onChange={(e) => setField(f.key, e.target.value)}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select…</option>
                      {f.options.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  )}

                  {f.type === "docRef" && (
                    <select
                      value={form[f.key] || ""}
                      onChange={(e) => setField(f.key, e.target.value)}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">None</option>
                      {(refOptions[f.ref] || []).map((opt) => (
                        <option key={opt.id} value={opt.id}>
                          {opt[f.refLabel]}
                        </option>
                      ))}
                    </select>
                  )}

                  {f.type === "docRefMulti" && (
                    <div className="border border-slate-300 rounded-lg max-h-36 overflow-y-auto p-2 space-y-1">
                      {(refOptions[f.ref] || []).map((opt) => (
                        <label key={opt.id} className="flex items-center gap-2 text-sm text-slate-600">
                          <input
                            type="checkbox"
                            checked={(form[f.key] || []).includes(opt.id)}
                            onChange={() => toggleMulti(f.key, opt.id)}
                          />
                          {opt[f.refLabel]}
                        </label>
                      ))}
                      {(refOptions[f.ref] || []).length === 0 && (
                        <p className="text-xs text-slate-400">No {f.ref} yet</p>
                      )}
                    </div>
                  )}

                  {(f.type === "text" || f.type === "number" || f.type === "date") && (
                    <input
                      type={f.type === "date" ? "date" : f.type === "number" ? "number" : "text"}
                      value={form[f.key] ?? ""}
                      placeholder={f.placeholder}
                      onChange={(e) => setField(f.key, e.target.value)}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  )}

                  {f.type === "textarea" && (
                    <textarea
                      value={form[f.key] ?? ""}
                      placeholder={f.placeholder}
                      onChange={(e) => setField(f.key, e.target.value)}
                      rows={3}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  )}
                </div>
              ))}
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={save}
              disabled={!canSave}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              onClick={cancel}
              className="text-slate-500 hover:text-slate-700 text-sm font-medium px-4 py-2"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 flex justify-center text-slate-400">
            <Loader2 className="animate-spin" size={20} />
          </div>
        ) : items.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-400">{emptyLabel}</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left">
                {columnFields.map((f) => (
                  <th
                    key={f.key}
                    className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide"
                  >
                    {f.label}
                  </th>
                ))}
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((item) => (
                <tr key={item.id}>
                  {columnFields.map((f) => (
                    <td key={f.key} className="px-4 py-3 text-slate-600">
                      {PILL_KEYS.has(f.key) && item[f.key] ? (
                        <StatusPill status={item[f.key]} />
                      ) : (
                        displayValue(f, item[f.key], refOptions)
                      )}
                    </td>
                  ))}
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <button
                      onClick={() => startEdit(item)}
                      className="p-1.5 text-slate-400 hover:text-blue-600"
                      aria-label="Edit"
                    >
                      <Pencil size={16} />
                    </button>
                    {confirmDeleteId === item.id ? (
                      <button
                        onClick={() => remove(item.id)}
                        className="p-1.5 text-red-600 font-medium text-xs"
                      >
                        Confirm?
                      </button>
                    ) : (
                      <button
                        onClick={() => setConfirmDeleteId(item.id)}
                        className="p-1.5 text-slate-400 hover:text-red-600"
                        aria-label="Delete"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
