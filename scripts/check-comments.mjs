import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { parse } from 'parse5';
import { tokenizer } from 'acorn';
import { Parser as YamlParser } from 'yaml';

function javascriptComments(source) {
  const lines = [];
  const tokens = tokenizer(source, {
    ecmaVersion: 'latest',
    locations: true,
    onComment: (_block, _text, _start, _end, location) => {
      if (!(location.line === 1 && source.startsWith('#!'))) lines.push(location.line);
    },
  });
  while (tokens.getToken().type.label !== 'eof') {}
  return lines;
}

function cssComments(source) {
  const lines = [];
  let quote = '';
  let line = 1;
  for (let i = 0; i < source.length;) {
    const char = source[i];
    if (char === '\n') line++;
    if (quote) {
      if (char === '\\') { i += 2; continue; }
      if (char === quote) quote = '';
    } else if (char === '"' || char === "'") {
      quote = char;
    } else if (source.startsWith('/*', i)) {
      lines.push(line);
      const end = source.indexOf('*/', i + 2);
      const next = end < 0 ? source.length : end + 2;
      line += source.slice(i, next).split('\n').length - 1;
      i = next;
      continue;
    }
    i++;
  }
  return lines;
}

function htmlComments(source) {
  const lines = [];
  function visit(node) {
    if (node.nodeName === '#comment') lines.push(node.sourceCodeLocation.startLine);
    if (node.nodeName === 'script' || node.nodeName === 'style') {
      const content = node.childNodes?.find(child => child.nodeName === '#text');
      if (content) {
        const scan = node.nodeName === 'script' ? javascriptComments : cssComments;
        lines.push(...scan(content.value).map(line => content.sourceCodeLocation.startLine + line - 1));
      }
    }
    for (const child of node.childNodes || []) visit(child);
  }
  visit(parse(source, { sourceCodeLocationInfo: true }));
  return lines;
}

function yamlComments(source) {
  const lines = [];
  function visit(token) {
    if (!token || typeof token !== 'object') return;
    if (token.type === 'comment') lines.push(source.slice(0, token.offset).split('\n').length);
    for (const value of Object.values(token)) {
      if (Array.isArray(value)) value.forEach(visit);
      else if (value && typeof value === 'object') visit(value);
    }
  }
  for (const token of new YamlParser().parse(source)) visit(token);
  return lines;
}

function inspect(file, source) {
  if (/\.(?:html|svg)$/i.test(file)) return htmlComments(source);
  if (/\.(?:js|mjs|cjs)$/i.test(file)) return javascriptComments(source);
  if (/\.css$/i.test(file)) return cssComments(source);
  if (/\.ya?ml$/i.test(file)) return yamlComments(source);
  if (file === '.gitignore' || file === '.gitattributes') {
    return source.split('\n').flatMap((line, index) => line.startsWith('#') ? [index + 1] : []);
  }
  return [];
}

if (process.argv.includes('--self-test')) {
  assert.deepEqual(inspect('x.js', 'const r = /[//]/; const x = `${1 /* why */}`;'), [1]);
  assert.deepEqual(inspect('x.css', 'a{content:"/* literal */"} /* why */'), [1]);
  assert.deepEqual(inspect('x.html', '<p title="<!-- literal -->">x</p>\n<!-- why -->'), [2]);
  assert.deepEqual(inspect('x.yml', 'run: |\n  echo "# literal"\nname: CI # why'), [3]);
  console.log('Comment syntax checks passed.');
} else {
  const files = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean);
  const failures = files.filter(existsSync).flatMap(file => inspect(file, readFileSync(file, 'utf8')).map(line => `${file}:${line}`));
  if (failures.length) {
    console.error(`Comments forbidden (${failures.length}):\n${failures.join('\n')}`);
    process.exitCode = 1;
  } else {
    console.log('Comment ratchet: zero comments in tracked source and config files.');
  }
}
