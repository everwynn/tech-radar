export const GROUPS = new Set(['runtime', 'framework', 'frontend', 'data']);

const isFilled = (value) => typeof value === 'string' && value.trim().length > 0;

function checkSource(item, key, errors, where, type) {
  const source = item[key];
  if (!source) return false;
  if (source.type !== type) {
    errors.push(`${where} ${key}.type 必须为 ${type}`);
    return true;
  }
  if (type === 'npm' && !isFilled(source.package)) errors.push(`${where} ${key} 缺少 package`);
  if (type === 'endoflife' && !isFilled(source.product)) errors.push(`${where} ${key} 缺少 product`);
  if (type === 'github-release') {
    if (!isFilled(source.repo)) errors.push(`${where} ${key} 缺少 repo`);
    if (typeof source.tagPrefix !== 'string') errors.push(`${where} ${key} 缺少 tagPrefix`);
  }
  return true;
}

export function validateStack(items) {
  if (!Array.isArray(items) || items.length === 0) throw new Error('清单不能为空');
  const errors = [];
  const ids = new Set();

  items.forEach((item, index) => {
    const where = `第 ${index + 1} 项${item?.id ? `（${item.id}）` : ''}`;
    if (!item || typeof item !== 'object') {
      errors.push(`${where} 不是对象`);
      return;
    }
    if (!item.id || !/^[a-z0-9-]+$/.test(item.id)) errors.push(`${where} id 非法`);
    else if (ids.has(item.id)) errors.push(`${where} id 重复`);
    else ids.add(item.id);

    if (!isFilled(item.name)) errors.push(`${where} 缺少 name`);
    if (!GROUPS.has(item.group)) errors.push(`${where} group 非法`);
    if (item.homepage && !/^https:\/\//.test(item.homepage)) errors.push(`${where} homepage 必须以 https:// 开头`);

    const hasLifecycle = checkSource(item, 'lifecycle', errors, where, 'endoflife');
    const hasVersions = checkSource(item, 'versions', errors, where, 'npm');
    const hasReleases = checkSource(item, 'releases', errors, where, 'github-release');
    if (!hasLifecycle && !hasVersions && !hasReleases) {
      errors.push(`${where} 至少需要 lifecycle / versions / releases 之一`);
    }

    if (item.osv && (!isFilled(item.osv.ecosystem) || !isFilled(item.osv.package))) {
      errors.push(`${where} osv 配置不完整`);
    }
  });

  if (errors.length) throw new Error(`清单校验失败：\n- ${errors.join('\n- ')}`);
  return items;
}
