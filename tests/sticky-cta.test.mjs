import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { shouldShowStickyCta } from "../app/stickyCtaVisibility.ts";

const page = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

for (const width of [390, 430, 820]) {
  test(`Sticky CTA at ${width}px: hidden first screen, visible during gaps, hidden near another CTA`, () => {
    const viewportHeight = 844;
    const args = { viewportWidth: width, viewportHeight };
    assert.equal(shouldShowStickyCta({ ...args, scrollY: 0, otherCtaVisible: false }), false);
    assert.equal(shouldShowStickyCta({ ...args, scrollY: 500, otherCtaVisible: false }), false);
    assert.equal(shouldShowStickyCta({ ...args, scrollY: 800, otherCtaVisible: false }), true);
    assert.equal(shouldShowStickyCta({ ...args, scrollY: 800, otherCtaVisible: true }), false);
    assert.equal(shouldShowStickyCta({ ...args, scrollY: 800, otherCtaVisible: false }), true);
  });
}

test("CTA never floats beyond the mobile breakpoint or too early in small-height screens", () => {
  assert.equal(shouldShowStickyCta({viewportWidth: 821, viewportHeight: 844, scrollY: 1200, otherCtaVisible: false}), false);
  assert.equal(shouldShowStickyCta({viewportWidth: 320, viewportHeight: 420, scrollY: 150, otherCtaVisible: false}), false);
  assert.equal(shouldShowStickyCta({viewportWidth: 320, viewportHeight: 420, scrollY: 400, otherCtaVisible: false}), true);
});

test("all seven in-page lead CTAs are observed, excluding sticky button and form submit", () => {
  assert.equal((page.match(/data-form-cta\b/g) ?? []).length, 8); // 7 JSX markers + query selector.
  assert.match(page, /querySelectorAll<HTMLButtonElement>\("button\[data-form-cta\]"\)/);
  assert.match(page, /IntersectionObserver\(/);
  assert.match(page, /rootMargin: "0px 0px 96px 0px"/);
  assert.match(page, /threshold: 0/);
  assert.match(page, /entry\.isIntersecting\)/);
  assert.doesNotMatch(page, /intersectionRatio >= 0\.5/);
  assert.match(page, /observer\.disconnect\(\)/);
});

test("mobile CTA does not conflict with menu, modal, or cookie consent", () => {
  assert.match(page, /stickyCtaVisible && !menuOpen && !modalOpen/);
  assert.match(page, /tabIndex=\{stickyCtaVisible && !menuOpen && !modalOpen \? 0 : -1\}/);
  assert.match(css, /\.mobile-contact\.is-visible \{ opacity:1; visibility:visible; pointer-events:auto/);
  assert.match(css, /body\.cookie-banner-open \.mobile-contact \{ opacity:0; visibility:hidden; pointer-events:none/);
  assert.match(css, /@media \(max-width:820px\)/);
  assert.match(css, /@media \(prefers-reduced-motion:reduce\)/);
});
