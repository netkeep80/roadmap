const PROTOCOL = 'roadmap-observer/v1';
const ALLOWED_ROLES = new Set([
  'ci-sentinel',
  'pr-watchdog',
  'dependency-watchdog',
  'portfolio-auditor',
]);
const ALLOWED_STATUSES = new Set(['not-run', 'ok', 'degraded', 'attention']);
const TOP_LEVEL_KEYS = new Set([
  'protocol',
  'role',
  'observed_at',
  'status',
  'items',
  'truncated',
  'total_items',
]);
const ITEM_KEYS = new Set([
  'repository',
  'subject',
  'classification',
  'evidence',
  'needs_reasoning',
]);
const MAX_ITEMS = 100;

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isIsoUtcTimestamp(value) {
  if (typeof value !== 'string') return false;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)) return false;
  return !Number.isNaN(Date.parse(value));
}

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

export function validateObserverSnapshot(snapshot, expectedRole) {
  const errors = [];

  if (!isObject(snapshot)) {
    return { ok: false, errors: ['snapshot must be an object'] };
  }

  for (const key of Object.keys(snapshot)) {
    if (!TOP_LEVEL_KEYS.has(key)) errors.push(`unexpected top-level field: ${key}`);
  }

  if (snapshot.protocol !== PROTOCOL) {
    errors.push(`protocol must be ${PROTOCOL}`);
  }

  if (!ALLOWED_ROLES.has(snapshot.role)) {
    errors.push('role is not an allowed observer role');
  }
  if (snapshot.role !== expectedRole) {
    errors.push(`role must match expected role ${expectedRole}`);
  }

  if (!ALLOWED_STATUSES.has(snapshot.status)) {
    errors.push('status is not allowed');
  }

  if (!Array.isArray(snapshot.items)) {
    errors.push('items must be an array');
  } else {
    if (snapshot.items.length > MAX_ITEMS) {
      errors.push(`items must retain at most ${MAX_ITEMS} entries`);
    }

    snapshot.items.forEach((item, index) => {
      if (!isObject(item)) {
        errors.push(`items[${index}] must be an object`);
        return;
      }
      for (const key of Object.keys(item)) {
        if (!ITEM_KEYS.has(key)) errors.push(`items[${index}] unexpected field: ${key}`);
      }
      if (typeof item.repository !== 'string' || !/^netkeep80\/[A-Za-z0-9_.-]+$/.test(item.repository)) {
        errors.push(`items[${index}].repository must be a canonical netkeep80 repository`);
      }
      if (!nonEmptyString(item.subject)) {
        errors.push(`items[${index}].subject must be a non-empty string`);
      }
      if (!nonEmptyString(item.classification)) {
        errors.push(`items[${index}].classification must be a non-empty string`);
      }
      if (!Array.isArray(item.evidence) || item.evidence.length === 0 || item.evidence.some((entry) => !nonEmptyString(entry))) {
        errors.push(`items[${index}].evidence must be a non-empty string array`);
      }
      if ('needs_reasoning' in item && typeof item.needs_reasoning !== 'boolean') {
        errors.push(`items[${index}].needs_reasoning must be boolean`);
      }
    });
  }

  if (snapshot.status === 'not-run') {
    if (snapshot.observed_at !== null) errors.push('observed_at must be null when status is not-run');
    if (Array.isArray(snapshot.items) && snapshot.items.length !== 0) errors.push('items must be empty when status is not-run');
  } else if (!isIsoUtcTimestamp(snapshot.observed_at)) {
    errors.push('observed_at must be an ISO UTC timestamp');
  }

  if (snapshot.truncated === true) {
    if (!Number.isInteger(snapshot.total_items) || !Array.isArray(snapshot.items) || snapshot.total_items <= snapshot.items.length) {
      errors.push('total_items must be an integer greater than retained items when truncated is true');
    }
  } else {
    if ('truncated' in snapshot && snapshot.truncated !== false) {
      errors.push('truncated must be boolean');
    }
    if ('total_items' in snapshot) {
      errors.push('total_items is only allowed when truncated is true');
    }
  }

  return { ok: errors.length === 0, errors };
}

export const observerSnapshotConstants = Object.freeze({
  protocol: PROTOCOL,
  roles: Object.freeze([...ALLOWED_ROLES]),
  statuses: Object.freeze([...ALLOWED_STATUSES]),
  maxItems: MAX_ITEMS,
});
