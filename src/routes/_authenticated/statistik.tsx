import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Clock, MessagesSquare, TrendingUp, UserRound } from "lucide-react";
import {
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AppShell } from "@/components/app-shell";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { getAdminOverview, getStatistics } from "@/lib/statistics.functions";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/statistik")({
  head: () => ({
    meta: [
      { title: "Statistik Layanan | Purworejo chatbot Apps" },
      { name: "description", content: "Ringkasan percakapan, tren pesan masuk, distribusi kategori pertanyaan, dan kinerja agent layanan Kabupaten Purworejo." },
      { property: "og:title", content: "Statistik Layanan | Purworejo chatbot Apps" },
      { property: "og:description", content: "Dashboard statistik percakapan dan kinerja agent Purworejo chatbot Apps." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: StatistikPage,
});

const PIE_COLORS = ["#2563eb", "#0d9488", "#d97706", "#7c3aed", "#db2777", "#65a30d", "#64748b"];

function formatDuration(seconds: number | null): string {
  if (seconds === null) return "-";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s} dtk`;
  return `${m} mnt ${String(s).padStart(2, "0")} dtk`;
}

function StatistikPage() {
  const fetchStats = useServerFn(getStatistics);
  const { data, isLoading, isError } = useQuery({
    queryKey: ["statistik"],
    queryFn: () => fetchStats(),
  });

  const waiting = data?.waitingAgent ?? 0;
  const summary = [
    {
      label: "Total Percakapan Hari Ini",
      value: String(data?.todayConversations ?? 0),
      icon: MessagesSquare,
      hint: "Dihitung sejak awal hari ini",
    },
    {
      label: "Percakapan Minggu Ini",
      value: String(data?.weekConversations ?? 0),
      icon: TrendingUp,
      hint: "7 hari terakhir",
    },
    {
      label: "Menunggu Agent",
      value: String(waiting),
      icon: UserRound,
      hint: waiting > 0 ? "Perlu tindak lanjut" : "Semua tertangani",
      alert: waiting > 0,
    },
    {
      label: "Rata-rata Waktu Respon Agent",
      value: formatDuration(data?.avgResponseSeconds ?? null),
      icon: Clock,
      hint: data?.avgResponseSeconds == null ? "Belum ada balasan agent" : "Target di bawah 5 menit",
    },
  ];

  const daily = data?.daily ?? [];
  const categories = (data?.categories ?? []).map((c, i) => ({
    ...c,
    color: PIE_COLORS[i % PIE_COLORS.length] as string,
  }));
  const agents = data?.agents ?? [];

  return (
    <AppShell title="Statistik" subtitle="Ringkasan aktivitas layanan 7 hari terakhir">
      <div className="space-y-6">
        {isError ? (
          <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            Data statistik gagal dimuat. Coba muat ulang halaman.
          </p>
        ) : null}

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {summary.map(({ label, value, icon: Icon, hint, alert }) => (
            <Card key={label} className={cn(alert && "border-amber-400 bg-amber-50/60 dark:bg-amber-950/20")}>
              <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
                <CardDescription className="text-xs font-medium uppercase">{label}</CardDescription>
                <Icon className={cn("size-4 shrink-0", alert ? "text-amber-600" : "text-muted-foreground")} />
              </CardHeader>
              <CardContent>
                <p className={cn("text-2xl font-bold", alert && "text-amber-700 dark:text-amber-400")}>
                  {isLoading ? "…" : value}
                </p>
                <p className={cn("mt-1 text-xs", alert ? "text-amber-600" : "text-muted-foreground")}>{hint}</p>
              </CardContent>
            </Card>
          ))}
        </section>

        <section className="grid grid-cols-1 gap-4 xl:grid-cols-5">
          <Card className="xl:col-span-3">
            <CardHeader>
              <CardTitle className="text-base">Pesan Masuk per Hari</CardTitle>
              <CardDescription>7 hari terakhir</CardDescription>
            </CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={daily} margin={{ top: 8, right: 16, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="day" tickLine={false} axisLine={false} fontSize={12} />
                  <YAxis tickLine={false} axisLine={false} fontSize={12} allowDecimals={false} />
                  <Tooltip formatter={(v) => [`${v} pesan`, "Pesan masuk"]} />
                  <Line type="monotone" dataKey="pesan" stroke="#2563eb" strokeWidth={2.5} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="xl:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Kategori Pertanyaan Terbanyak</CardTitle>
              <CardDescription>Berdasarkan jawaban Knowledge Base</CardDescription>
            </CardHeader>
            <CardContent className="h-72">
              {categories.length === 0 ? (
                <div className="flex h-full items-center justify-center text-center text-sm text-muted-foreground">
                  {isLoading ? "Memuat data…" : "Belum ada pertanyaan yang dijawab dari Knowledge Base."}
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={categories} dataKey="value" nameKey="name" innerRadius="45%" outerRadius="70%" paddingAngle={2}>
                      {categories.map((c) => (
                        <Cell key={c.name} fill={c.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v, name) => [`${v} pertanyaan`, name]} />
                    <Legend iconSize={10} wrapperStyle={{ fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </section>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Agent Teraktif</CardTitle>
            <CardDescription>Berdasarkan jumlah balasan yang dikirim agent</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {agents.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground">
                {isLoading ? "Memuat data…" : "Belum ada agent yang membalas percakapan."}
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Agent</TableHead>
                    <TableHead className="w-40">Chat Ditangani</TableHead>
                    <TableHead className="w-48">Rata-rata Respon</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {agents.map((agent, index) => (
                    <TableRow key={agent.name}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="size-8 border border-border">
                            <AvatarFallback className="bg-accent text-[11px] font-bold text-accent-foreground">{agent.initials}</AvatarFallback>
                          </Avatar>
                          <span className="font-medium">{agent.name}</span>
                          {index === 0 ? <Badge className="ml-1">Paling aktif</Badge> : null}
                        </div>
                      </TableCell>
                      <TableCell className="font-semibold">{agent.chats}</TableCell>
                      <TableCell className="text-muted-foreground">{formatDuration(agent.avgResponseSeconds)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
