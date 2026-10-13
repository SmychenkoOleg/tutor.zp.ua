"use client";

import { OPEN_COOKIE_SETTINGS_EVENT } from "./cookieSettingsEvent";

type Props = {
  className?: string;
  onActivate?: () => void;
};

/** Reopens the global CookieConsent dialog without duplicating consent state. */
export default function CookieSettingsTrigger({ className, onActivate }: Props) {
  const openSettings = () => {
    onActivate?.();
    window.dispatchEvent(new Event(OPEN_COOKIE_SETTINGS_EVENT));
  };

  return (
    <button type="button" className={className} onClick={openSettings}>
      Налаштування cookies
    </button>
  );
}
