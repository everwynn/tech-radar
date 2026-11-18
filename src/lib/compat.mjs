/** @type {Record<string, string>} */
export const STATUS_LABELS = {
  ok: '可用',
  partial: '有条件可用',
  no: '不兼容',
  unknown: '未核实',
};

/** @type {Record<string, string>} */
export const LEVEL_LABELS = { high: '阻断', medium: '需改配置', low: '提示' };

/** @type {Record<string, number>} */
export const LEVEL_ORDER = { high: 0, medium: 1, low: 2 };

const isNonEmptyString = (value) => typeof value === 'string' && value.trim().length > 0;

// 数据完整性的唯一口径：测试与页面文案都从这里来，避免两处各写一遍。
export function validateCompat(data) {
  const errors = [];
  if (!data || typeof data !== 'object') return ['数据不是对象'];
  if (!isNonEmptyString(data.updatedAt)) errors.push('updatedAt 缺失');
  if (!Array.isArray(data.jdkOptions) || data.jdkOptions.length === 0) {
    errors.push('jdkOptions 为空');
  }

  const lines = Array.isArray(data.bootLines) ? data.bootLines : [];
  if (!lines.length) errors.push('bootLines 为空');
  const lineIds = new Set();
  for (const line of lines) {
    if (!isNonEmptyString(line.id)) {
      errors.push('bootLines 存在缺少 id 的条目');
      continue;
    }
    if (lineIds.has(line.id)) errors.push(`版本线 id 重复：${line.id}`);
    lineIds.add(line.id);
    if (!Number.isInteger(line.jdkMin)) errors.push(`版本线 ${line.id} 的 jdkMin 不是整数`);
    if (!isNonEmptyString(line.eolCycle)) errors.push(`版本线 ${line.id} 缺少 eolCycle`);
  }

  const libraries = Array.isArray(data.libraries) ? data.libraries : [];
  if (!libraries.length) errors.push('libraries 为空');
  const libIds = new Set();
  for (const library of libraries) {
    if (!isNonEmptyString(library.id)) {
      errors.push('libraries 存在缺少 id 的条目');
      continue;
    }
    if (libIds.has(library.id)) errors.push(`库 id 重复：${library.id}`);
    libIds.add(library.id);
    if (!isNonEmptyString(library.name)) errors.push(`库 ${library.id} 缺少 name`);
    if (!isNonEmptyString(library.homepage) || !library.homepage.startsWith('https://')) {
      errors.push(`库 ${library.id} 的 homepage 必须是 https:// 链接`);
    }
    const sources = Array.isArray(library.sources) ? library.sources : [];
    if (!sources.length) errors.push(`库 ${library.id} 的 sources 为空`);
    for (const source of sources) {
      if (!isNonEmptyString(source.url) || !isNonEmptyString(source.checkedAt)) {
        errors.push(`库 ${library.id} 的 source 缺少 url 或 checkedAt`);
      }
    }
    const cells = library.cells && typeof library.cells === 'object' ? library.cells : {};
    for (const lineId of lineIds) {
      const cell = cells[lineId];
      if (!cell) {
        errors.push(`库 ${library.id} 缺少 ${lineId} 的格子`);
        continue;
      }
      if (!(cell.status in STATUS_LABELS)) {
        errors.push(`库 ${library.id} 的 ${lineId} 单元格 status 非法：${cell.status}`);
      }
      if (!isNonEmptyString(cell.detail)) errors.push(`库 ${library.id} 的 ${lineId} 单元格 detail 为空`);
    }
    for (const key of Object.keys(cells)) {
      if (!lineIds.has(key)) errors.push(`库 ${library.id} 存在未知版本线的格子：${key}`);
    }
  }

  const migrations = Array.isArray(data.migrations) ? data.migrations : [];
  for (const migration of migrations) {
    if (!isNonEmptyString(migration.title)) errors.push('迁移警告缺少 title');
    if (!(migration.level in LEVEL_ORDER)) errors.push(`迁移警告等级非法：${migration.title}`);
    if (!isNonEmptyString(migration.detail)) errors.push(`迁移警告 detail 为空：${migration.title}`);
    const applies = Array.isArray(migration.appliesTo) ? migration.appliesTo : [];
    for (const lineId of applies) {
      if (!lineIds.has(lineId)) errors.push(`迁移警告 ${migration.title} 的 appliesTo 引用未知版本线：${lineId}`);
    }
  }

  return errors;
}

// URL 参数还原：非法值静默归 null，页面回到「未选择」状态。
export function parseSelection(search, data) {
  const params = new URLSearchParams(search ?? '');
  const jdk = params.get('jdk');
  const boot = params.get('boot');
  const jdkOptions = Array.isArray(data?.jdkOptions) ? data.jdkOptions : [];
  const lineIds = Array.isArray(data?.bootLines) ? data.bootLines.map((line) => line.id) : [];
  return {
    jdk: jdk && jdkOptions.includes(jdk) ? jdk : null,
    boot: boot && lineIds.includes(boot) ? boot : null,
  };
}

// 参数顺序固定为 jdk → boot，保证同一选择生成的链接唯一。
export function buildSearch(selection) {
  const params = new URLSearchParams();
  if (selection?.jdk) params.set('jdk', selection.jdk);
  if (selection?.boot) params.set('boot', selection.boot);
  const search = params.toString();
  return search ? `?${search}` : '';
}

// 第一版只校验 JDK 下限：低于下限才是硬冲突，过新 JDK 不在判定范围。
export function jdkConflict(line, jdk) {
  if (jdk == null || jdk === '') return null;
  const value = Number(jdk);
  if (!Number.isFinite(value)) return null;
  if (Number.isInteger(line?.jdkMin) && value < line.jdkMin) return `需要 JDK ${line.jdkMin}+`;
  return null;
}

export function migrationMatches(migration, bootId) {
  if (!bootId) return true;
  return Array.isArray(migration?.appliesTo) && migration.appliesTo.includes(bootId);
}

export function sortMigrations(list) {
  return [...(list ?? [])].sort(
    (a, b) => (LEVEL_ORDER[a?.level] ?? 9) - (LEVEL_ORDER[b?.level] ?? 9),
  );
}
