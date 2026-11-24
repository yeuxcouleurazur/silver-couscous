import test from 'node:test';
import assert from 'node:assert/strict';
import { extractReadableTextFromHtml, validatePublicUrl } from './webTools';

test('validatePublicUrl accepts public https/http URLs and blocks loopback/private/metadata', () => {
  assert.equal(validatePublicUrl('https://developer.mozilla.org/fr/').ok, true);
  assert.equal(validatePublicUrl('http://example.com/docs').ok, true);

  assert.equal(validatePublicUrl('http://localhost:3000').ok, false);
  assert.equal(validatePublicUrl('http://127.0.0.1:8787').ok, false);
  assert.equal(validatePublicUrl('http://169.254.169.254/latest/meta-data/').ok, false);
  assert.equal(validatePublicUrl('http://192.168.1.1/admin').ok, false);
  assert.equal(validatePublicUrl('http://10.0.0.5/internal').ok, false);
  assert.equal(validatePublicUrl('file:///etc/passwd').ok, false);
  assert.equal(validatePublicUrl('javascript:alert(1)').ok, false);
});

test('extractReadableTextFromHtml strips scripts/styles and extracts title', () => {
  const html = `
    <html>
      <head><title>Guide &amp; Docs</title><style>body{color:red}</style></head>
      <body>
        <h1>Bonjour</h1>
        <script>alert('xss')</script>
        <p>Contenu utile ici.</p>
      </body>
    </html>
  `;
  const result = extractReadableTextFromHtml(html);
  assert.equal(result.title, 'Guide & Docs');
  assert.match(result.text, /Bonjour/);
  assert.match(result.text, /Contenu utile ici/);
  assert.doesNotMatch(result.text, /alert/);
  assert.doesNotMatch(result.text, /color:red/);
});
