import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const content = JSON.parse(readFileSync(new URL('../content/site.json', import.meta.url), 'utf8'));

function nonempty(value, label) {
  assert.equal(typeof value, 'string', `${label} must be a string`);
  assert.ok(value.trim(), `${label} must not be empty`);
}

test('editable content contains required site settings', () => {
  for (const field of ['title', 'description', 'openGraphTitle', 'openGraphDescription', 'siteName']) {
    nonempty(content.seo[field], `seo.${field}`);
  }
  for (const section of ['hero', 'programs', 'approach', 'tutor', 'results', 'faq', 'finalCta', 'footer']) {
    assert.ok(content[section] && typeof content[section] === 'object', `${section} is required`);
  }
  nonempty(content.contact.phone, 'contact.phone');
  assert.match(content.contact.phoneHref, /^tel:\+\d{10,15}$/);
  assert.match(content.contact.email, /^[^\s@]+@[^\s@]+\.[^\s@]+$/);
  for (const key of ['hero', 'programs', 'approach', 'tutor', 'results', 'faq']) {
    nonempty(content.ctas[key], `ctas.${key}`);
  }
});

test('editable repeatable sections have valid stable keys', () => {
  assert.ok(content.programs.items.length > 0, 'at least one program');
  assert.equal(new Set(content.programs.items.map((item) => item.id)).size, content.programs.items.length);
  for (const item of content.programs.items) {
    nonempty(item.id, 'program id');
    assert.match(item.id, /^[a-z0-9-]+$/);
    assert.ok(['blue', 'yellow', 'coral'].includes(item.theme));
    nonempty(item.title, 'program title');
    assert.ok(Array.isArray(item.bullets), 'program bullets');
  }
  for (const section of ['stats', 'steps', 'credentials', 'items']) {
    const obj = section === 'stats' ? content.hero : section === 'steps' ? content.approach : section === 'credentials' ? content.tutor : content.faq;
    assert.ok(Array.isArray(obj[section]), `${section} must be an array`);
  }
  for (const question of content.faq.items) {
    nonempty(question.question, 'FAQ question');
    nonempty(question.answer, 'FAQ answer');
  }
});

test('images use local public paths and have alt text', () => {
  for (const key of ['hero', 'approach', 'results']) {
    assert.match(content.images[key].src, /^\/images\/[a-zA-Z0-9/_-]+\.(?:png|jpe?g|webp|svg)$/);
    nonempty(content.images[key].alt, `images.${key}.alt`);
  }
});

test('FAQ callback invitation matches its contact-only form and remains editable in CMS', () => {
  const page = readFileSync(new URL('../app/page.tsx', import.meta.url), 'utf8');
  const cms = readFileSync(new URL('../.pages.yml', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');
  assert.equal(content.faq.ctaHeading, 'Залишилися запитання?');
  assert.equal(content.faq.ctaButton, 'Зв’яжіться зі мною');
  assert.equal(content.ctas.faq, 'Залиште контакти для зворотного зв’язку');
  assert.match(content.faq.ctaDescription, /Залиште свої контакти/);
  assert.match(page, /<h3>\{content\.faq\.ctaHeading\}<\/h3>/);
  assert.match(page, /<p>\{content\.faq\.ctaDescription\}<\/p>/);
  assert.match(page, /<button data-form-cta className="button button-dark" onClick=\{\(\) => openForm\("faq"\)\}>/);
  assert.match(page, /\{content\.faq\.ctaButton\}/);
  assert.doesNotMatch(page, /Поставити своє запитання/);
  for (const field of ['ctaHeading','ctaDescription','ctaButton']) {
    assert.ok(cms.includes('name: ' + field), 'CMS does not expose ' + field);
  }
  assert.match(css, /\.faq-follow-up \{/);
  assert.match(page, /setIntent\(ctas\[key\]\)/);
});
