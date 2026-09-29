import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:net';

async function freePort() {
  const server = createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
}

async function startServer(port, dataDir, envOverrides = {}) {
  const child = spawn(process.execPath, ['dist/server.cjs'], {
    cwd: process.cwd(), env: { ...process.env, PORT: String(port), NVF_DATA_DIR: dataDir, NODE_ENV: 'production', NVF_LOCAL_ONLY: '1', ...envOverrides }, stdio: 'ignore'
  });
  for (let i = 0; i < 200; i++) {
    if (child.exitCode !== null) throw new Error(`Server stopped with ${child.exitCode}`);
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/auth/status`);
      if (response.ok) return child;
    } catch (_) {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  child.kill();
  throw new Error('Server did not start');
}

test('family sessions, shared records, offline rejection and durable storage', async () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'nvf-test-'));
  const port = await freePort();
  const base = `http://127.0.0.1:${port}`;
  let server;
  const request = async (path, options = {}) => {
    const response = await fetch(base + path, options);
    return { status: response.status, body: await response.json() };
  };
  const post = (path, body, token) => request(path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: token } : {}) }, body: JSON.stringify(body) });
  try {
    server = await startServer(port, dataDir);
    assert.equal((await fetch(base + '/api/auth/status', { headers: { Origin: 'https://untrusted.example' } })).status, 403);
    assert.equal((await fetch(base + '/api/auth/status', { headers: { Origin: base } })).status, 200);
    const worker = await (await fetch(base + '/sw.js')).text();
    assert.match(worker, /nvf-shell-[0-9a-f]{12}/);
    assert.match(worker, /\/assets\/IncubatorMod-/);
    assert.doesNotMatch(worker, /__NVF_CACHE_NAME__/);
    assert.equal((await request('/api/data')).status, 401);
    assert.equal((await post('/api/auth/register', { username: 'dad', name: 'Dad', password: 'strong-pass-123' })).status, 200);
    assert.equal((await request('/api/data', { headers: { Authorization: 'dad' } })).status, 401);
    assert.equal((await post('/api/auth/register', { username: 'child', name: 'Child', password: 'strong-pass-456' })).status, 401);

    const dad = await post('/api/auth/login', { username: 'dad', password: 'strong-pass-123' });
    assert.equal(dad.status, 200);
    assert.ok(dad.body.token.length >= 32);
    assert.equal((await request('/api/data', { headers: { Authorization: dad.body.user.id } })).status, 401);
    assert.equal((await post('/api/auth/register', { username: 'child', name: 'Child', password: 'strong-pass-456' }, dad.body.token)).status, 200);
    const child = await post('/api/auth/login', { username: 'child', password: 'strong-pass-456' });
    assert.equal(child.status, 200);

    const flock = await post('/api/flocks', { name: 'Test hens', breed: 'Brahma', quantity: 12, ageWeeks: 2, dateAdded: '2026-09-28' }, dad.body.token);
    assert.equal(flock.status, 200);
    const shared = await request('/api/data', { headers: { Authorization: child.body.token } });
    assert.equal(shared.status, 200);
    assert.ok(shared.body.flocks.some(item => item.name === 'Test hens'));
    assert.equal(shared.body.sessions, undefined);
    assert.equal((await post('/api/sync', { items: [{ id: 'x', endpoint: '/api/unsupported', method: 'POST', body: {} }] }, dad.body.token)).status, 409);

    const file = JSON.parse(readFileSync(join(dataDir, 'db.json'), 'utf8'));
    assert.ok(file.flocks.some(item => item.name === 'Test hens'));
    assert.ok(file.users.every(user => user.passwordHash.startsWith('scrypt:')));

    server.kill();
    await new Promise(resolve => server.once('exit', resolve));
    server = await startServer(port, dataDir);
    const afterRestart = await request('/api/data', { headers: { Authorization: child.body.token } });
    assert.equal(afterRestart.status, 200);
    assert.ok(afterRestart.body.flocks.some(item => item.name === 'Test hens'));
    const removed = await request(`/api/flocks/${flock.body.id}`, { method: 'DELETE', headers: { Authorization: dad.body.token } });
    assert.equal(removed.status, 200);
    server.kill();
    await new Promise(resolve => server.once('exit', resolve));
    server = await startServer(port, dataDir);
    const afterDeleteRestart = await request('/api/data', { headers: { Authorization: dad.body.token } });
    assert.equal(afterDeleteRestart.body.flocks.some(item => item.name === 'Test hens'), false);
    assert.equal((await post('/api/auth/logout', {}, child.body.token)).status, 200);
    assert.equal((await request('/api/data', { headers: { Authorization: child.body.token } })).status, 401);
  } finally {
    server?.kill();
    rmSync(dataDir, { recursive: true, force: true });
  }
});

test('production refuses disposable local storage without explicit local-only mode', async () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'nvf-no-cloud-test-'));
  const port = await freePort();
  const child = spawn(process.execPath, ['dist/server.cjs'], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: String(port), NVF_DATA_DIR: dataDir, NODE_ENV: 'production', NVF_LOCAL_ONLY: '0' },
    stdio: 'ignore'
  });
  try {
    const exitCode = await Promise.race([
      new Promise(resolve => child.once('exit', resolve)),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Production server unexpectedly stayed alive')), 20000))
    ]);
    assert.notEqual(exitCode, 0);
  } finally {
    child.kill();
    rmSync(dataDir, { recursive: true, force: true });
  }
});

test('one-time loopback account recovery keeps existing records and closes after use', async () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'nvf-recovery-test-'));
  const port = await freePort();
  const base = `http://127.0.0.1:${port}`;
  const post = async (path, body, token) => {
    const response = await fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: token } : {}) }, body: JSON.stringify(body) });
    return { status: response.status, body: await response.json() };
  };
  let server;
  const recoveryEnv = { NVF_LOCAL_ACCOUNT_RECOVERY: '1', NVF_HOST: '127.0.0.1' };
  try {
    server = await startServer(port, dataDir);
    assert.equal((await post('/api/auth/register', { username: 'first', name: 'First', password: 'first-pass-123' })).status, 200);
    const first = await post('/api/auth/login', { username: 'first', password: 'first-pass-123' });
    assert.equal(first.status, 200);
    assert.equal((await post('/api/flocks', { name: 'Existing hens', breed: 'Brahma', quantity: 5, ageWeeks: 2, dateAdded: '2026-09-28' }, first.body.token)).status, 200);
    server.kill();
    await new Promise(resolve => server.once('exit', resolve));

    server = await startServer(port, dataDir, recoveryEnv);
    const statusBefore = await (await fetch(base + '/api/auth/status')).json();
    assert.equal(statusBefore.setupRequired, false);
    assert.equal(statusBefore.localRecoveryAllowed, true);
    assert.equal((await post('/api/auth/register', { username: 'recovered', name: 'Recovered', password: 'recovery-pass-123' })).status, 200);
    const statusAfter = await (await fetch(base + '/api/auth/status')).json();
    assert.equal(statusAfter.localRecoveryAllowed, false);
    assert.equal((await post('/api/auth/register', { username: 'extra', name: 'Extra', password: 'extra-pass-123' })).status, 401);
    const recovered = await post('/api/auth/login', { username: 'recovered', password: 'recovery-pass-123' });
    assert.equal(recovered.status, 200);
    const shared = await (await fetch(base + '/api/data', { headers: { Authorization: recovered.body.token } })).json();
    assert.ok(shared.flocks.some(flock => flock.name === 'Existing hens'));

    server.kill();
    await new Promise(resolve => server.once('exit', resolve));
    server = await startServer(port, dataDir, recoveryEnv);
    assert.equal((await (await fetch(base + '/api/auth/status')).json()).localRecoveryAllowed, false);
  } finally {
    server?.kill();
    rmSync(dataDir, { recursive: true, force: true });
  }
});
