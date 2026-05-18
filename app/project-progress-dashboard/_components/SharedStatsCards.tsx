'use client';

import {
  Activity, AlertTriangle, CheckCircle2, Clock, Layers, Rocket, Server, Shield, TestTube2, Zap,
} from 'lucide-react';
import type { Feature, FeaturePhase } from '../../../lib/types';
import {
  computeDevelopmentStats,
  computeTestingStats,
  computeDeploymentStats,
  computeOperationsStats,
} from '../_lib/aggregations';
import { StatCard } from './StatCard';

interface SharedStatsCardsProps {
  phase: FeaturePhase;
  features: Feature[];
  /** When true, renders a tight flex row sized for the header. */
  compact?: boolean;
}

function Container({ compact, children }: { compact: boolean; children: React.ReactNode }) {
  return compact ? (
    <div className="flex flex-wrap items-center justify-end gap-2 flex-none">{children}</div>
  ) : (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 flex-none">{children}</div>
  );
}

export function SharedStatsCards({ phase, features, compact = false }: SharedStatsCardsProps) {
  if (phase === 'development') {
    const s = computeDevelopmentStats(features);
    return (
      <Container compact={compact}>
        <CircularProgressCard percent={s.overallProgress} totalFeatures={s.totalFeatures} compact={compact} />
        <StatCard label="完成 Completed" value={s.completedCount} icon={CheckCircle2}
          bgClass="bg-emerald-500/15" colorClass="text-emerald-300" compact={compact} />
        <StatCard label="進行中 In Progress" value={s.inProgressCount} icon={Clock}
          bgClass="bg-cyan-500/15" colorClass="text-cyan-300" compact={compact} />
        <StatCard label="未開始 Pending" value={s.pendingCount} subValue={`/ ${s.totalPoints} SP`}
          icon={Layers} bgClass="bg-stone-200/10" colorClass="text-stone-200" compact={compact} />
      </Container>
    );
  }
  if (phase === 'e2e_testing') {
    const s = computeTestingStats(features);
    return (
      <Container compact={compact}>
        <StatCard label="平均覆蓋率" value={`${s.avgCoverage}%`} icon={TestTube2}
          bgClass="bg-purple-500/15" colorClass="text-purple-300" compact={compact} />
        <StatCard label="Passed" value={s.passedCount} icon={CheckCircle2}
          bgClass="bg-emerald-500/15" colorClass="text-emerald-300" compact={compact} />
        <StatCard label="Failed" value={s.failedCount} icon={AlertTriangle}
          bgClass="bg-red-500/15" colorClass="text-red-300" compact={compact} />
        <StatCard label="Pending" value={s.pendingCount} icon={Clock}
          bgClass="bg-stone-200/10" colorClass="text-stone-200" compact={compact} />
      </Container>
    );
  }
  if (phase === 'deployment') {
    const s = computeDeploymentStats(features);
    return (
      <Container compact={compact}>
        <StatCard label="Production" value={s.productionCount} icon={Rocket}
          bgClass="bg-emerald-500/15" colorClass="text-emerald-300" compact={compact} />
        <StatCard label="Staging" value={s.stagingCount} icon={Server}
          bgClass="bg-amber-500/15" colorClass="text-amber-300" compact={compact} />
        <StatCard label="未部署" value={s.notDeployedCount} icon={Layers}
          bgClass="bg-stone-200/10" colorClass="text-stone-200" compact={compact} />
        <StatCard label="最近部署日" value={s.latestDeploy} icon={Activity}
          bgClass="bg-cyan-500/15" colorClass="text-cyan-300" compact={compact} />
      </Container>
    );
  }
  const s = computeOperationsStats(features);
  return (
    <Container compact={compact}>
      <StatCard label="平均 Uptime" value={s.avgUptime === '—' ? '—' : `${s.avgUptime}%`} icon={Shield}
        bgClass="bg-emerald-500/15" colorClass="text-emerald-300" compact={compact} />
      <StatCard label="平均錯誤率" value={s.avgErrorRate === '—' ? '—' : `${s.avgErrorRate}%`} icon={AlertTriangle}
        bgClass="bg-red-500/15" colorClass="text-red-300" compact={compact} />
      <StatCard label="平均回應 (ms)" value={s.avgResponseTime} icon={Zap}
        bgClass="bg-cyan-500/15" colorClass="text-cyan-300" compact={compact} />
      <StatCard label="近期事件" value={s.incidentCount} icon={Activity}
        bgClass="bg-amber-500/15" colorClass="text-amber-300" compact={compact} />
    </Container>
  );
}

function CircularProgressCard({
  percent, totalFeatures, compact,
}: { percent: number; totalFeatures: number; compact: boolean }) {
  const size = compact ? 36 : 60;
  return (
    <div className={
      compact
        ? 'flex items-center gap-2 rounded border border-stone-200/15 bg-[#0a2622]/70 px-2 py-1'
        : 'flex items-center gap-4 rounded border border-stone-200/15 bg-[#0a2622]/70 px-4 py-3'
    }>
      <div className="relative" style={{ width: size, height: size }}>
        <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
          <path
            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="4"
          />
          <path
            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            fill="none" stroke="rgb(110, 231, 183)" strokeWidth="4"
            strokeDasharray={`${percent}, 100`}
            style={{ transition: 'stroke-dasharray 800ms ease-out' }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={compact ? 'text-[10px] font-bold text-stone-100' : 'text-sm font-bold text-stone-100'}>
            {percent}%
          </span>
        </div>
      </div>
      <div>
        <p className={compact ? 'text-[10px] uppercase tracking-[0.1em] text-stone-400 leading-tight whitespace-nowrap' : 'text-xs uppercase tracking-[0.12em] text-stone-400'}>
          總體開發進度
        </p>
        <p className={compact ? 'text-[10px] text-stone-400' : 'mt-1 text-xs text-stone-400'}>
          {totalFeatures} Features · Weighted by SP
        </p>
      </div>
    </div>
  );
}
