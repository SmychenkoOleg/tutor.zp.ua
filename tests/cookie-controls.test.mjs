import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");

test("mobile cookie preferences are in navigation and both page footers", () => {
  const home = read("app/page.tsx");
  const privacy = read("app/privacy-policy/page.tsx");
  const css = read("app/globals.css");
  const privacyCss = read("app/privacy-policy/privacy.module.css");

  assert.match(home, /CookieSettingsTrigger className="nav-cookie-settings"/);
  assert.match(home, /CookieSettingsTrigger className="footer-cookie-settings"/);
  assert.match(privacy, /CookieSettingsTrigger className=\{styles.cookieSettingsButton\}/);
  assert.match(css, /@media \(max-width:820px\)/);
  assert.match(css, /\.nav-cookie-settings\s*\{\s*display:inline-flex/);
  assert.match(css, /\.footer-cookie-settings\s*\{\s*display:inline-flex/);
  assert.match(privacyCss, /@media \(max-width: 820px\)/);
});

test("CTA is hidden during consent and floating cookie button hidden on mobile", () => {
  const css = read("app/globals.css");
  const moduleCss = read("app/components/CookieConsent.module.css");
  const consent = read("app/components/CookieConsent.tsx");
  assert.match(css, /body\.cookie-banner-open \.mobile-contact\s*\{ display:none; \}/);
  assert.match(consent, /choice === null \|\| settingsOpen/);
  assert.match(consent, /classList\.toggle\("cookie-banner-open", bannerOpen\)/);
  assert.match(moduleCss, /@media \(max-width: 820px\)\s*\{\s*\.settingsButton\s*\{ display: none; \}/);
});

test("cookie control opens the existing consent component, not a duplicate state", () => {
  const control = read("app/components/CookieSettingsTrigger.tsx");
  const consent = read("app/components/CookieConsent.tsx");
  const event = read("app/components/cookieSettingsEvent.ts");
  assert.match(control, /dispatchEvent\(new Event\(OPEN_COOKIE_SETTINGS_EVENT\)\)/);
  assert.match(consent, /addEventListener\(OPEN_COOKIE_SETTINGS_EVENT, openPreferences\)/);
  assert.match(consent, /removeEventListener\(OPEN_COOKIE_SETTINGS_EVENT, openPreferences\)/);
  assert.match(event, /mathlab:open-cookie-settings/);
});

test("privacy policy offers navigable mobile menu back to home sections and cookies", () => {
  const privacy = read("app/privacy-policy/page.tsx");
  const menu = read("app/privacy-policy/PrivacyMobileMenu.tsx");
  const css = read("app/privacy-policy/privacy.module.css");
  assert.match(privacy, /<PrivacyMobileMenu \/>/);
  assert.match(menu, /href="\/" onClick/);
  for (const section of ["programs", "approach", "tutor", "results", "faq"]) {
    assert.ok(menu.includes(`href: "/#${section}"`), `Missing home anchor ${section}`);
  }
  assert.match(menu, /CookieSettingsTrigger/);
  assert.match(menu, /aria-expanded=\{isOpen\}/);
  assert.match(menu, /hidden=\{!isOpen\}/);
  assert.match(menu, /event.key === "Escape"/);
  assert.match(css, /\.mobileNav\[hidden\] \{ display: none; \}/);
  assert.match(css, /@media \(max-width: 820px\)/);
});
