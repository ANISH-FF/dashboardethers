"use client";

import { LeadItem } from "@/lib/db";
import { PhoneCall, CalendarCheck, CheckCircle2, TrendingUp, DollarSign } from "lucide-react";

interface AnalyticsProps {
  leads: LeadItem[];
}

export function LeadsAnalytics({ leads }: AnalyticsProps) {
  const total = leads.length;
  const converted = leads.filter((l) => l.status === "Converted").length;
  const inTalks = leads.filter((l) => l.status === "In Talks").length;
  const meetings = leads.filter((l) => l.scheduledMeeting && l.scheduledMeeting.trim().length > 0).length;
  const conversionRate = total > 0 ? Math.round((converted / total) * 100) : 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Total Leads */}
      <div className="card bg-paper-dark border-line/70 p-4 flex flex-col justify-between relative overflow-hidden group hover:border-ink/30 transition-all">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-ink/50">Total Leads</span>
          <div className="p-2 rounded-lg bg-paper border border-line text-ink">
            <PhoneCall className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3">
          <p className="text-2xl font-extrabold text-ink tracking-tight">{total}</p>
          <p className="text-[11px] text-ink/50 mt-1 font-medium">{inTalks} actively in talks</p>
        </div>
        <div className="absolute -right-4 -bottom-4 w-16 h-16 bg-blue-500/5 rounded-full blur-xl group-hover:bg-blue-500/10 transition-all" />
      </div>

      {/* Meetings Scheduled */}
      <div className="card bg-paper-dark border-line/70 p-4 flex flex-col justify-between relative overflow-hidden group hover:border-ink/30 transition-all">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-ink/50">Meetings Scheduled</span>
          <div className="p-2 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400">
            <CalendarCheck className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3">
          <p className="text-2xl font-extrabold text-ink tracking-tight">{meetings}</p>
          <p className="text-[11px] text-purple-400/80 mt-1 font-medium">Demo & closing calls</p>
        </div>
        <div className="absolute -right-4 -bottom-4 w-16 h-16 bg-purple-500/10 rounded-full blur-xl group-hover:bg-purple-500/20 transition-all" />
      </div>

      {/* Converted Leads */}
      <div className="card bg-paper-dark border-line/70 p-4 flex flex-col justify-between relative overflow-hidden group hover:border-ink/30 transition-all">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-ink/50">Converted Brands</span>
          <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
            <CheckCircle2 className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3">
          <p className="text-2xl font-extrabold text-emerald-400 tracking-tight">{converted}</p>
          <p className="text-[11px] text-emerald-500/80 mt-1 font-semibold">{conversionRate}% win rate</p>
        </div>
        <div className="absolute -right-4 -bottom-4 w-16 h-16 bg-emerald-500/10 rounded-full blur-xl group-hover:bg-emerald-500/20 transition-all" />
      </div>

      {/* Lead Velocity */}
      <div className="card bg-paper-dark border-line/70 p-4 flex flex-col justify-between relative overflow-hidden group hover:border-ink/30 transition-all">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-ink/50">Conversion Velocity</span>
          <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
            <TrendingUp className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3">
          <p className="text-2xl font-extrabold text-cyan-400 tracking-tight">3.2 days</p>
          <p className="text-[11px] text-cyan-400/80 mt-1 font-medium">Avg. follow-up response</p>
        </div>
        <div className="absolute -right-4 -bottom-4 w-16 h-16 bg-cyan-500/10 rounded-full blur-xl group-hover:bg-cyan-500/20 transition-all" />
      </div>
    </div>
  );
}
