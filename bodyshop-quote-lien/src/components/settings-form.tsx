"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type SettingsState = {
  defaultBodyLaborRateCents: number;
  defaultPaintLaborRateCents: number;
  defaultMechLaborRateCents: number;
  defaultDetailLaborRateCents: number;
  partsMarkupRuleJson: any;
  subletMarkupPercent: number;
  materialsFormulaJson: any;
  defaultShopFeesJson: any;
  defaultTaxRatePercent: number;
  storagePolicyDefaultsJson: any;
  lienFlagRulesJson: any;
  releaseControlEnabled: boolean;
};

export function SettingsForm({ initial }: { initial: SettingsState }) {
  const [state, setState] = useState<SettingsState>(initial);
  const [message, setMessage] = useState<string | null>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [newUser, setNewUser] = useState({ name: "", email: "", password: "", role: "TECH" });

  async function loadUsers() {
    const response = await fetch("/api/users");
    if (!response.ok) return;
    const data = await response.json();
    setUsers(data.users);
  }

  useEffect(() => {
    loadUsers();
  }, []);

  async function save() {
    setMessage(null);
    const response = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(state)
    });

    if (!response.ok) {
      setMessage("Save failed. Owner role required.");
      return;
    }

    setMessage("Settings saved");
  }

  async function createUser() {
    const response = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newUser)
    });
    if (!response.ok) {
      setMessage("Unable to create user.");
      return;
    }
    setNewUser({ name: "", email: "", password: "", role: "TECH" });
    setMessage("User created.");
    await loadUsers();
  }

  return (
    <Card className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <div><label>Body Labor Rate (cents/hr)</label><Input type="number" value={state.defaultBodyLaborRateCents} onChange={(e) => setState({ ...state, defaultBodyLaborRateCents: Number(e.target.value) })} /></div>
        <div><label>Paint Labor Rate (cents/hr)</label><Input type="number" value={state.defaultPaintLaborRateCents} onChange={(e) => setState({ ...state, defaultPaintLaborRateCents: Number(e.target.value) })} /></div>
        <div><label>Mech Labor Rate (cents/hr)</label><Input type="number" value={state.defaultMechLaborRateCents} onChange={(e) => setState({ ...state, defaultMechLaborRateCents: Number(e.target.value) })} /></div>
        <div><label>Detail Labor Rate (cents/hr)</label><Input type="number" value={state.defaultDetailLaborRateCents} onChange={(e) => setState({ ...state, defaultDetailLaborRateCents: Number(e.target.value) })} /></div>
        <div><label>Sublet Markup %</label><Input type="number" value={state.subletMarkupPercent} onChange={(e) => setState({ ...state, subletMarkupPercent: Number(e.target.value) })} /></div>
        <div><label>Tax %</label><Input type="number" value={state.defaultTaxRatePercent} onChange={(e) => setState({ ...state, defaultTaxRatePercent: Number(e.target.value) })} /></div>
      </div>

      <details>
        <summary className="cursor-pointer font-semibold">Advanced JSON Rules</summary>
        <div className="mt-3 space-y-3">
          <label>Parts Markup Tiers JSON</label>
          <textarea className="w-full rounded border p-2 text-sm" rows={5} value={JSON.stringify(state.partsMarkupRuleJson, null, 2)} onChange={(e) => setJsonField("partsMarkupRuleJson", e.target.value)} />
          <label>Materials Formula JSON</label>
          <textarea className="w-full rounded border p-2 text-sm" rows={5} value={JSON.stringify(state.materialsFormulaJson, null, 2)} onChange={(e) => setJsonField("materialsFormulaJson", e.target.value)} />
          <label>Shop Fees JSON</label>
          <textarea className="w-full rounded border p-2 text-sm" rows={5} value={JSON.stringify(state.defaultShopFeesJson, null, 2)} onChange={(e) => setJsonField("defaultShopFeesJson", e.target.value)} />
          <label>Storage Defaults JSON</label>
          <textarea className="w-full rounded border p-2 text-sm" rows={5} value={JSON.stringify(state.storagePolicyDefaultsJson, null, 2)} onChange={(e) => setJsonField("storagePolicyDefaultsJson", e.target.value)} />
          <label>Lien Rules JSON</label>
          <textarea className="w-full rounded border p-2 text-sm" rows={5} value={JSON.stringify(state.lienFlagRulesJson, null, 2)} onChange={(e) => setJsonField("lienFlagRulesJson", e.target.value)} />
        </div>
      </details>

      <div className="flex items-center gap-2">
        <input id="releaseControlEnabled" type="checkbox" checked={state.releaseControlEnabled} onChange={(e) => setState({ ...state, releaseControlEnabled: e.target.checked })} />
        <label htmlFor="releaseControlEnabled">Block DELIVERED status when balance {'>'} 0 (OWNER override required)</label>
      </div>

      <Button onClick={save}>Save Settings</Button>
      {message ? <p className="text-sm">{message}</p> : null}

      <div className="border-t pt-4">
        <h3 className="mb-2 text-lg font-semibold">User Management</h3>
        <div className="grid gap-2 md:grid-cols-4">
          <Input placeholder="Name" value={newUser.name} onChange={(e) => setNewUser({ ...newUser, name: e.target.value })} />
          <Input placeholder="Email" value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} />
          <Input type="password" placeholder="Password" value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} />
          <select className="rounded border px-2" value={newUser.role} onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}>
            <option>TECH</option>
            <option>OFFICE</option>
            <option>OWNER</option>
          </select>
        </div>
        <div className="mt-2 flex gap-2">
          <Button variant="outline" onClick={loadUsers}>Refresh Users</Button>
          <Button onClick={createUser}>Create User</Button>
        </div>
        <div className="mt-3 space-y-1 text-sm">
          {users.map((user) => (
            <div key={user.id} className="rounded border p-2">
              {user.name} · {user.email} · {user.role}
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
  function setJsonField<K extends keyof SettingsState>(key: K, value: string) {
    try {
      const parsed = JSON.parse(value || "{}");
      setState((prev) => ({ ...prev, [key]: parsed }));
      setMessage(null);
    } catch {
      setMessage("Invalid JSON in advanced settings.");
    }
  }
