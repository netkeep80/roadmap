#!/usr/bin/env node
import fs from 'node:fs/promises';
import process from 'node:process';

import { parseProtocolBlock } from './agent-protocol.mjs';
import { validateCheckpointEventEvidence as validateBaseCheckpointEventEvidence } from './agent-evidence-integrity.mjs';
import {
  ACCEPTANCE_VALIDATION_ATTESTATION_START,
  renderAcceptanceValidationAttestation,
} from './acceptance-validation-attestation.mjs';
import { listOpenControlIssues } from './validate-agents.mjs';

const REGISTRY_PATH = new URL('../data/portfolio.json', import.meta.url);

function fail(message) {
  throw new Error(`acceptance validation event: ${message}`);
}

function touchesAcceptanceValidationAttestation(body) {
  return typeof body === 'string' && body.includes(ACCEPTANCE_VALIDATION_ATTESTATION_START);
}

function assertAcceptanceValidationAttestationAppendOnly(event) {
  if (!event?.comment) return;
  if (event.action === 'deleted' && touchesAcceptanceValidationAttestation(event.comment.body)) {
    fail('acceptance validation attestation is append-only authority evidence and cannot be deleted');
  }
  if (event.action === 'edited') {
    const previousBody = event.changes?.body?.from;
    if (touchesAcceptanceValidationAttestation(event.comment.body) || touchesAcceptanceValidationAttestation(previousBody)) {
      fail('acceptance validation attestation is append-only authority evidence and cannot be edited in place');
    }
  }
}

export async function validateAcceptanceValidationEventEvidence(args = {}) {
  const { event } = args;
  if (!event || typeof event !== 'object') fail('GitHub event payload is required');

  assertAcceptanceValidationAttestationAppendOnly(event);

  if (event.action === 'created' && touchesAcceptanceValidationAttestation(event.comment?.body)) {
    return { checked: false, unique_commit_evidence: 0 };
  }

  const result = await validateBaseCheckpointEventEvidence(args);
  if (!result.acceptance_checked || event.action !== 'created') return result;

  const checkpoint = parseProtocolBlock(event.comment?.body ?? '');
  if (checkpoint?.acceptance?.decision !== 'accepted') return result;

  return {
    ...result,
    acceptance_validation_attestation_body: renderAcceptanceValidationAttestation({
      acceptanceSession: event.issue,
      acceptanceComment: event.comment,
      acceptance: checkpoint.acceptance,
    }),
  };
}

async function main() {
  if (!process.argv.includes('--validate-event')) fail('expected --validate-event');
  if (!process.env.GITHUB_EVENT_PATH) fail('GITHUB_EVENT_PATH is required');

  const [registry, event] = await Promise.all([
    fs.readFile(REGISTRY_PATH, 'utf8').then(JSON.parse),
    fs.readFile(process.env.GITHUB_EVENT_PATH, 'utf8').then(JSON.parse),
  ]);
  const result = await validateAcceptanceValidationEventEvidence({
    event,
    registry,
    resolveOpenControlIssues: () => listOpenControlIssues(registry.owner, registry.control_repository ?? 'roadmap'),
  });

  if (result.acceptance_validation_attestation_body) {
    if (!process.env.GITHUB_OUTPUT) fail('GITHUB_OUTPUT is required to publish acceptance validation attestation output');
    const encoded = Buffer.from(result.acceptance_validation_attestation_body, 'utf8').toString('base64');
    await fs.appendFile(process.env.GITHUB_OUTPUT, `acceptance_validation_attestation_body_b64=${encoded}\n`, 'utf8');
  }

  console.log(`acceptance validation event evidence ok: checked=${result.checked}, acceptance_checked=${result.acceptance_checked === true}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(`ERROR: ${error.stack || error.message || String(error)}`);
    process.exitCode = 1;
  });
}
