const WORK_ITEM_KEYWORDS = /\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?|implement(?:ed|s)?)\b\s*:?[ \t]+((?:[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)?#\d+)/gi;
const SUPERSESSION_LINE = /^\s*supersedes?\s*:\s*(.*)$/i;

function fail(message) {
  throw new Error(`PR reconciliation: ${message}`);
}

function assertRepository(repository) {
  if (typeof repository !== 'string' || !/^[^/\s#]+\/[^/\s#]+$/.test(repository)) {
    fail('repository must be owner/name');
  }
  return repository;
}

function canonicalWorkItem(repository, rawRef) {
  const local = rawRef.match(/^#(\d+)$/);
  if (local) return `${repository}#${Number(local[1])}`;

  const qualified = rawRef.match(/^([^/\s#]+\/[^/\s#]+)#(\d+)$/);
  if (!qualified) return null;
  if (qualified[1] !== repository) return null;
  return `${repository}#${Number(qualified[2])}`;
}

function workItemNumber(ref) {
  return Number(ref.slice(ref.lastIndexOf('#') + 1));
}

function openPullRequests(pullRequests) {
  if (!Array.isArray(pullRequests)) fail('pullRequests must be an array');
  return pullRequests.filter((pr) => pr && pr.state === 'open' && Number.isInteger(pr.number) && pr.number > 0);
}

function pullRequestWorkItems(repository, pr) {
  if (Array.isArray(pr.work_items)) {
    return [...new Set(pr.work_items.filter((ref) => typeof ref === 'string' && ref.startsWith(`${repository}#`)))];
  }
  return extractPullRequestWorkItems({ repository, body: pr.body ?? '' });
}

export function extractPullRequestWorkItems({ repository, body }) {
  const checkedRepository = assertRepository(repository);
  if (typeof body !== 'string') fail('PR body must be a string');

  const refs = new Set();
  for (const match of body.matchAll(WORK_ITEM_KEYWORDS)) {
    const canonical = canonicalWorkItem(checkedRepository, match[1]);
    if (canonical) refs.add(canonical);
  }
  return [...refs].sort((left, right) => workItemNumber(left) - workItemNumber(right) || left.localeCompare(right));
}

export function extractSupersededPullRequests(body) {
  if (typeof body !== 'string') fail('PR body must be a string');
  const numbers = new Set();
  for (const line of body.split(/\r?\n/)) {
    const match = line.match(SUPERSESSION_LINE);
    if (!match) continue;
    for (const ref of match[1].matchAll(/#(\d+)/g)) numbers.add(Number(ref[1]));
  }
  return [...numbers].sort((left, right) => left - right);
}

export function analyzeOpenPullRequests({ repository, pullRequests }) {
  const checkedRepository = assertRepository(repository);
  const open = openPullRequests(pullRequests);
  const groups = new Map();

  for (const pr of open) {
    for (const workItem of pullRequestWorkItems(checkedRepository, pr)) {
      const numbers = groups.get(workItem) ?? [];
      numbers.push(pr.number);
      groups.set(workItem, numbers);
    }
  }

  const duplicateWorkItems = [...groups.entries()]
    .filter(([, numbers]) => numbers.length > 1)
    .map(([work_item, numbers]) => ({ work_item, pr_numbers: [...numbers].sort((a, b) => a - b) }))
    .sort((left, right) => left.work_item.localeCompare(right.work_item));

  const openNumbers = new Set(open.map((pr) => pr.number));
  const unreconciledSupersessions = [];
  for (const replacement of open) {
    for (const superseded of extractSupersededPullRequests(replacement.body ?? '')) {
      if (superseded !== replacement.number && openNumbers.has(superseded)) {
        unreconciledSupersessions.push({ replacement_pr: replacement.number, superseded_pr: superseded });
      }
    }
  }
  unreconciledSupersessions.sort((left, right) => left.replacement_pr - right.replacement_pr || left.superseded_pr - right.superseded_pr);

  return {
    duplicate_work_items: duplicateWorkItems,
    unreconciled_supersessions: unreconciledSupersessions,
  };
}

export function decidePullRequestPlan({ workItem, openPullRequests: pullRequests }) {
  if (typeof workItem !== 'string') fail('workItem must be a canonical repository#issue reference');
  const match = workItem.match(/^([^/\s#]+\/[^/\s#]+)#(\d+)$/);
  if (!match) fail('workItem must be a canonical repository#issue reference');
  const repository = match[1];
  const canonical = `${repository}#${Number(match[2])}`;

  const matching = openPullRequests(pullRequests)
    .filter((pr) => pullRequestWorkItems(repository, pr).includes(canonical))
    .sort((left, right) => left.number - right.number);

  if (matching.length > 1) {
    return {
      action: 'reconcile_duplicate_prs',
      current_pr: null,
      duplicate_prs: matching.map((pr) => pr.number),
      new_pr_allowed: false,
      target_writes_allowed: false,
    };
  }
  if (matching.length === 1) {
    return {
      action: 'reuse_existing_pr',
      current_pr: `${repository}#${matching[0].number}`,
      duplicate_prs: [],
      new_pr_allowed: false,
      target_writes_allowed: true,
    };
  }
  return {
    action: 'create_new_pr',
    current_pr: null,
    duplicate_prs: [],
    new_pr_allowed: true,
    target_writes_allowed: true,
  };
}
