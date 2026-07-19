"use client";

import { useMemo, useState } from "react";

import { Input } from "@/components/ui/input";

export type ActivityRow = { id: string; actor: string; action: string; entityType: string; occurredAt: string; timestamp: number };

export function ActivityTable({ rows }: { rows: ActivityRow[] }) {
  const [query, setQuery] = useState("");
  const [action, setAction] = useState("ALL");
  const actions = useMemo(() => [...new Set(rows.map((row) => row.action))].sort(), [rows]);
  const filtered = rows.filter((row) => (action === "ALL" || row.action === action) && `${row.actor} ${row.action} ${row.entityType}`.toLowerCase().includes(query.toLowerCase()));
  return <div className="space-y-4"><div className="flex flex-col gap-3 sm:flex-row"><Input aria-label="Search activity" placeholder="Search activity…" value={query} onChange={(event) => setQuery(event.target.value)} className="sm:max-w-sm" /><select aria-label="Filter by action" className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={action} onChange={(event) => setAction(event.target.value)}><option value="ALL">All actions</option>{actions.map((item) => <option key={item} value={item}>{item.toLowerCase().replaceAll("_", " ")}</option>)}</select></div><div className="overflow-x-auto rounded-lg border"><table className="w-full min-w-[42rem] text-sm"><caption className="sr-only">Group activity log</caption><thead className="border-b bg-muted/50"><tr><th scope="col" className="px-4 py-3 text-left">Actor</th><th scope="col" className="px-4 py-3 text-left">Action</th><th scope="col" className="px-4 py-3 text-left">Entity</th><th scope="col" className="px-4 py-3 text-left">Time</th></tr></thead><tbody>{filtered.length ? filtered.map((row) => <tr key={row.id} className="border-b last:border-0"><td className="px-4 py-3 font-medium">{row.actor}</td><td className="px-4 py-3">{row.action.toLowerCase().replaceAll("_", " ")}</td><td className="px-4 py-3 text-muted-foreground">{row.entityType}</td><td className="px-4 py-3 text-muted-foreground"><time dateTime={new Date(row.timestamp).toISOString()}>{row.occurredAt}</time></td></tr>) : <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">No activity matches these filters.</td></tr>}</tbody></table></div></div>;
}
