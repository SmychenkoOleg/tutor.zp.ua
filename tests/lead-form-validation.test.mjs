import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  nameHasOnlyAllowedCharacters,
  digitsOfUkrainianPhone,
  formatUkrainianPhone,
  validateLeadField,
  validateLeadForm,
} from "../app/leadFormValidation.ts";

const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");

test("full name is exactly two letter-only words, including Ukrainian letters", () => {
  assert.equal(nameHasOnlyAllowedCharacters("Ізольда Пампушенко"), true);
  assert.equal(nameHasOnlyAllowedCharacters("Єва Їжак"), true);
  for (const input of ["Олена", "Олена 123", "Олена Іваненко3", "Олена-Анна Іваненко", "Олена @Іваненко"]) {
    if (/[^\p{L} ]/u.test(input)) assert.equal(nameHasOnlyAllowedCharacters(input), false);
    assert.ok(validateLeadField("name", input).length > 0);
  }
  assert.equal(validateLeadField("name", "Ізольда Пампушенко"), "");
  assert.equal(validateLeadField("name", "Єва Їжак"), "");
  assert.match(validateLeadField("name", "Ізольда Пампушенко Графиня"), /два слова/);
  assert.match(validateLeadField("name", ""), /прізвище/);
  assert.notEqual(validateLeadField("name", "А".repeat(51) + " Тест"), "");
});

test("phone shows a local mask, accepts pasted country prefix and checks UA mobile codes", () => {
  assert.equal(digitsOfUkrainianPhone("+380931234567"), "0931234567");
  assert.equal(formatUkrainianPhone("0931234567"), "(093) 123-45-67");
  assert.equal(formatUkrainianPhone("+380 (93) 123-45-67"), "(093) 123-45-67");
  assert.equal(formatUkrainianPhone("093"), "(093)");
  assert.equal(formatUkrainianPhone(""), "");
  for (const value of ["0931234567", "(093) 123-45-67", "+380931234567", "0501234567"]) {
    assert.equal(validateLeadField("phone", value), "");
  }
  for (const invalid of ["0121234567", "093123456", "09312345678", "abc", ""]) {
    assert.match(validateLeadField("phone", invalid), /український номер/);
  }
});

test("email and complete form errors are checked independently", () => {
  assert.equal(validateLeadField("email", "parent@example.com"), "");
  assert.match(validateLeadField("email", "user at example"), /e-mail/);
  const valid = { name: "Ізольда Пампушенко", phone: "(093) 123-45-67", email: "parent@example.com" };
  assert.deepEqual(validateLeadForm(valid), {});
  const invalid = validateLeadForm({ ...valid, name: "Ізольда", email: "oops" });
  assert.ok(invalid.name);
  assert.ok(invalid.email);
  assert.equal(invalid.phone, undefined);
});

test("all form entry points share the updated modal field hints and browser alerts are removed", () => {
  const page = read("app/page.tsx");
  assert.match(page, /placeholder="Ізольда Пампушенко"/);
  assert.match(page, /placeholder="\((?:Х){3}\) YYY-YY-YY"/);
  assert.match(page, /Вкажіть ваше ім'я та прізвище/);
  assert.match(page, /Вкажіть дійсний український номер/);
  assert.match(page, /Вкажіть дійсний e-mail/);
  assert.match(page, /onBlur=\{\(\) => onFieldBlur\("name"\)\}/);
  assert.match(page, /onBlur=\{\(\) => onFieldBlur\("phone"\)\}/);
  assert.match(page, /onBlur=\{\(\) => onFieldBlur\("email"\)\}/);
  assert.match(page, /validateLeadForm\(\{ name, phone, email \}\)/);
  assert.match(page, /aria-describedby="name-hint"/);
  assert.match(page, /aria-describedby="phone-hint"/);
  assert.match(page, /aria-describedby="email-hint"/);
  assert.match(page, /setPhone\(formatUkrainianPhone\(value\)\)/);
  assert.doesNotMatch(page, /window\.alert\(/);
  assert.equal((page.match(/<form onSubmit=\{submit\}/g) ?? []).length, 1);
  assert.match(page, /const openForm = \(key: keyof typeof ctas\)/);
});

test("warning appears centered and dismisses on next click/tap anywhere, including outside modal", () => {
  const page = read("app/page.tsx");
  const css = read("app/globals.css");
  assert.match(page, /className="validation-notice" role="alert"/);
  assert.match(page, /className="validation-notice-content"/);
  assert.match(page, /document\.addEventListener\("pointerdown", dismiss\)/);
  assert.match(page, /document\.removeEventListener\("pointerdown", dismiss\)/);
  assert.match(page, /if \(event\.key === "Escape"\) dismiss\(\)/);
  assert.match(css, /\.validation-notice \{\s*position:fixed; inset:0; z-index:20020; display:grid; place-items:center;/);
  assert.match(css, /pointer-events:none;/);
  assert.match(css, /\.field-hint \{ display:block/);
});

test("white contrast stroke surrounds the Smart Sticky CTA only in mobile CSS", () => {
  const css = read("app/globals.css");
  assert.match(css, /@media \(max-width:820px\)/);
  assert.match(css, /border:2px solid #fff; border-radius:13px; min-height:50px; background:var\(--blue\)/);
  assert.match(css, /\.mobile-contact\.is-visible/);
  assert.match(css, /body\.cookie-banner-open \.mobile-contact/);
});
