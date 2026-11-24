import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {
  PermissionsEngine,
  classifyCommandPermission,
  resolveConfinedPath,
} from './permissions';

test('resolveConfinedPath enforces strict directory boundary and blocks traversal', () => {
  const base = path.resolve('/tmp/workspace-test');
  const inside = resolveConfinedPath('src/index.ts', base, [base]);
  assert.equal(inside.ok, true);
  if (inside.ok) {
    assert.equal(inside.resolvedPath, path.join(base, 'src', 'index.ts'));
  }

  const traversal = resolveConfinedPath('../../etc/passwd', base, [base]);
  assert.equal(traversal.ok, false);

  // Prefix sibling attack (/tmp/workspace-test-evil must NOT match /tmp/workspace-test)
  const sibling = resolveConfinedPath('../workspace-test-evil/secret.txt', base, [base]);
  assert.equal(sibling.ok, false);
});

test('classifyCommandPermission separates install, git, and destructive commands', () => {
  assert.equal(classifyCommandPermission('npm install zod').permission, 'install_dependencies');
  assert.equal(classifyCommandPermission('pip install requests').permission, 'install_dependencies');
  assert.equal(classifyCommandPermission('git status').permission, 'git_access');
  assert.equal(classifyCommandPermission('git status').isSensitive, false);
  assert.equal(classifyCommandPermission('git commit -m "fix"').isSensitive, true);
  assert.equal(classifyCommandPermission('rm -rf /tmp/foo').isDestructive, true);
});

test('PermissionsEngine blocks denied actions and gates ask actions with one-time/session tokens', () => {
  const engine = new PermissionsEngine('/tmp/project', null);

  // Default: files_read is allow, files_write is ask
  const readRes = engine.authorize({
    permission: 'files_read',
    action: 'read_file',
    target: 'README.md',
    summary: 'Lire README.md',
  });
  assert.equal(readRes.allowed, true);

  const writeAsk = engine.authorize({
    permission: 'files_write',
    action: 'write_file',
    target: 'notes.md',
    summary: 'Écrire notes.md',
    isSensitive: true,
  });
  assert.equal(writeAsk.allowed, false);
  assert.equal(writeAsk.code, 'APPROVAL_REQUIRED');
  assert.ok(writeAsk.approval?.id);

  // Approve once -> token works exactly once for that target
  const resolved = engine.resolveApproval(writeAsk.approval!.id, 'approved-once');
  assert.ok(resolved?.token);

  const writeWithToken = engine.authorize({
    permission: 'files_write',
    action: 'write_file',
    target: 'notes.md',
    summary: 'Écrire notes.md',
    approvalToken: resolved!.token,
  });
  assert.equal(writeWithToken.allowed, true);

  // Replay of same one-time token fails
  const replay = engine.authorize({
    permission: 'files_write',
    action: 'write_file',
    target: 'notes.md',
    summary: 'Écrire notes.md',
    approvalToken: resolved!.token,
  });
  assert.equal(replay.allowed, false);
  assert.equal(replay.code, 'APPROVAL_REQUIRED');

  // Deny policy blocks unconditionally
  engine.updatePolicy({ permissions: { terminal_exec: 'deny' } });
  const denied = engine.authorize({
    permission: 'terminal_exec',
    action: 'run_command',
    target: 'ls',
    summary: 'ls',
  });
  assert.equal(denied.allowed, false);
  assert.equal(denied.code, 'PERMISSION_DENIED');
});
