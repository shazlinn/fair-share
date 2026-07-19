"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type ChartPoint = { label: string; groupSpend: number; personalShare: number };

export function SpendingCharts({ series }: { series: Array<{ currency: string; points: ChartPoint[] }> }) {
  if (!series.length) return <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">Add an expense to see spending trends.</div>;
  return <div className="space-y-8">{series.map(({ currency, points }) => <section key={currency} aria-label={`${currency} spending chart`}><h3 className="mb-3 text-sm font-medium">{currency} monthly spending</h3><div className="h-72 w-full"><ResponsiveContainer width="100%" height="100%"><BarChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="label" fontSize={12} /><YAxis fontSize={12} /><Tooltip formatter={(value) => [`${currency} ${Number(value).toFixed(2)}`]} /><Legend /><Bar dataKey="groupSpend" name="Group spend" fill="#047857" radius={[4, 4, 0, 0]} /><Bar dataKey="personalShare" name="Your share" fill="#6ee7b7" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div></section>)}</div>;
}
