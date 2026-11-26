const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ts = require('typescript');

function loadStorageHygiene() {
  const filePath = path.resolve(__dirname, '../src/lib/storage-hygiene.ts');
  const source = fs.readFileSync(filePath, 'utf8');
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
  });

  const mod = { exports: {} };
  vm.runInNewContext(transpiled.outputText, {
    module: mod,
    exports: mod.exports,
    URL,
    RegExp,
    Set,
    Array,
    Math,
    Number,
    Promise,
    Error,
    decodeURIComponent,
  });

  return mod.exports;
}

const {
  extractStoragePathFromUrl,
  buildAvatarCleanupPaths,
  computeResizedDimensions,
} = loadStorageHygiene();

console.log('Running storage-hygiene unit tests...');

// 1. Signed URL extraction (with token query and encoded spaces)
{
  const url =
    'https://ngtjhwswbbivqajtpjvg.supabase.co/storage/v1/object/sign/contracts/rh-aditivos/production/emp%201_12345.pdf?token=abc.def.ghi#page=1';
  assert.strictEqual(
    extractStoragePathFromUrl(url),
    'rh-aditivos/production/emp 1_12345.pdf'
  );
}

// 2. Public, authenticated, and raw Storage object URLs
{
  const base = 'https://ngtjhwswbbivqajtpjvg.supabase.co/storage/v1/object';
  assert.strictEqual(
    extractStoragePathFromUrl(`${base}/public/contracts/avatars/production/emp-1.jpg`),
    'avatars/production/emp-1.jpg'
  );
  assert.strictEqual(
    extractStoragePathFromUrl(`${base}/authenticated/contracts/insurances/production/pol-1.pdf?v=2`),
    'insurances/production/pol-1.pdf'
  );
  assert.strictEqual(
    extractStoragePathFromUrl(`${base}/contracts/production/loan-9.pdf`),
    'production/loan-9.pdf'
  );
}

// 3. Relative safe paths accepted for contracts bucket
{
  assert.strictEqual(
    extractStoragePathFromUrl('/rh-aditivos/production/abc.pdf'),
    'rh-aditivos/production/abc.pdf'
  );
  assert.strictEqual(
    extractStoragePathFromUrl('insurances/test/policy.pdf'),
    'insurances/test/policy.pdf'
  );
  assert.strictEqual(
    extractStoragePathFromUrl('avatars/production/user.png'),
    'avatars/production/user.png'
  );
  assert.strictEqual(
    extractStoragePathFromUrl('production/contract.pdf'),
    'production/contract.pdf'
  );
}

// 4. External URLs, wrong bucket, empty inputs, and traversal rejected
{
  assert.strictEqual(
    extractStoragePathFromUrl('https://app.zapsign.com.br/verificador/12345'),
    null
  );
  assert.strictEqual(
    extractStoragePathFromUrl('https://drive.google.com/file/d/abc/view'),
    null
  );
  assert.strictEqual(
    extractStoragePathFromUrl(
      'https://ngtjhwswbbivqajtpjvg.supabase.co/storage/v1/object/public/company-branding/logo.png',
      'contracts'
    ),
    null
  );
  assert.strictEqual(extractStoragePathFromUrl(''), null);
  assert.strictEqual(extractStoragePathFromUrl('   '), null);
  assert.strictEqual(extractStoragePathFromUrl(null), null);
  assert.strictEqual(extractStoragePathFromUrl(undefined), null);
  assert.strictEqual(
    extractStoragePathFromUrl('rh-aditivos/../../secret.pdf'),
    null
  );
  assert.strictEqual(
    extractStoragePathFromUrl(
      'https://ngtjhwswbbivqajtpjvg.supabase.co/storage/v1/object/sign/contracts/avatars/..%2Fsecret.png?token=1'
    ),
    null
  );
  assert.strictEqual(
    extractStoragePathFromUrl('other-folder/file.pdf', 'contracts'),
    null
  );
}

// 5. buildAvatarCleanupPaths deduplication and keepPath protection
{
  const cleanup = buildAvatarCleanupPaths(
    'production',
    'emp-123',
    'avatars/production/emp-123.jpg',
    'https://ngtjhwswbbivqajtpjvg.supabase.co/storage/v1/object/sign/contracts/avatars/production/old_avatar.png?token=xyz'
  );
  assert.ok(!cleanup.includes('avatars/production/emp-123.jpg'));
  assert.ok(cleanup.includes('avatars/production/emp-123.jpeg'));
  assert.ok(cleanup.includes('avatars/production/emp-123.png'));
  assert.ok(cleanup.includes('avatars/production/emp-123.webp'));
  assert.ok(cleanup.includes('avatars/production/old_avatar.png'));

  // Non-avatar URLs must never be added to avatar cleanup list
  const safeCleanup = buildAvatarCleanupPaths(
    'test',
    'emp-123',
    'avatars/test/emp-123.jpg',
    'https://ngtjhwswbbivqajtpjvg.supabase.co/storage/v1/object/sign/contracts/rh-aditivos/test/doc.pdf?token=xyz'
  );
  assert.ok(!safeCleanup.some((p) => p.includes('rh-aditivos')));
  assert.strictEqual(new Set(safeCleanup).size, safeCleanup.length);
}

// 6. computeResizedDimensions scaling and invalid input guards
{
  const toPlain = (v) => JSON.parse(JSON.stringify(v));
  assert.deepStrictEqual(toPlain(computeResizedDimensions(2048, 1024, 512)), {
    width: 512,
    height: 256,
    resized: true,
  });
  assert.deepStrictEqual(toPlain(computeResizedDimensions(1000, 2000, 512)), {
    width: 256,
    height: 512,
    resized: true,
  });
  assert.deepStrictEqual(toPlain(computeResizedDimensions(800, 800, 512)), {
    width: 512,
    height: 512,
    resized: true,
  });
  assert.deepStrictEqual(toPlain(computeResizedDimensions(400, 300, 512)), {
    width: 400,
    height: 300,
    resized: false,
  });
  assert.deepStrictEqual(toPlain(computeResizedDimensions(0, 500, 512)), {
    width: 0,
    height: 0,
    resized: false,
  });
  assert.deepStrictEqual(toPlain(computeResizedDimensions(-100, 500, 512)), {
    width: 0,
    height: 0,
    resized: false,
  });
  assert.deepStrictEqual(toPlain(computeResizedDimensions(NaN, 500, 512)), {
    width: 0,
    height: 0,
    resized: false,
  });
}

console.log('All storage-hygiene unit tests passed!');
