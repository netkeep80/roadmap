import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const workflowUrl = new URL('../.github/workflows/agent-evidence-events.yml', import.meta.url);

async function workflow() {
  return readFile(workflowUrl, 'utf8');
}

test('evidence event workflow routes issue-comment deletion through fail-closed validation', async () => {
  const text = await workflow();
  assert.match(text, /github\.event\.action == 'deleted'/);
  assert.match(text, /node scripts\/agent-evidence-integrity\.mjs --validate-event/);
});

test('edited comments and Sessions inspect the previous body marker', async () => {
  const text = await workflow();
  const previousBodyMarkerChecks = text.match(/contains\(github\.event\.changes\.body\.from \|\| '', '<!-- roadmap-agent:start -->'\)/g) ?? [];
  assert.ok(previousBodyMarkerChecks.length >= 2);
  assert.match(text, /github\.event_name == 'issue_comment'[\s\S]*github\.event\.action == 'edited'[\s\S]*changes\.body\.from/);
  assert.match(text, /github\.event_name == 'issues'[\s\S]*changes\.body\.from/);
});

test('evidence workflow publishes only successful validation attestations and no worker status', async () => {
  const text = await workflow();
  assert.match(text, /Publish successful candidate validation attestation/);
  assert.match(text, /validation_attestation_body_b64/);
  assert.doesNotMatch(text, /sync-agent-status|worker state|Agent Status Issue|--validate-live/);
});

test('evidence workflow fetches only its bounded runtime inputs', async () => {
  const text = await workflow();
  assert.match(text, /scripts\/agent-protocol\.mjs/);
  assert.match(text, /scripts\/validate-agents\.mjs/);
  assert.match(text, /scripts\/agent-evidence-integrity\.mjs/);
  assert.match(text, /data\/portfolio\.json/);
  assert.doesNotMatch(text, /worker-runtime|worker-policy|agent-status\.mjs|worker-slot/);
});
