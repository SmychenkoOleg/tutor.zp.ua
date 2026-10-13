"use client";

import { useEffect, useState } from "react";
import styles from "./CookieConsent.module.css";
import { OPEN_COOKIE_SETTINGS_EVENT } from "./cookieSettingsEvent";

type ConsentChoice = "accepted" | "rejected";

const STORAGE_KEY = "mathlab_cookie_consent_v1";

function updateGoogleConsent(choice: ConsentChoice) {
  window.dataLayer = window.dataLayer || [];
  window.gtag(
    "consent",
    "update",
    {
      analytics_storage: choice === "accepted" ? "granted" : "denied",
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
      personalization_storage: "denied",
    },
  );
}

function clearAnalyticsCookies() {
  const cookieNames = document.cookie
    .split(";")
    .map((cookie) => cookie.trim().split("=")[0])
    .filter((name) => /^(?:_ga|_gid|_gat|_gcl_)/.test(name));

  const domains = ["", location.hostname, `.${location.hostname}`, ".tutor.zp.ua"];
  for (const name of cookieNames) {
    for (const domain of domains) {
      document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax${domain ? `; Domain=${domain}` : ""}`;
    }
  }
}

declare global {
  interface Window {
    dataLayer: unknown[];
    gtag: (...args: unknown[]) => void;
  }
}

export default function CookieConsent() {
  const [choice, setChoice] = useState<ConsentChoice | null | undefined>(undefined);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    setChoice(saved === "accepted" || saved === "rejected" ? saved : null);
  }, []);

  useEffect(() => {
    const openPreferences = () => setSettingsOpen(true);
    window.addEventListener(OPEN_COOKIE_SETTINGS_EVENT, openPreferences);
    return () => window.removeEventListener(OPEN_COOKIE_SETTINGS_EVENT, openPreferences);
  }, []);

  // Keep the mobile conversion CTA completely clear while consent is required.
  // This also applies when a visitor reopens cookie preferences from the menu.
  const bannerOpen = choice === null || settingsOpen;
  useEffect(() => {
    document.body.classList.toggle("cookie-banner-open", bannerOpen);
    return () => document.body.classList.remove("cookie-banner-open");
  }, [bannerOpen]);

  const saveChoice = (nextChoice: ConsentChoice) => {
    localStorage.setItem(STORAGE_KEY, nextChoice);
    updateGoogleConsent(nextChoice);
    if (nextChoice === "rejected") clearAnalyticsCookies();
    setChoice(nextChoice);
    setSettingsOpen(false);
  };

  if (choice === undefined) return null;

  if (choice && !settingsOpen) {
    return (
      <button className={styles.settingsButton} type="button" onClick={() => setSettingsOpen(true)}>
        Налаштування cookies
      </button>
    );
  }

  return (
    <section className={styles.banner} role="dialog" aria-modal="false" aria-labelledby="cookie-title">
      <div className={styles.copy}>
        <span className={styles.icon} aria-hidden="true">π</span>
        <div>
          <h2 id="cookie-title">Налаштування cookies</h2>
          <p>
            Необхідні технології забезпечують роботу сайту. Аналітичні cookies Google
            допомагають зрозуміти, як користувачі взаємодіють із сайтом, і вмикаються
            лише за вашою згодою. Детальніше — у <a href="/privacy-policy">Політиці конфіденційності</a>.
          </p>
        </div>
      </div>
      <div className={styles.actions}>
        <button className={styles.reject} type="button" onClick={() => saveChoice("rejected")}>
          Відхилити
        </button>
        <button className={styles.accept} type="button" onClick={() => saveChoice("accepted")}>
          Прийняти
        </button>
      </div>
    </section>
  );
}
