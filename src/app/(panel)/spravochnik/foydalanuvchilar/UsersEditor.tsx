"use client";

import { useState } from "react";
import type { Role, SiteStatus } from "@prisma/client";
import { ROLE_LABEL } from "@/lib/labels";
import { sendJson, useServerMutation } from "@/lib/useServerMutation";

type UserRow = { id: number; name: string; login: string; role: Role; isActive: boolean; siteIds: number[]; siteNames: string[] };
type Draft = { name: string; login: string; role: Role; isActive: boolean; siteIds: number[]; password: string };

const EMPTY: Draft = { name: "", login: "", role: "ACCOUNTANT", isActive: true, siteIds: [], password: "" };

export function UsersEditor({
  users,
  sites,
  currentUserId,
}: {
  users: UserRow[];
  sites: { id: number; name: string; status: SiteStatus }[];
  currentUserId: number;
}) {
  const [editing, setEditing] = useState<number | "new" | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const { run, pending, error, setError } = useServerMutation();

  function start(id: number | "new") {
    setError(null);
    const u = users.find((x) => x.id === id);
    setDraft(u ? { name: u.name, login: u.login, role: u.role, isActive: u.isActive, siteIds: u.siteIds, password: "" } : EMPTY);
    setEditing(id);
  }

  async function save() {
    const ok = await run(() =>
      editing === "new"
        ? sendJson("/api/users", "POST", { name: draft.name, login: draft.login, role: draft.role, siteIds: draft.siteIds, password: draft.password })
        : sendJson(`/api/users/${editing}`, "PATCH", {
            name: draft.name,
            role: draft.role,
            isActive: draft.isActive,
            siteIds: draft.siteIds,
            newPassword: draft.password,
          })
    );
    if (ok) setEditing(null);
  }

  const self = editing === currentUserId;

  return (
    <div className="flex flex-wrap gap-6 items-start">
      <div className="flex-1 min-w-0 w-full md:min-w-[520px] md:w-auto">
        <button className="btn mb-2" onClick={() => start("new")}>
          + Фойдаланувчи
        </button>
        <div className="overflow-x-auto border border-line">
          <table className="tbl">
            <thead>
              <tr>
                <th>Исм</th>
                <th>Логин</th>
                <th>Рол</th>
                <th>Объектлари</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className={u.isActive ? "" : "text-ink-3"}>
                  <td>
                    {u.name}
                    {!u.isActive && <span className="ml-2 text-[12px]">блокланган</span>}
                  </td>
                  <td className="font-mono text-[13px]">{u.login}</td>
                  <td>{ROLE_LABEL[u.role]}</td>
                  <td className="text-[13px]">{u.role === "FOREMAN" ? u.siteNames.join(", ") || "—" : "ҳаммаси"}</td>
                  <td className="text-right">
                    <button className="link text-[13px]" onClick={() => start(u.id)}>
                      Таҳрирлаш
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {editing !== null && (
        <form
          className="w-full md:w-[340px] bg-paper border border-line p-4 flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <h2 className="font-semibold">{editing === "new" ? "Янги фойдаланувчи" : "Таҳрирлаш"}</h2>
          <Labeled label="Исм">
            <input className="field w-full" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} required autoFocus />
          </Labeled>
          <Labeled label="Логин (лотинча)">
            <input
              className="field w-full font-mono"
              value={draft.login}
              disabled={editing !== "new"}
              onChange={(e) => setDraft({ ...draft, login: e.target.value })}
              required
            />
          </Labeled>
          <Labeled label="Рол">
            <select className="field w-full" value={draft.role} disabled={self} onChange={(e) => setDraft({ ...draft, role: e.target.value as Role })}>
              {Object.entries(ROLE_LABEL).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </Labeled>
          {draft.role === "FOREMAN" && (
            <fieldset>
              <legend className="text-[12px] text-ink-3 mb-1">Бириктирилган объектлар</legend>
              <div className="flex flex-col gap-1 max-h-[180px] overflow-auto">
                {sites.map((s) => (
                  <label key={s.id} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={draft.siteIds.includes(s.id)}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          siteIds: e.target.checked ? [...draft.siteIds, s.id] : draft.siteIds.filter((x) => x !== s.id),
                        })
                      }
                    />
                    {s.name}
                    {s.status === "ARCHIVED" && <span className="text-ink-3 text-[12px]">ёпилган</span>}
                  </label>
                ))}
              </div>
            </fieldset>
          )}
          <Labeled label={editing === "new" ? "Парол (камида 8 белги)" : "Янги парол (бўш — ўзгармайди)"}>
            <input
              className="field w-full"
              type="text"
              autoComplete="new-password"
              value={draft.password}
              onChange={(e) => setDraft({ ...draft, password: e.target.value })}
              required={editing === "new"}
            />
          </Labeled>
          {editing !== "new" && !self && (
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={!draft.isActive} onChange={(e) => setDraft({ ...draft, isActive: !e.target.checked })} />
              Блокланган (кира олмайди)
            </label>
          )}
          {error && <p className="text-minus text-[13px]">{error}</p>}
          <div className="flex gap-2">
            <button className="btn btn-primary" disabled={pending}>
              Сақлаш
            </button>
            <button type="button" className="btn" onClick={() => setEditing(null)}>
              Бекор
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[12px] text-ink-3">{label}</span>
      {children}
    </label>
  );
}
