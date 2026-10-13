"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import navigation from "../../content/site.json";
import CookieSettingsTrigger from "../components/CookieSettingsTrigger";
import styles from "./privacy.module.css";

const sections = [
  { href: "/#programs", label: navigation.navigation.programs },
  { href: "/#approach", label: navigation.navigation.approach },
  { href: "/#tutor", label: navigation.navigation.tutor },
  { href: "/#results", label: navigation.navigation.results },
  { href: "/#faq", label: navigation.navigation.faq },
];

export default function PrivacyMobileMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
        toggleRef.current?.focus();
      }
    };
    const closeOutside = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && !menuRef.current?.contains(target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("keydown", onEscape);
    document.addEventListener("pointerdown", closeOutside);
    return () => {
      document.removeEventListener("keydown", onEscape);
      document.removeEventListener("pointerdown", closeOutside);
    };
  }, [isOpen]);

  return (
    <div ref={menuRef} className={styles.mobileMenu}>
      <button
        ref={toggleRef}
        type="button"
        className={styles.menuButton}
        aria-label={isOpen ? "Закрити меню" : "Відкрити меню"}
        aria-expanded={isOpen}
        aria-controls="privacy-mobile-navigation"
        onClick={() => setIsOpen((open) => !open)}
      >
        <span /><span /><span />
      </button>

      <nav
        id="privacy-mobile-navigation"
        className={styles.mobileNav}
        aria-label="Навігація сайтом"
        hidden={!isOpen}
      >
        <Link href="/" onClick={() => setIsOpen(false)}>Головна</Link>
        {sections.map(({ href, label }) => (
          <Link key={href} href={href} onClick={() => setIsOpen(false)}>
            {label}
          </Link>
        ))}
        <CookieSettingsTrigger
          className={styles.navCookieSettings}
          onActivate={() => setIsOpen(false)}
        />
      </nav>
    </div>
  );
}
