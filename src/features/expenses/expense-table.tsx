"use client";

import { createColumnHelper, flexRender, getCoreRowModel, getFilteredRowModel, getSortedRowModel, type SortingState, useReactTable } from "@tanstack/react-table";
import Link from "next/link";
import { useMemo, useState } from "react";

import { Input } from "@/components/ui/input";

export type ExpenseRow = { id: string; description: string; date: string; dateSort: number; paidBy: string; amount: string; amountMinor: string };
const column = createColumnHelper<ExpenseRow>();

export function ExpenseTable({ groupId, rows }: { groupId: string; rows: ExpenseRow[] }) {
  const [sorting, setSorting] = useState<SortingState>([{ id: "date", desc: true }]);
  const [filter, setFilter] = useState("");
  const columns = useMemo(() => [
    column.accessor("description", { header: "Expense", cell: (info) => <Link className="font-medium hover:underline focus-visible:ring-2" href={`/groups/${groupId}/expenses/${info.row.original.id}`}>{info.getValue()}</Link> }),
    column.accessor("dateSort", { id: "date", header: "Date", cell: (info) => info.row.original.date }),
    column.accessor("paidBy", { header: "Paid by" }),
    column.accessor("amountMinor", { header: "Amount", sortingFn: (a, b) => { const left = BigInt(a.original.amountMinor); const right = BigInt(b.original.amountMinor); return left < right ? -1 : left > right ? 1 : 0; }, cell: (info) => <span className="block text-right font-medium tabular-nums">{info.row.original.amount}</span> }),
  ], [groupId]);
  // TanStack Table intentionally returns callable table state; React Compiler skips this component.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({ data: rows, columns, state: { sorting, globalFilter: filter }, onSortingChange: setSorting, onGlobalFilterChange: setFilter, getCoreRowModel: getCoreRowModel(), getFilteredRowModel: getFilteredRowModel(), getSortedRowModel: getSortedRowModel() });
  return <div className="space-y-3"><Input aria-label="Filter expenses" placeholder="Filter expenses…" value={filter} onChange={(event) => setFilter(event.target.value)} className="max-w-sm" /><div className="overflow-x-auto rounded-lg border"><table className="w-full min-w-[36rem] text-sm"><caption className="sr-only">Group expenses</caption><thead className="border-b bg-muted/50">{table.getHeaderGroups().map((group) => <tr key={group.id}>{group.headers.map((header) => <th key={header.id} scope="col" className={`px-4 py-3 text-left font-medium ${header.id === "amountMinor" ? "text-right" : ""}`}><button type="button" className="inline-flex items-center gap-1 hover:text-foreground" onClick={header.column.getToggleSortingHandler()}>{flexRender(header.column.columnDef.header, header.getContext())}{header.column.getIsSorted() === "asc" ? " ↑" : header.column.getIsSorted() === "desc" ? " ↓" : ""}</button></th>)}</tr>)}</thead><tbody>{table.getRowModel().rows.length ? table.getRowModel().rows.map((row) => <tr key={row.id} className="border-b last:border-0 hover:bg-muted/40">{row.getVisibleCells().map((cell) => <td key={cell.id} className="px-4 py-3">{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>)}</tr>) : <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">No expenses match this filter.</td></tr>}</tbody></table></div></div>;
}
