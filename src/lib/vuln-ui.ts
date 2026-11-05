import type { Severity } from './osv';

// 对比面板与项目体检共用的一套严重度文案与色板，避免两处各写一遍中文标签。
export const SEVERITY_TEXT: Record<Severity, string> = {
  CRITICAL: '严重',
  HIGH: '高危',
  MODERATE: '中危',
  LOW: '低危',
  UNKNOWN: '未分级',
};

export const SEVERITY_BORDER: Record<Severity, string> = {
  CRITICAL: 'border-danger',
  HIGH: 'border-danger',
  MODERATE: 'border-warn',
  LOW: 'border-ok',
  UNKNOWN: 'border-line',
};

export const SEVERITY_TONE: Record<Severity, string> = {
  CRITICAL: 'text-danger',
  HIGH: 'text-danger',
  MODERATE: 'text-warn',
  LOW: 'text-ok',
  UNKNOWN: 'text-muted',
};
