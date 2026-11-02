"use client";

import { useEffect, useState } from "react";
import { Info } from "lucide-react";
import type { TeamsView, TeamView, KeyView } from "@/lib/gateway/service";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import StatCard from "@/components/ui/StatCard";
import EmptyState from "@/components/ui/EmptyState";
import ErrorBanner from "@/components/ui/ErrorBanner";
import Toast from "@/components/ui/Toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip";

interface GatewayClientProps {
  initialView: TeamsView;
  username: string;
}

const BAR_COLOR: Record<"ok" | "warn" | "over", string> = {
  ok: "bg-blue",
  warn: "bg-[oklch(0.72_0.15_75)]",
  over: "bg-[oklch(0.62_0.2_22)]",
};

function usageLevel(usage: number | null, limit: number): "ok" | "warn" | "over" {
  if (usage === null || limit <= 0) return "ok";
  const pct = (usage / limit) * 100;
  if (pct >= 100) return "over";
  if (pct >= 80) return "warn";
  return "ok";
}

function fmtUsd(n: number | null): string {
  return n === null ? "—" : `$${n.toFixed(2)}`;
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  }
}

const ROLE_LABEL: Record<string, string> = {
  admin: "Admin — all teams",
  champion: "Champion — your team",
  member: "Member — your key",
};

/** Localized date, rendered only after mount — server and client locales differ,
 *  so a direct toLocaleString() in SSR breaks hydration (NavBar pattern). */
function LocalDate({ iso }: { iso: string }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 0);
    return () => clearTimeout(t);
  }, []);
  return <>{mounted ? new Date(iso).toLocaleString() : ""}</>;
}

// ---- shared bits ------------------------------------------------------------

function UsageBar({
  limit,
  credit,
  byok,
  savings,
  renewsLabel = "renews 1st",
  compact = false,
}: {
  limit: number;
  credit: number | null;
  byok: number | null;
  savings?: number | null;
  renewsLabel?: string;
  compact?: boolean;
}) {
  const effective = (credit ?? 0) + (byok ?? 0);
  const pct = limit > 0 ? Math.min(100, (effective / limit) * 100) : 0;
  const level = usageLevel(effective, limit);
  return (
    <div>
      <div className={`flex items-baseline justify-between ${compact ? "mb-1" : "mb-1.5"}`}>
        {compact ? null : (
          <span className="inline-flex items-center gap-1 text-[12px] font-bold uppercase tracking-[0.06em] text-muted">
            This month <span className="font-medium normal-case">· {renewsLabel}</span>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label="How usage is calculated"
                  className="inline-flex cursor-help rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-fp-500"
                >
                  <Info className="h-3.5 w-3.5" aria-hidden />
                </button>
              </TooltipTrigger>
              <TooltipContent className="max-w-[220px]">
                Effective usage = Credits + BYOK. BYOK spend counts toward this key&apos;s
                monthly limit, matching the OpenRouter dashboard. Limits reset on the 1st.
              </TooltipContent>
            </Tooltip>
          </span>
        )}
        <span className={`${compact ? "text-[12px]" : "text-[13px]"} font-bold text-navy tabular-nums`}>
          {fmtUsd(effective)} / ${limit.toFixed(0)}{" "}
          <span className="text-muted font-semibold">({Math.round(pct)}%)</span>
        </span>
      </div>
      <div className="h-2.5 rounded-full bg-surface overflow-hidden">
        <div className={`h-full rounded-full ${BAR_COLOR[level]}`} style={{ width: `${Math.max(pct, effective > 0 ? 2 : 0)}%` }} />
      </div>
      {compact ? null : (
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[12px] text-muted">
          <span className="h-2 w-2 rounded-full bg-blue" aria-hidden />
          <span>
            Credits <span className="font-semibold text-navy tabular-nums">{fmtUsd(credit)}</span>
          </span>
          <span className="h-2 w-2 rounded-full bg-coral" aria-hidden />
          <span>
            BYOK <span className="font-semibold text-navy tabular-nums">{fmtUsd(byok)}</span>
          </span>
          {savings !== null && savings !== undefined ? (
            <span className="text-[oklch(0.5_0.13_75)]">· saved ${savings.toFixed(2)}</span>
          ) : null}
        </div>
      )}
    </div>
  );
}

function MemberChips({ members, onRemove }: { members: string[]; onRemove?: (m: string) => void }) {
  if (members.length === 0) {
    return <span className="text-[12px] text-muted">no members yet</span>;
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      {members.map((m) => (
        <span key={m} className="inline-flex items-center gap-1 rounded-full bg-fp-100 text-fp-700 px-2.5 py-0.5 text-[12px] font-semibold">
          {m}
          {onRemove ? (
            <button
              onClick={() => onRemove(m)}
              className="text-fp-400 hover:text-rose-600 cursor-pointer font-bold"
              aria-label={`remove ${m}`}
            >
              ×
            </button>
          ) : null}
        </span>
      ))}
    </span>
  );
}

// ---- key row (admin / champion) ---------------------------------------------

function KeyRow({
  keyItem,
  busy,
  onRevoke,
  onAddMember,
  onRemoveMember,
  onChangeLimit,
}: {
  keyItem: KeyView;
  busy: string | null;
  onRevoke: (k: KeyView) => void;
  onAddMember: (k: KeyView, m: string) => void;
  onRemoveMember: (k: KeyView, m: string) => void;
  onChangeLimit: (k: KeyView, limitUsd: number) => void;
}) {
  const [addUser, setAddUser] = useState("");
  const [editingLimit, setEditingLimit] = useState(false);
  const [limitInput, setLimitInput] = useState(String(keyItem.limitUsd));
  const active = keyItem.status === "active";
  return (
    <div className="rounded-[12px] bg-white border border-border p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <code className="font-mono text-[13px] font-bold text-navy truncate">{keyItem.label}</code>
            {active ? (
              <Badge color="emerald">active</Badge>
            ) : (
              <Badge color="slate">revoked</Badge>
            )}
            {keyItem.savingsUsd !== null ? (
              <span className="text-[11px] text-muted">saved ${keyItem.savingsUsd.toFixed(2)}</span>
            ) : null}
          </div>
          <p className="mt-0.5 text-[11.5px] text-muted">
            Monthly limit <span className="font-semibold text-navy">${keyItem.limitUsd.toFixed(0)}</span>
            {active ? (
              <>
                {" "}
                · created by {keyItem.createdBy}
                {editingLimit ? null : (
                  <span
                    className="ml-1 cursor-pointer text-blue hover:underline"
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      setLimitInput(String(keyItem.limitUsd.toFixed(0)));
                      setEditingLimit(true);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        setLimitInput(String(keyItem.limitUsd.toFixed(0)));
                        setEditingLimit(true);
                      }
                    }}
                  >
                    adjust
                  </span>
                )}
              </>
            ) : null}
          </p>
        </div>
        {active ? (
          <Button
            variant="secondary"
            size="sm"
            disabled={busy === `revoke-${keyItem.id}`}
            onClick={() => onRevoke(keyItem)}
          >
            {busy === `revoke-${keyItem.id}` ? "Working…" : "Revoke"}
          </Button>
        ) : null}
      </div>

      {active ? (
        <div className="mt-2">
          <UsageBar
            compact
            limit={keyItem.limitUsd}
            credit={keyItem.creditUsageUsd}
            byok={keyItem.byokUsageUsd}
          />
        </div>
      ) : null}

      {active && editingLimit ? (
        <div className="mt-2 flex flex-wrap items-end gap-2">
          <div className="w-28">
            <Input
              label="New limit $/mo"
              type="number"
              value={limitInput}
              onChange={(e) => setLimitInput(e.target.value)}
            />
          </div>
          <Button
            size="sm"
            variant="brand"
            disabled={busy === `limit-${keyItem.id}`}
            onClick={() => {
              const n = Number(limitInput);
              if (!Number.isFinite(n) || n <= 0) return;
              onChangeLimit(keyItem, n);
              setEditingLimit(false);
            }}
          >
            {busy === `limit-${keyItem.id}` ? "Saving…" : "Save"}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={busy === `limit-${keyItem.id}`}
            onClick={() => setEditingLimit(false)}
          >
            Cancel
          </Button>
        </div>
      ) : null}

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-muted">Members</span>
        <MemberChips
          members={keyItem.members}
          onRemove={active ? (m) => onRemoveMember(keyItem, m) : undefined}
        />
        {active && keyItem.members.length < 2 ? (
          <span className="inline-flex items-center gap-1.5 ml-auto">
            <input
              value={addUser}
              onChange={(e) => setAddUser(e.target.value)}
              placeholder="username"
              className="w-36 px-2.5 py-1.5 rounded-lg border border-border bg-background text-[12.5px] focus:outline-none focus:border-blue"
            />
            <Button
              variant="brand"
              size="sm"
              disabled={!addUser.trim() || busy === `add-${keyItem.id}`}
              onClick={() => {
                onAddMember(keyItem, addUser.trim());
                setAddUser("");
              }}
            >
              Add
            </Button>
          </span>
        ) : null}
      </div>

      {keyItem.snapshots.length > 0 ? (
        <p className="mt-1.5 text-[11.5px] text-muted">
          Recent checks · <LocalDate iso={keyItem.snapshots[0].capturedAt} /> ·{" "}
          <span className="font-mono tabular-nums text-navy">${keyItem.snapshots[0].usageUsd.toFixed(2)}</span>
        </p>
      ) : null}
    </div>
  );
}

// ---- main component ---------------------------------------------------------

export default function GatewayClient(props: GatewayClientProps) {
  return (
    <TooltipProvider>
      <GatewayClientInner {...props} />
    </TooltipProvider>
  );
}

function GatewayClientInner({ initialView, username }: GatewayClientProps) {
  const [view, setView] = useState<TeamsView>(initialView);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [issued, setIssued] = useState<{ label: string; key: string } | null>(null);
  const [copied, setCopied] = useState(false);
  // revoke confirmation — the pending key, or null when the dialog is closed
  const [revokeTarget, setRevokeTarget] = useState<KeyView | null>(null);
  // create-team form (admin) — toggled open by "＋ New team"
  const [createOpen, setCreateOpen] = useState(false);
  const [tName, setTName] = useState("");
  const [tChampion, setTChampion] = useState("");
  const [tCredit, setTCredit] = useState("30");
  const [tMaxKeys, setTMaxKeys] = useState("2");
  // issue-key form (champion / admin) — one per team handled inline
  const [keyForm, setKeyForm] = useState<Record<number, { limit: string; m1: string; m2: string }>>({});
  // edit-limits form (admin)
  const [limitEdit, setLimitEdit] = useState<Record<number, { credit: string; maxKeys: string }>>({});
  const isAdmin = view.role === "admin";

  const refresh = async (): Promise<void> => {
    const res = await fetch("/api/gateway", { cache: "no-store" });
    if (!res.ok) {
      setError(`Failed to refresh (${res.status})`);
      return;
    }
    setView((await res.json()) as TeamsView);
  };

  const api = async (
    method: string,
    url: string,
    body?: unknown
  ): Promise<{ ok: boolean; body: Record<string, unknown> | null }> => {
    const res = await fetch(url, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    return { ok: res.ok, body: data };
  };

  const createTeam = async (): Promise<void> => {
    setError("");
    setNotice("");
    if (!tName.trim() || !tChampion.trim()) {
      setError("Team name and champion are required");
      return;
    }
    setBusy("create-team");
    try {
      const r = await api("POST", "/api/gateway", {
        name: tName.trim(),
        champion: tChampion.trim(),
        creditUsd: Number(tCredit) || 30,
        maxKeys: Number(tMaxKeys) || 1,
      });
      if (!r.ok) {
        setError(typeof r.body?.error === "string" ? r.body.error : "Create failed");
        return;
      }
      setNotice(`Team "${tName.trim()}" created.`);
      setTName("");
      setTChampion("");
      setTCredit("30");
      setTMaxKeys("2");
      setCreateOpen(false);
      await refresh();
    } finally {
      setBusy(null);
    }
  };

  const issueKey = async (team: TeamView): Promise<void> => {
    const form = keyForm[team.id] ?? { limit: "", m1: "", m2: "" };
    const limit = Number(form.limit);
    if (!Number.isFinite(limit) || limit <= 0) {
      setError("Key limit must be a positive number");
      return;
    }
    setError("");
    setNotice("");
    setBusy(`issue-${team.id}`);
    try {
      const r = await api("POST", `/api/gateway/teams/${team.id}/keys`, {
        limitUsd: limit,
        members: [form.m1.trim(), form.m2.trim()].filter(Boolean),
      });
      if (!r.ok) {
        setError(typeof r.body?.error === "string" ? r.body.error : "Issue failed");
        return;
      }
      setIssued({
        label: typeof r.body?.label === "string" ? r.body.label : "",
        key: typeof r.body?.key === "string" ? r.body.key : "",
      });
      setNotice(typeof r.body?.message === "string" ? r.body.message : "Key issued.");
      setKeyForm((f) => ({ ...f, [team.id]: { limit: "", m1: "", m2: "" } }));
      await refresh();
    } finally {
      setBusy(null);
    }
  };

  const revokeKey = async (k: KeyView): Promise<void> => {
    setError("");
    setNotice("");
    setBusy(`revoke-${k.id}`);
    try {
      const r = await api("DELETE", `/api/gateway/keys/${k.id}`);
      if (!r.ok) {
        setError(typeof r.body?.error === "string" ? r.body.error : "Revoke failed");
        return;
      }
      setNotice(`Key "${k.label}" revoked.`);
      await refresh();
    } finally {
      setBusy(null);
    }
  };

  const addMember = async (k: KeyView, member: string): Promise<void> => {
    setError("");
    setNotice("");
    setBusy(`add-${k.id}`);
    try {
      const r = await api("POST", `/api/gateway/keys/${k.id}/members`, { username: member });
      if (!r.ok) {
        setError(typeof r.body?.error === "string" ? r.body.error : "Add member failed");
        return;
      }
      setNotice(`"${member}" added to ${k.label}.`);
      await refresh();
    } finally {
      setBusy(null);
    }
  };

  const removeMember = async (k: KeyView, member: string): Promise<void> => {
    setError("");
    setNotice("");
    setBusy(`rm-${k.id}-${member}`);
    try {
      const r = await api("DELETE", `/api/gateway/keys/${k.id}/members?username=${encodeURIComponent(member)}`);
      if (!r.ok) {
        setError(typeof r.body?.error === "string" ? r.body.error : "Remove member failed");
        return;
      }
      setNotice(`"${member}" removed from ${k.label}.`);
      await refresh();
    } finally {
      setBusy(null);
    }
  };

  // Revoke button lives in KeyRow; confirmation happens in the controlled
  // AlertDialog below, which calls revokeKey() on the pending key.
  const confirmRevoke = (): void => {
    if (!revokeTarget) return;
    const k = revokeTarget;
    setRevokeTarget(null);
    void revokeKey(k);
  };

  const changeLimit = async (k: KeyView, limitUsd: number): Promise<void> => {
    setError("");
    setNotice("");
    setBusy(`limit-${k.id}`);
    try {
      const r = await api("PATCH", `/api/gateway/keys/${k.id}`, { limitUsd });
      if (!r.ok) {
        setError(typeof r.body?.error === "string" ? r.body.error : "Update failed");
        return;
      }
      setNotice(`Limit for "${k.label}" updated to $${limitUsd.toFixed(2)}/mo.`);
      await refresh();
    } finally {
      setBusy(null);
    }
  };

  const saveLimits = async (team: TeamView): Promise<void> => {
    const form = limitEdit[team.id] ?? { credit: String(team.creditUsd), maxKeys: String(team.maxKeys) };
    setError("");
    setNotice("");
    setBusy(`limits-${team.id}`);
    try {
      const r = await api("PATCH", `/api/gateway/teams/${team.id}`, {
        creditUsd: Number(form.credit),
        maxKeys: Number(form.maxKeys),
      });
      if (!r.ok) {
        setError(typeof r.body?.error === "string" ? r.body.error : "Update failed");
        return;
      }
      setNotice(`Team "${team.name}" limits updated.`);
      await refresh();
    } finally {
      setBusy(null);
    }
  };

  // auto-dismiss the toast 5s after any error/notice lands
  useEffect(() => {
    if (!error && !notice) return;
    const t = setTimeout(() => {
      setError("");
      setNotice("");
    }, 5000);
    return () => clearTimeout(t);
  }, [error, notice]);

  // ---- degraded (DB / OpenRouter down) ---------------------------------------
  if (view.error) {
    return (
      <Card tone="slate" className="space-y-3">
        <ErrorBanner>{view.error}</ErrorBanner>
        <p className="text-[13px] text-muted">
          Alerts, quotas and key metadata are unavailable until the gateway backend recovers.
        </p>
      </Card>
    );
  }

  // ---- member view: only their own key(s) -----------------------------------
  if (view.role === "member") {
    const myKeys = view.teams.flatMap((t) => t.keys);
    if (myKeys.length === 0) {
      return (
        <EmptyState
          icon="🔑"
          title={`No key assigned to ${username} yet`}
          description="Ask your team champion for access."
        />
      );
    }
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <h1 className="text-[18px] font-extrabold text-navy">Your API key</h1>
          <Badge color="fp">member</Badge>
        </div>
        {myKeys.map((k) => (
          <Card key={k.id}>
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <div className="flex items-center gap-2">
                  <code className="font-mono text-[15px] font-bold text-navy">{k.label}</code>
                  <Badge color="emerald">active</Badge>
                </div>
                <p className="mt-1 text-[12.5px] text-muted">
                  Team: <span className="font-semibold text-navy">{view.teams.find((t) => t.id === k.teamId)?.name}</span> · limit{" "}
                  <span className="font-semibold text-navy">${k.limitUsd.toFixed(0)}/mo</span>
                </p>
              </div>
            </div>
            <UsageBar limit={k.limitUsd} credit={k.creditUsageUsd} byok={k.byokUsageUsd} />
            <p className="mt-4 text-[12.5px] text-muted">
              Configure your AI client with base URL{" "}
              <code className="font-mono">https://openrouter.ai/api/v1</code> and model{" "}
              <code className="font-mono">deepseek/deepseek-v4-flash-0731</code>. Contact your champion to rotate the key.
            </p>
          </Card>
        ))}
      </div>
    );
  }

  // ---- no role ----------------------------------------------------------------
  if (view.teams.length === 0 && !isAdmin) {
    return (
      <EmptyState
        icon="🔑"
        title={`You (${username}) have no gateway role`}
        description="Ask an admin to assign you as a team champion, or ask your champion for a key."
      />
    );
  }

  // ---- admin / champion view ---------------------------------------------------
  const totalBudget = view.teams.reduce((s, t) => s + t.creditUsd, 0);
  const spent = view.teams.reduce((s, t) => s + (t.totalUsageUsd ?? 0), 0);
  const spentCredits = view.teams.reduce((s, t) => s + (t.totalCreditUsageUsd ?? 0), 0);
  const spentByok = view.teams.reduce((s, t) => s + (t.totalByokUsageUsd ?? 0), 0);
  const activeKeyCount = view.teams.reduce(
    (s, t) => s + t.keys.filter((k) => k.status === "active").length,
    0
  );
  const saved = view.savings;
  const savedText =
    saved === null || saved === undefined ? "—" : `$${saved.usd.toFixed(2)} (${saved.percent.toFixed(0)}%)`;

  return (
    <>
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <h1 className="text-[18px] font-extrabold text-navy">Team API Gateway</h1>
          <Badge color={isAdmin ? "violet" : "blue"}>{ROLE_LABEL[view.role]}</Badge>
        </div>

        {/* Issued key — shown exactly once */}
      {issued ? (
        <Card className="border-amber-300 bg-amber-50/60">
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-[15px] font-extrabold text-navy">New key {issued.label}</h2>
            <Badge color="amber">shown once</Badge>
          </div>
          <p className="text-[13px] text-muted mb-3">
            Copy it now — fp-toolbox never stores the plaintext key. Share it with the assigned member(s).
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <code className="flex-1 min-w-[280px] break-all rounded-[10px] bg-white border border-border px-3.5 py-2.5 font-mono text-[13px] text-navy">
              {issued.key}
            </code>
            <Button
              variant="secondary"
              size="sm"
              onClick={async () => {
                const ok = await copyText(issued.key);
                setCopied(ok);
                setTimeout(() => setCopied(false), 2000);
              }}
            >
              {copied ? "Copied ✓" : "Copy"}
            </Button>
          </div>
          <p className="mt-3 text-[12.5px] text-muted">
            Base URL: <code className="font-mono">https://openrouter.ai/api/v1</code> · Model:{" "}
            <code className="font-mono">deepseek/deepseek-v4-flash-0731</code>
          </p>
        </Card>
      ) : null}

      {/* Hero KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Monthly budget" value={`$${totalBudget.toFixed(0)}`} />
        <StatCard
          label="Spent this month"
          value={`$${spent.toFixed(2)}`}
          sub={`Credits ${fmtUsd(spentCredits)} · BYOK ${fmtUsd(spentByok)}`}
        />
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              tabIndex={0}
              className="relative rounded-[14px] cursor-help focus:outline-none focus-visible:ring-2 focus-visible:ring-fp-500"
            >
              <StatCard label="Saved vs list price" value={savedText} sub="estimate" />
              <Info className="pointer-events-none absolute right-4 top-4 h-4 w-4 text-muted" aria-hidden />
            </div>
          </TooltipTrigger>
          <TooltipContent className="max-w-[220px]">
            Estimated this month: BYOK-routed usage priced at OpenRouter list rates, minus actual
            BYOK spend (~30% off via Alibaba). % is savings vs that list cost.
          </TooltipContent>
        </Tooltip>
        <StatCard label="Active keys" value={activeKeyCount} />
      </div>

      {/* Admin: create team */}
      {isAdmin ? (
        <div>
          <Button variant="secondary" onClick={() => setCreateOpen(!createOpen)}>
            {createOpen ? "Close" : "＋ New team"}
          </Button>
          {createOpen ? (
            <Card className="mt-3">
              <h2 className="text-[15px] font-extrabold text-navy mb-3">Create team</h2>
              <div className="grid gap-3 sm:grid-cols-[1fr_1fr_110px_110px_auto] items-end">
                <Input label="Team name" value={tName} onChange={(e) => setTName(e.target.value)} placeholder="e.g. Sales" />
                <Input label="Champion (login username)" value={tChampion} onChange={(e) => setTChampion(e.target.value)} placeholder="e.g. glass" />
                <Input label="Credit $/mo" type="number" value={tCredit} onChange={(e) => setTCredit(e.target.value)} />
                <Input label="Max keys" type="number" value={tMaxKeys} onChange={(e) => setTMaxKeys(e.target.value)} />
                <Button onClick={() => void createTeam()} disabled={busy !== null}>
                  Create
                </Button>
              </div>
            </Card>
          ) : null}
        </div>
      ) : null}

      {/* Team sections */}
      {view.teams.map((team) => {
        const form = keyForm[team.id] ?? { limit: "", m1: "", m2: "" };
        const edit = limitEdit[team.id] ?? { credit: String(team.creditUsd), maxKeys: String(team.maxKeys) };
        const activeKeys = team.keys.filter((k) => k.status === "active");
        return (
          <Card key={team.id} noPadding>
            {/* team header */}
            <div className="px-5 py-4 border-b border-border flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-[16px] font-extrabold text-navy">{team.name}</h2>
                <p className="mt-0.5 text-[12px] text-muted">
                  Champion: <span className="font-semibold text-navy">{team.champion}</span>
                  {team.champion === username ? " (you)" : ""}
                </p>
              </div>
              <div className="flex items-center gap-2.5">
                <Badge color="slate">
                  {activeKeys.length}/{team.maxKeys} keys
                </Badge>
              </div>
            </div>

            {/* team body */}
            <div className="px-5 py-4 space-y-4">
              <UsageBar
                limit={team.creditUsd}
                credit={team.totalCreditUsageUsd}
                byok={team.totalByokUsageUsd}
                savings={team.totalSavingsUsd}
              />

                {/* keys */}
                <div className="space-y-3">
                  {team.keys.length === 0 ? (
                    <p className="text-[13px] text-muted">No keys yet.</p>
                  ) : (
                    team.keys.map((k) => (
                      <KeyRow
                        key={k.id}
                        keyItem={k}
                        busy={busy}
                        onRevoke={(kk) => setRevokeTarget(kk)}
                        onAddMember={(kk, m) => void addMember(kk, m)}
                        onRemoveMember={(kk, m) => void removeMember(kk, m)}
                        onChangeLimit={(kk, n) => void changeLimit(kk, n)}
                      />
                    ))
                  )}
                </div>

                {/* champion/admin: issue key */}
                {activeKeys.length < team.maxKeys ? (
                  <div className="grid gap-2 sm:grid-cols-[120px_1fr_1fr_auto] items-end">
                    <Input
                      label="Limit $/mo"
                      type="number"
                      value={form.limit}
                      onChange={(e) =>
                        setKeyForm((s) => ({ ...s, [team.id]: { ...form, limit: e.target.value } }))
                      }
                      placeholder="15"
                    />
                    <Input
                      label="Member 1 (username)"
                      value={form.m1}
                      onChange={(e) => setKeyForm((s) => ({ ...s, [team.id]: { ...form, m1: e.target.value } }))}
                      placeholder="optional"
                    />
                    <Input
                      label="Member 2 (username)"
                      value={form.m2}
                      onChange={(e) => setKeyForm((s) => ({ ...s, [team.id]: { ...form, m2: e.target.value } }))}
                      placeholder="optional — max 2 per key"
                    />
                    <Button
                      size="sm"
                      disabled={busy === `issue-${team.id}` || !form.limit}
                      onClick={() => void issueKey(team)}
                    >
                      {busy === `issue-${team.id}` ? "Issuing…" : "Issue key"}
                    </Button>
                  </div>
                ) : (
                  <p className="text-[12.5px] text-muted">
                    Key limit reached ({team.maxKeys}) — ask an admin to raise it.
                  </p>
                )}

                {/* admin: edit limits */}
                {isAdmin ? (
                  <div className="flex flex-wrap items-end gap-2">
                    <div className="w-28">
                      <Input
                        label="Credit $/mo"
                        type="number"
                        value={edit.credit}
                        onChange={(e) =>
                          setLimitEdit((s) => ({ ...s, [team.id]: { ...edit, credit: e.target.value } }))
                        }
                      />
                    </div>
                    <div className="w-24">
                      <Input
                        label="Max keys"
                        type="number"
                        value={edit.maxKeys}
                        onChange={(e) =>
                          setLimitEdit((s) => ({ ...s, [team.id]: { ...edit, maxKeys: e.target.value } }))
                        }
                      />
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={busy === `limits-${team.id}`}
                      onClick={() => void saveLimits(team)}
                    >
                      {busy === `limits-${team.id}` ? "Saving…" : "Save limits"}
                    </Button>
                  </div>
                ) : null}
              </div>
          </Card>
        );
      })}

      {/* Admin: alerts */}
      {isAdmin && view.alerts.length > 0 ? (
        <Card tone="slate">
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-[15px] font-extrabold text-navy">Recent alerts</h2>
            <Badge color="amber">{view.alerts.length}</Badge>
          </div>
          <ul className="space-y-1.5">
            {view.alerts.map((a, i) => {
              const team = view.teams.find((t) => t.id === a.teamId);
              return (
                <li key={`${a.keyId}-${a.level}-${i}`} className="flex flex-wrap items-center gap-2 text-[13px]">
                  <Badge color={a.level === "100" ? "rose" : "amber"}>
                    {a.level === "100" ? "limit hit" : "80%"}
                  </Badge>
                  <span className="font-semibold text-navy">{team?.name ?? `#${a.teamId}`}</span>
                  <span className="text-muted">${a.usageUsd.toFixed(2)}</span>
                  <span className="ml-auto text-muted"><LocalDate iso={a.sentAt} /></span>
                </li>
              );
            })}
          </ul>
        </Card>
      ) : null}
      </div>

      <AlertDialog
        open={revokeTarget !== null}
        onOpenChange={(open) => {
          if (!open) setRevokeTarget(null);
        }}
      >
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke API key</AlertDialogTitle>
            <AlertDialogDescription>
              {`Revoke key "${revokeTarget?.label}"? It stops working immediately.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel asChild>
              <Button variant="secondary">Cancel</Button>
            </AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button variant="primary" onClick={confirmRevoke}>
                Revoke
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {(error || notice) ? (
        <Toast
          tone={error ? "error" : "success"}
          message={error || notice}
          onClose={() => {
            setError("");
            setNotice("");
          }}
        />
      ) : null}
    </>
  );
}