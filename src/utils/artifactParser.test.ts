import test from 'node:test';
import assert from 'node:assert/strict';
import { extractArtifactsFromMarkdown, stripArtifactTags } from './artifactParser';

test('extractArtifactsFromMarkdown parses explicit artifact tags and strips them cleanly', () => {
  const md = `Voici votre calculatrice :
<artifact title="Calculatrice" type="html" language="html">
<!doctype html>
<html><body><h1>Calc</h1></body></html>
</artifact>`;

  const arts = extractArtifactsFromMarkdown(md);
  assert.equal(arts.length, 1);
  assert.equal(arts[0].title, 'Calculatrice');
  assert.equal(arts[0].type, 'html');
  assert.match(arts[0].content, /<h1>Calc<\/h1>/);

  const clean = stripArtifactTags(md);
  assert.match(clean, /Artifact créé/);
  assert.doesNotMatch(clean, /<artifact/);
});

test('extractArtifactsFromMarkdown detects substantial fenced html/svg blocks', () => {
  const md = `\`\`\`html
<!doctype html>
<html>
  <head><title>Mon Tableau</title></head>
  <body>
    <main>Hello</main>
  </body>
</html>
\`\`\``;
  const arts = extractArtifactsFromMarkdown(md);
  assert.equal(arts.length, 1);
  assert.equal(arts[0].title, 'Mon Tableau');
  assert.equal(arts[0].type, 'html');
});
