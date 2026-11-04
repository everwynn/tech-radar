export function formatRelative(iso: string | null, now = new Date()): string {
  if (!iso) return '—';
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return '—';
  const days = Math.floor((now.getTime() - then.getTime()) / 86_400_000);
  if (days <= 0) return '今天';
  if (days === 1) return '昨天';
  if (days < 7) return `${days} 天前`;
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    month: '2-digit',
    day: '2-digit',
  }).format(then).replace(/\//g, '-');
}

export function formatAbsolute(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

// EOL 只展示到「天」：版本雷达的决策粒度是月，不需要精确到小时。
export function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const date = new Date(`${iso}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date).replace(/\//g, '-');
}

export function eolLabel(eol: { state: string; date: string | null; daysLeft: number | null }): string {
  if (eol.state === 'unknown') return '—';
  if (eol.state === 'eol') return '已停止支持';
  if (!eol.date) return '支持中';
  if (eol.daysLeft !== null && eol.daysLeft <= 180) return `${eol.daysLeft} 天后到期`;
  return formatDate(eol.date);
}
