'use client';

import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  ShieldAlert,
} from 'lucide-react';
import type { ScanMacosApplicationsResult } from '../../../../lib/bridge';
import { useI18n } from '../../../../lib/i18n';

export type SystemAppsScanPhase = 'idle' | 'scanning' | 'success' | 'error' | 'permission';

interface SystemAppsScanBannerProps {
  phase: SystemAppsScanPhase;
  snapshot: ScanMacosApplicationsResult | null;
  errorMessage: string | null;
  lastScannedAt: number | null;
  appCount: number;
}

export function deriveSystemAppsScanPhase(params: {
  scanning: boolean;
  snapshot: ScanMacosApplicationsResult | null;
  errorMessage: string | null;
}): SystemAppsScanPhase {
  if (params.scanning) return 'scanning';
  if (params.errorMessage) {
    const lower = params.errorMessage.toLowerCase();
    if (
      lower.includes('permission denied') ||
      lower.includes('full disk access') ||
      lower.includes('eacces') ||
      lower.includes('not authorized')
    ) {
      return 'permission';
    }
    return 'error';
  }
  if (params.snapshot) return 'success';
  return 'idle';
}

export function SystemAppsScanBanner({
  phase,
  snapshot,
  errorMessage,
  lastScannedAt,
  appCount,
}: SystemAppsScanBannerProps) {
  const { t } = useI18n();
  const copy = t.integrations.systemInstalledApps;
  const warnings = snapshot?.warnings ?? [];
  const scannedPaths = snapshot?.scannedPaths ?? [];

  if (phase === 'idle') return null;

  if (phase === 'scanning') {
    return (
      <div
        className="flex items-center gap-2 border border-cyan-400/25 bg-cyan-950/25 px-3 py-2 text-xs text-cyan-100/90"
        role="status"
        aria-live="polite"
      >
        <Loader2 size={14} className="animate-spin shrink-0" />
        {copy.scanning}
      </div>
    );
  }

  if (phase === 'success') {
    return (
      <div
        className="flex flex-wrap items-center gap-x-2 gap-y-1 border border-emerald-400/25 bg-emerald-950/25 px-3 py-2 text-xs text-emerald-100/90"
        role="status"
        aria-live="polite"
      >
        <CheckCircle2 size={14} className="shrink-0 text-emerald-300" />
        <span>
          {copy.scanSuccess.replace('{count}', String(appCount))}
          {lastScannedAt ? ` · ${new Date(lastScannedAt).toLocaleTimeString()}` : ''}
        </span>
        {scannedPaths.length > 0 && (
          <span className="text-stone-400">
            {copy.scannedPaths}: {scannedPaths.join(' · ')}
          </span>
        )}
        {warnings.length > 0 && (
          <span className="text-amber-200/90">
            {copy.partialWarnings.replace('{count}', String(warnings.length))}
          </span>
        )}
      </div>
    );
  }

  if (phase === 'permission') {
    return (
      <div
        className="space-y-2 border border-amber-400/30 bg-amber-950/25 px-3 py-2 text-xs text-amber-100/95"
        role="alert"
      >
        <div className="flex items-start gap-2">
          <ShieldAlert size={14} className="mt-0.5 shrink-0 text-amber-300" />
          <div>
            <p className="font-medium text-amber-50">{copy.permissionTitle}</p>
            <p className="mt-1 text-amber-100/90">{errorMessage ?? copy.permissionBody}</p>
            <ol className="mt-2 list-decimal space-y-1 pl-4 text-amber-100/85">
              <li>{copy.permissionStep1}</li>
              <li>{copy.permissionStep2}</li>
              <li>{copy.permissionStep3}</li>
            </ol>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex items-start gap-2 border border-red-400/30 bg-red-950/25 px-3 py-2 text-xs text-red-100/95"
      role="alert"
    >
      <AlertCircle size={14} className="mt-0.5 shrink-0 text-red-300" />
      <div>
        <p className="font-medium text-red-50">{copy.scanFailed}</p>
        <p className="mt-1">{errorMessage ?? copy.scanFailedHint}</p>
      </div>
    </div>
  );
}
