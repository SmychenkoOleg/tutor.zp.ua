"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import content from "../content/site.json";
import { shouldShowStickyCta } from "./stickyCtaVisibility";
import { formatUkrainianPhone, nameHasOnlyAllowedCharacters, validateLeadField, validateLeadForm } from "./leadFormValidation";
import type { LeadField, LeadFormErrors } from "./leadFormValidation";
import CookieSettingsTrigger from "./components/CookieSettingsTrigger";

const ctas = content.ctas;

function Icon({ children }: { children: React.ReactNode }) {
  return <span className="icon" aria-hidden="true">{children}</span>;
}

export default function Home() {
  const [modalOpen, setModalOpen] = useState(false);
  const [intent, setIntent] = useState(ctas.hero);
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [errors, setErrors] = useState<LeadFormErrors>({});
  const [warning, setWarning] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const menuToggleRef = useRef<HTMLButtonElement>(null);
  const menuNavRef = useRef<HTMLElement>(null);
  const [stickyCtaVisible, setStickyCtaVisible] = useState(false);

  useEffect(() => {
    document.body.style.overflow = modalOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [modalOpen]);

  useEffect(() => {
    const targets = Array.from(document.querySelectorAll<HTMLButtonElement>("button[data-form-cta]"));
    if (!targets.length || !("IntersectionObserver" in window)) return;

    // A CTA must take priority from its very first visible pixel. Extend the
    // bottom detection boundary 96px beyond the viewport so the sticky button
    // is removed BEFORE an approaching in-page CTA reaches its occupied area.
    const visible = new Map<Element, boolean>();
    const initialized = new Set<Element>();
    const updateVisibility = () => {
      if (initialized.size !== targets.length) return;
      setStickyCtaVisible(shouldShowStickyCta({
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        scrollY: window.scrollY,
        otherCtaVisible: Array.from(visible.values()).some(Boolean),
      }));
    };
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        initialized.add(entry.target);
        visible.set(entry.target, entry.isIntersecting);
      }
      updateVisibility();
    }, {
      rootMargin: "0px 0px 96px 0px",
      threshold: 0,
    });

    for (const target of targets) observer.observe(target);
    window.addEventListener("scroll", updateVisibility, { passive: true });
    window.addEventListener("resize", updateVisibility);
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", updateVisibility);
      window.removeEventListener("resize", updateVisibility);
    };
  }, []);

  useEffect(() => {
    if (!menuOpen) return;

    const closeOutside = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (menuToggleRef.current?.contains(target) || menuNavRef.current?.contains(target)) return;
      setMenuOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
        menuToggleRef.current?.focus();
      }
    };

    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [menuOpen]);

  // Centered, non-blocking warnings are dismissed by the next tap anywhere.
  useEffect(() => {
    if (!warning) return;
    const dismiss = () => setWarning("");
    document.addEventListener("pointerdown", dismiss);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") dismiss();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", onKey);
    };
  }, [warning]);

  const closeForm = () => {
    setModalOpen(false);
    setWarning("");
  };

  const openForm = (key: keyof typeof ctas) => {
    setIntent(ctas[key]);
    setModalOpen(true);
    setMenuOpen(false);
    setStatus("idle");
    setWarning("");
    setErrors({});
  };

  const onPhone = (value: string) => {
    setPhone(formatUkrainianPhone(value));
    setErrors((prev) => ({ ...prev, phone: undefined }));
  };

  const onName = (value: string) => {
    if (value.length > 101 || !nameHasOnlyAllowedCharacters(value)) {
      setWarning("Для імені та прізвища використовуйте тільки літери й один пробіл між словами.");
      return;
    }
    setName(value.replace(/ {2,}/g, " "));
    setErrors((prev) => ({ ...prev, name: undefined }));
  };

  const onFieldBlur = (field: LeadField) => {
    const values = { name, phone, email };
    const value = values[field];
    // Don't warn while the visitor has not entered anything yet.
    if (!value.trim()) return;
    const error = validateLeadField(field, value);
    setErrors((prev) => ({ ...prev, [field]: error || undefined }));
    if (error) setWarning(error);
  };

  const validate = () => {
    const next = validateLeadForm({ name, phone, email });
    setErrors(next);
    const first = next.name || next.phone || next.email;
    if (first) setWarning(first);
    return !first;
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!validate()) return;
    setStatus("sending");
    try {
      const response = await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), phone, email: email.trim(), intent, website: "" }),
      });
      if (!response.ok) throw new Error("submit failed");
      setStatus("success");
      setName(""); setPhone(""); setEmail("");
    } catch {
      setStatus("error");
      setWarning("Не вдалося надіслати запит. Спробуйте ще раз або зателефонуйте нам.");
    }
  };

  return (
    <>
      <header className="site-header">
        <a className="brand" href="#top" aria-label="MathLab — на початок">
          <span className="brand-mark">π</span>
          <span>Math<span>Lab</span></span>
        </a>
        <button ref={menuToggleRef} type="button" className="menu-button" onClick={() => setMenuOpen((open) => !open)} aria-controls="home-mobile-navigation" aria-expanded={menuOpen} aria-label={menuOpen ? "Закрити меню" : "Відкрити меню"}>
          <span /><span /><span />
        </button>
        <nav ref={menuNavRef} id="home-mobile-navigation" className={menuOpen ? "nav open" : "nav"} aria-label="Основна навігація">
          <a href="#programs" onClick={() => setMenuOpen(false)}>{content.navigation.programs}</a>
          <a href="#approach" onClick={() => setMenuOpen(false)}>{content.navigation.approach}</a>
          <a href="#tutor" onClick={() => setMenuOpen(false)}>{content.navigation.tutor}</a>
          <a href="#results" onClick={() => setMenuOpen(false)}>{content.navigation.results}</a>
          <a href="#faq" onClick={() => setMenuOpen(false)}>{content.navigation.faq}</a>
          <CookieSettingsTrigger className="nav-cookie-settings" onActivate={() => setMenuOpen(false)} />
        </nav>
        <a className="header-phone" href={content.contact.phoneHref}>{content.contact.phone}</a>
        <button className="button button-small" onClick={() => openForm("hero")}>Консультація</button>
      </header>

      <main id="top">
        <section className="hero section">
          <div className="math-scribble scribble-one">x² + y²</div>
          <div className="hero-copy">
            <div className="eyebrow"><span>●</span> {content.hero.eyebrow}</div>
            <h1>{content.hero.headline}<br /><em>{content.hero.emphasis}</em></h1>
            <p className="hero-lead">{content.hero.description}</p>
            <div className="hero-actions">
              <button data-form-cta className="button button-primary" onClick={() => openForm("hero")}>Записатися на консультацію <span>→</span></button>
              <a className="text-link" href={content.contact.phoneHref}>або зателефонувати</a>
            </div>
            <div className="trust-row">
              {content.hero.stats.map((stat) => <div key={stat.label}><strong>{stat.value}</strong><span>{stat.label}</span></div>)}
            </div>
          </div>
          <div className="hero-visual">
            <div className="image-card">
              <img src={content.images.hero.src} alt={content.images.hero.alt} width="900" height="760" fetchPriority="high" />
            </div>
            <div className="float-card float-top"><Icon>✓</Icon><span><strong>Чіткий план</strong> до результату</span></div>
            <div className="float-card float-bottom"><strong>НМТ 2026</strong><span>Підготовка без стресу</span></div>
          </div>
        </section>

        <section id="programs" className="section programs">
          <div className="section-heading">
            <div><span className="kicker">{content.programs.label}</span><h2>{content.programs.headline} <em>{content.programs.emphasis}</em></h2></div>
            <p>{content.programs.description}</p>
          </div>
          <div className="program-grid">
            {content.programs.items.map((program) => (
              <article key={program.id} className={`program-card ${program.theme}`}>
                <Icon>{program.icon}</Icon><span className="tag">{program.tag}</span>
                <h3>{program.title}</h3>
                <p>{program.description}</p>
                <ul>{program.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}</ul>
              </article>
            ))}
          </div>
          <div className="center-cta"><button data-form-cta className="button button-primary" onClick={() => openForm("programs")}>Підібрати програму навчання <span>→</span></button></div>
        </section>

        <section id="approach" className="section split-section">
          <div className="section-image">
            <img src={content.images.approach.src} alt={content.images.approach.alt} width="900" height="760" loading="lazy" />
            <div className="image-note"><strong>{content.approach.imageNoteTitle}</strong><span>{content.approach.imageNoteDescription}</span></div>
          </div>
          <div className="split-copy">
            <span className="kicker">{content.approach.label}</span>
            <h2>{content.approach.headline} <em>{content.approach.emphasis}</em></h2>
            <p>{content.approach.description}</p>
            <ol className="steps">
              {content.approach.steps.map((step, index) => (
                <li key={step.title}><span>{String(index + 1).padStart(2, "0")}</span><div><strong>{step.title}</strong><p>{step.description}</p></div></li>
              ))}
            </ol>
            <button data-form-cta className="button button-dark" onClick={() => openForm("approach")}>Обговорити цілі учня <span>→</span></button>
          </div>
        </section>

        <section id="tutor" className="section tutor-section">
          <div className="tutor-intro">
            <span className="kicker light">{content.tutor.label}</span>
            <h2>{content.tutor.headline} <em>{content.tutor.emphasis}</em></h2>
            <p>{content.tutor.description}</p>
            <button data-form-cta className="button button-light" onClick={() => openForm("tutor")}>Домовитися про знайомство <span>→</span></button>
          </div>
          <div className="credential-grid">
            {content.tutor.credentials.map((credential) => (
              <article key={credential.title}><Icon>{credential.icon}</Icon><h3>{credential.title}</h3><p>{credential.description}</p></article>
            ))}
          </div>
        </section>

        <section id="results" className="section results">
          <div className="section-heading">
            <div><span className="kicker">{content.results.label}</span><h2>{content.results.headline} <em>{content.results.emphasis}</em></h2></div>
            <p>{content.results.description}</p>
          </div>
          <div className="result-layout">
            <div className="result-list">
              {content.results.items.map((result) => (
                <article key={result.title}><Icon>✓</Icon><div><h3>{result.title}</h3><p>{result.description}</p></div></article>
              ))}
            </div>
            <div className="result-image"><img src={content.images.results.src} alt={content.images.results.alt} width="900" height="760" loading="lazy" /></div>
          </div>
          <div className="center-cta"><button data-form-cta className="button button-primary" onClick={() => openForm("results")}>Почати підготовку до НМТ <span>→</span></button></div>
        </section>

        <section className="section final-cta">
          <div><span className="kicker light">{content.finalCta.label}</span><h2>{content.finalCta.headline}</h2><p>{content.finalCta.description}</p></div>
          <div className="final-actions"><button data-form-cta className="button button-yellow" onClick={() => openForm("hero")}>Отримати консультацію <span>→</span></button><a href={content.contact.phoneHref}>{content.contact.phone}</a></div>
        </section>

        <section id="faq" className="section faq">
          <div className="section-heading"><div><span className="kicker">{content.faq.label}</span><h2>{content.faq.headline} <em>{content.faq.emphasis}</em></h2></div></div>
          <div className="faq-list">
            {content.faq.items.map((faq) => (
              <details key={faq.question}><summary>{faq.question}<span>+</span></summary><p>{faq.answer}</p></details>
            ))}
          </div>
          <div className="center-cta"><button data-form-cta className="button button-dark" onClick={() => openForm("faq")}>Поставити своє запитання <span>→</span></button></div>
        </section>
      </main>

      <footer>
        <a className="brand footer-brand" href="#top"><span className="brand-mark">π</span><span>Math<span>Lab</span></span></a>
        <p>{content.footer.tagline}</p>
        <div><a href={content.contact.phoneHref}>{content.contact.phone}</a><a href={`mailto:${content.contact.email}`}>{content.contact.email}</a></div>
        <CookieSettingsTrigger className="footer-cookie-settings" />
        <small>© 2026 MathLab. <a href="/privacy-policy">Політика конфіденційності</a></small>
      </footer>

      {modalOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) closeForm(); }}>
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="lead-title">
            <button className="modal-close" onClick={closeForm} aria-label="Закрити форму">×</button>
            {status === "success" ? (
              <div className="success-message"><Icon>✓</Icon><h2>Дякуємо!</h2><p>Запит отримано. Викладач зв’яжеться з вами найближчим часом.</p><button className="button button-primary" onClick={closeForm}>Готово</button></div>
            ) : (
              <>
                <span className="kicker">Безкоштовна консультація</span>
                <h2 id="lead-title">{intent}</h2>
                <p>Залиште контакти — обговоримо рівень учня, мету та зручний формат занять.</p>
                <form onSubmit={submit} noValidate>
                  <label>Ім’я та прізвище
                    <input value={name} onChange={(e) => onName(e.target.value)} onBlur={() => onFieldBlur("name")} placeholder="Ізольда Пампушенко" autoComplete="name" maxLength={101} aria-invalid={!!errors.name} aria-describedby="name-hint" required />
                    <span id="name-hint" className="field-hint">Вкажіть ваше ім'я та прізвище</span>
                  </label>
                  <label>Номер телефону
                    <input type="tel" value={phone} onChange={(e) => onPhone(e.target.value)} onBlur={() => onFieldBlur("phone")} placeholder="(ХХХ) YYY-YY-YY" inputMode="tel" autoComplete="tel" aria-invalid={!!errors.phone} aria-describedby="phone-hint" required />
                    <span id="phone-hint" className="field-hint">Вкажіть дійсний український номер</span>
                  </label>
                  <label>E-mail
                    <input type="email" value={email} onChange={(e) => { setEmail(e.target.value); setErrors((p) => ({ ...p, email: undefined })); }} onBlur={() => onFieldBlur("email")} placeholder="name@example.com" autoComplete="email" maxLength={254} aria-invalid={!!errors.email} aria-describedby="email-hint" required />
                    <span id="email-hint" className="field-hint">Вкажіть дійсний e-mail</span>
                  </label>
                  <input type="text" name="website" tabIndex={-1} autoComplete="off" className="honeypot" aria-hidden="true" />
                  {status === "error" && <div className="form-error">Не вдалося надіслати запит. Зателефонуйте нам: <a href={content.contact.phoneHref}>{content.contact.phone}</a>.</div>}
                  <button className="button button-primary submit-button" disabled={status === "sending"}>{status === "sending" ? "Надсилаємо…" : "Надіслати запит →"}</button>
                  <small>Натискаючи кнопку, ви погоджуєтеся на обробку даних відповідно до <a href="/privacy-policy" target="_blank" rel="noreferrer">Політики конфіденційності</a>.</small>
                </form>
              </>
            )}
          </div>
        </div>
      )}
      {warning && (
        <div className="validation-notice" role="alert" aria-live="assertive">
          <div className="validation-notice-content">
            <strong>Перевірте введені дані</strong>
            <p>{warning}</p>
            <small>Натисніть будь-де, щоб закрити повідомлення</small>
          </div>
        </div>
      )}
      <button
        type="button"
        className={`mobile-contact${stickyCtaVisible && !menuOpen && !modalOpen ? " is-visible" : ""}`}
        aria-hidden={!(stickyCtaVisible && !menuOpen && !modalOpen)}
        tabIndex={stickyCtaVisible && !menuOpen && !modalOpen ? 0 : -1}
        onClick={() => openForm("hero")}
      >Записатися на консультацію</button>
    </>
  );
}
