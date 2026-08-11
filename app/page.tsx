"use client";

import { FormEvent, useEffect, useState } from "react";

const PHONE_CODES = new Set([
  "039", "050", "063", "066", "067", "068", "073", "075", "077", "089",
  "091", "092", "093", "094", "095", "096", "097", "098", "099",
]);

const ctas: Record<string, string> = {
  hero: "Записатися на безкоштовну консультацію",
  programs: "Підібрати програму навчання",
  approach: "Обговорити цілі учня",
  tutor: "Познайомитися з викладачем",
  results: "Почати підготовку до НМТ",
  faq: "Поставити запитання",
};

function formatPhone(value: string) {
  const digits = value.replace(/\D/g, "").replace(/^38/, "").slice(0, 10);
  if (!digits) return "";
  let result = "+38";
  if (digits.length) result += ` (${digits.slice(0, 3)}`;
  if (digits.length >= 3) result += ")";
  if (digits.length > 3) result += ` ${digits.slice(3, 6)}`;
  if (digits.length > 6) result += `-${digits.slice(6, 8)}`;
  if (digits.length > 8) result += `-${digits.slice(8, 10)}`;
  return result;
}

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
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = modalOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [modalOpen]);

  const openForm = (key: keyof typeof ctas) => {
    setIntent(ctas[key]);
    setModalOpen(true);
    setMenuOpen(false);
    setStatus("idle");
  };

  const onPhone = (value: string) => {
    const digits = value.replace(/\D/g, "").replace(/^38/, "").slice(0, 10);
    if (digits.length >= 3 && !PHONE_CODES.has(digits.slice(0, 3))) {
      window.alert("Введіть дійсний український мобільний номер телефону");
      setPhone("");
      return;
    }
    setPhone(formatPhone(digits));
    setErrors((prev) => ({ ...prev, phone: "" }));
  };

  const onName = (value: string) => {
    if (value.length > 101 || /[^\p{L}\s]/u.test(value)) {
      window.alert("Чекаємо Вашого справжнього імені та прізвища буквами!");
      setName("");
      return;
    }
    setName(value.replace(/\s{2,}/g, " "));
    setErrors((prev) => ({ ...prev, name: "" }));
  };

  const validate = () => {
    const next: Record<string, string> = {};
    const words = name.trim().split(/\s+/);
    if (!name.trim()) next.name = "Вкажіть ім’я та прізвище.";
    else if (
      words.length !== 2 ||
      words.some((word) => word.length > 50 || !/^\p{L}+$/u.test(word))
    ) next.name = "Введіть рівно два слова, лише буквами.";

    const digits = phone.replace(/\D/g, "").replace(/^38/, "");
    if (!phone) next.phone = "Вкажіть номер телефону.";
    else if (digits.length !== 10 || !PHONE_CODES.has(digits.slice(0, 3))) {
      next.phone = "Введіть дійсний український мобільний номер.";
    }

    if (!email.trim()) next.email = "Вкажіть e-mail.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(email) || email.length > 254) {
      next.email = "Перевірте правильність e-mail.";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!validate()) {
      window.alert("Будь ласка, заповніть усі поля правильно.");
      return;
    }
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
    }
  };

  return (
    <>
      <header className="site-header">
        <a className="brand" href="#top" aria-label="MathLab — на початок">
          <span className="brand-mark">π</span>
          <span>Math<span>Lab</span></span>
        </a>
        <button className="menu-button" onClick={() => setMenuOpen(!menuOpen)} aria-expanded={menuOpen} aria-label="Відкрити меню">
          <span /><span /><span />
        </button>
        <nav className={menuOpen ? "nav open" : "nav"} aria-label="Основна навігація">
          <a href="#programs" onClick={() => setMenuOpen(false)}>Напрями</a>
          <a href="#approach" onClick={() => setMenuOpen(false)}>Як навчаємось</a>
          <a href="#tutor" onClick={() => setMenuOpen(false)}>Про викладача</a>
          <a href="#results" onClick={() => setMenuOpen(false)}>Результати</a>
          <a href="#faq" onClick={() => setMenuOpen(false)}>FAQ</a>
        </nav>
        <a className="header-phone" href="tel:+380932862886">+380 (93) 286-28-86</a>
        <button className="button button-small" onClick={() => openForm("hero")}>Консультація</button>
      </header>

      <main id="top">
        <section className="hero section">
          <div className="math-scribble scribble-one">x² + y²</div>
          <div className="hero-copy">
            <div className="eyebrow"><span>●</span> Математика без страху й зубріння</div>
            <h1>Зрозуміти математику.<br /><em>Повірити у свої сили.</em></h1>
            <p className="hero-lead">Індивідуальні заняття для учнів 5–12 класів та системна підготовка до НМТ 2026. Складне стає зрозумілим — крок за кроком.</p>
            <div className="hero-actions">
              <button className="button button-primary" onClick={() => openForm("hero")}>Записатися на консультацію <span>→</span></button>
              <a className="text-link" href="tel:+380932862886">або зателефонувати</a>
            </div>
            <div className="trust-row">
              <div><strong>10+</strong><span>років досвіду</span></div>
              <div><strong>5–12</strong><span>класи</span></div>
              <div><strong>100%</strong><span>учнів склали добре+</span></div>
            </div>
          </div>
          <div className="hero-visual">
            <div className="image-card">
              <img src="/images/hero-math.png" alt="Онлайн-заняття з репетитором з математики для учнів 5–12 класів" width="900" height="760" fetchPriority="high" />
            </div>
            <div className="float-card float-top"><Icon>✓</Icon><span><strong>Чіткий план</strong> до результату</span></div>
            <div className="float-card float-bottom"><strong>НМТ 2026</strong><span>Підготовка без стресу</span></div>
          </div>
        </section>

        <section id="programs" className="section programs">
          <div className="section-heading">
            <div><span className="kicker">Напрями навчання</span><h2>Підтягнути оцінку чи скласти НМТ — <em>є чіткий маршрут</em></h2></div>
            <p>Програма будується навколо реального рівня, темпу та мети учня — без зайвого навантаження.</p>
          </div>
          <div className="program-grid">
            <article className="program-card blue">
              <Icon>∑</Icon><span className="tag">5–9 класи</span>
              <h3>Міцна шкільна база</h3>
              <p>Закриваємо прогалини, розбираємо поточні теми, готуємося до контрольних і підвищуємо впевненість.</p>
              <ul><li>Алгебра й геометрія</li><li>Домашні завдання з розумінням</li><li>Систематизація знань</li></ul>
            </article>
            <article className="program-card yellow">
              <Icon>ƒ</Icon><span className="tag">10–11 класи</span>
              <h3>Профільна математика</h3>
              <p>Поглиблюємо знання, вчимося бачити логіку задач і готуємося до наступного освітнього кроку.</p>
              <ul><li>Складні теми простими словами</li><li>Практика різних типів задач</li><li>Власний темп навчання</li></ul>
            </article>
            <article className="program-card coral">
              <Icon>↗</Icon><span className="tag">НМТ 2026</span>
              <h3>Системна підготовка</h3>
              <p>Діагностика, персональний план, практика за форматом тесту та контроль прогресу до самого іспиту.</p>
              <ul><li>Усі теми програми НМТ</li><li>Таймінг і стратегія тесту</li><li>Регулярні пробні варіанти</li></ul>
            </article>
          </div>
          <div className="center-cta"><button className="button button-primary" onClick={() => openForm("programs")}>Підібрати програму навчання <span>→</span></button></div>
        </section>

        <section id="approach" className="section split-section">
          <div className="section-image">
            <img src="/images/learning-process.png" alt="Репетитор з математики пояснює учневі розв’язання геометричної задачі" width="900" height="760" loading="lazy" />
            <div className="image-note"><strong>Не просто відповідь</strong><span>а розуміння логіки рішення</span></div>
          </div>
          <div className="split-copy">
            <span className="kicker">Як проходить навчання</span>
            <h2>Спокійно, послідовно й <em>на зрозумілій мові</em></h2>
            <p>Починаємо з короткої діагностики. Далі формуємо маршрут: від прогалин у базі — до впевненого розв’язання задач потрібного рівня.</p>
            <ol className="steps">
              <li><span>01</span><div><strong>Діагностика знань</strong><p>Знаходимо сильні сторони й теми, які потребують уваги.</p></div></li>
              <li><span>02</span><div><strong>Персональний план</strong><p>Визначаємо реалістичну мету, ритм і контрольні точки.</p></div></li>
              <li><span>03</span><div><strong>Пояснення + практика</strong><p>Вчимося мислити, а не запам’ятовувати шаблони.</p></div></li>
              <li><span>04</span><div><strong>Видимий прогрес</strong><p>Регулярно перевіряємо результат і коригуємо маршрут.</p></div></li>
            </ol>
            <button className="button button-dark" onClick={() => openForm("approach")}>Обговорити цілі учня <span>→</span></button>
          </div>
        </section>

        <section id="tutor" className="section tutor-section">
          <div className="tutor-intro">
            <span className="kicker light">Про викладача</span>
            <h2>Теорія, практика та <em>10+ років досвіду</em></h2>
            <p>Викладач університету, аспірант і практикуючий інженер-розробник систем АСУТП. Це означає не лише знання формул, а й розуміння, як математика працює в реальному світі.</p>
            <button className="button button-light" onClick={() => openForm("tutor")}>Домовитися про знайомство <span>→</span></button>
          </div>
          <div className="credential-grid">
            <article><Icon>⌂</Icon><h3>Викладає в університеті</h3><p>Академічна точність і вміння пояснювати складні поняття.</p></article>
            <article><Icon>◎</Icon><h3>Навчається в аспірантурі</h3><p>Постійно розвивається та працює з сучасними підходами.</p></article>
            <article><Icon>⚙</Icon><h3>Практикуючий інженер</h3><p>Розробляє системи АСУТП та показує прикладне значення знань.</p></article>
            <article><Icon>10+</Icon><h3>Років репетиторства</h3><p>Досвід роботи з різними рівнями, цілями й темпами учнів.</p></article>
          </div>
        </section>

        <section id="results" className="section results">
          <div className="section-heading">
            <div><span className="kicker">Результат співпраці</span><h2>Від «я не розумію» до <em>«я можу це розв’язати»</em></h2></div>
            <p>Усі учні викладача складали ЗНО/НМТ з математики не нижче рівня «добре».</p>
          </div>
          <div className="result-layout">
            <div className="result-list">
              <article><Icon>✓</Icon><div><h3>Зникають прогалини</h3><p>Нові теми більше не будуються на хиткому фундаменті.</p></div></article>
              <article><Icon>✓</Icon><div><h3>З’являється впевненість</h3><p>Учень знає, із чого почати задачу й як перевірити себе.</p></div></article>
              <article><Icon>✓</Icon><div><h3>Є вимірюваний прогрес</h3><p>Результат видно у шкільних оцінках і пробних тестах.</p></div></article>
            </div>
            <div className="result-image"><img src="/images/student-success.png" alt="Учні впевнено демонструють прогрес у вивченні математики" width="900" height="760" loading="lazy" /></div>
          </div>
          <div className="center-cta"><button className="button button-primary" onClick={() => openForm("results")}>Почати підготовку до НМТ <span>→</span></button></div>
        </section>

        <section className="section final-cta">
          <div><span className="kicker light">Перший крок — простий</span><h2>Розкажіть, яка мета стоїть перед учнем</h2><p>На безкоштовній консультації визначимо поточну ситуацію, формат занять і найкращий маршрут до результату.</p></div>
          <div className="final-actions"><button className="button button-yellow" onClick={() => openForm("hero")}>Отримати консультацію <span>→</span></button><a href="tel:+380932862886">+380 (93) 286-28-86</a></div>
        </section>

        <section id="faq" className="section faq">
          <div className="section-heading"><div><span className="kicker">Часті запитання</span><h2>Коротко про <em>важливе</em></h2></div></div>
          <div className="faq-list">
            <details><summary>У якому форматі проходять заняття?<span>+</span></summary><p>Формат узгоджується на консультації відповідно до місця проживання, цілей та можливостей учня. Онлайн-заняття доступні по всій Україні.</p></details>
            <details><summary>Коли варто починати підготовку до НМТ?<span>+</span></summary><p>Чим раніше, тим спокійніше можна пройти програму, але персональний план можливо скласти й для коротшого терміну після діагностики знань.</p></details>
            <details><summary>Як зрозуміти, з яких тем починати?<span>+</span></summary><p>На старті проводиться діагностика. Вона показує не лише помилки, а й причини, через які вони виникають.</p></details>
            <details><summary>Чи задаються домашні завдання?<span>+</span></summary><p>Так, але в розумному обсязі. Завдання закріплюють саме те, що опрацьовано на занятті, та допомагають відстежувати прогрес.</p></details>
          </div>
          <div className="center-cta"><button className="button button-dark" onClick={() => openForm("faq")}>Поставити своє запитання <span>→</span></button></div>
        </section>
      </main>

      <footer>
        <a className="brand footer-brand" href="#top"><span className="brand-mark">π</span><span>Math<span>Lab</span></span></a>
        <p>Математика 5–12 класи · Підготовка до НМТ 2026 · Онлайн по Україні</p>
        <div><a href="tel:+380932862886">+380 (93) 286-28-86</a><a href="mailto:repetytor.in.zp@gmail.com">repetytor.in.zp@gmail.com</a></div>
        <small>© 2026 MathLab. <a href="/privacy-policy">Політика конфіденційності</a></small>
      </footer>

      {modalOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setModalOpen(false); }}>
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="lead-title">
            <button className="modal-close" onClick={() => setModalOpen(false)} aria-label="Закрити форму">×</button>
            {status === "success" ? (
              <div className="success-message"><Icon>✓</Icon><h2>Дякуємо!</h2><p>Запит отримано. Викладач зв’яжеться з вами найближчим часом.</p><button className="button button-primary" onClick={() => setModalOpen(false)}>Готово</button></div>
            ) : (
              <>
                <span className="kicker">Безкоштовна консультація</span>
                <h2 id="lead-title">{intent}</h2>
                <p>Залиште контакти — обговоримо рівень учня, мету та зручний формат занять.</p>
                <form onSubmit={submit} noValidate>
                  <label>Ім’я та прізвище
                    <input value={name} onChange={(e) => onName(e.target.value)} onBlur={() => validate()} placeholder="Ім’я Прізвище" autoComplete="name" maxLength={101} aria-invalid={!!errors.name} />
                    {errors.name && <span className="field-error">{errors.name}</span>}
                  </label>
                  <label>Номер телефону
                    <input value={phone} onChange={(e) => onPhone(e.target.value)} onBlur={() => validate()} placeholder="+380 (12) 345-67-89" inputMode="numeric" autoComplete="tel" aria-invalid={!!errors.phone} />
                    {errors.phone && <span className="field-error">{errors.phone}</span>}
                  </label>
                  <label>E-mail
                    <input type="email" value={email} onChange={(e) => { setEmail(e.target.value); setErrors((p) => ({ ...p, email: "" })); }} onBlur={() => validate()} placeholder="name@example.com" autoComplete="email" maxLength={254} aria-invalid={!!errors.email} />
                    {errors.email && <span className="field-error">{errors.email}</span>}
                  </label>
                  <input type="text" name="website" tabIndex={-1} autoComplete="off" className="honeypot" aria-hidden="true" />
                  {status === "error" && <div className="form-error">Не вдалося надіслати запит. Зателефонуйте нам: <a href="tel:+380932862886">+380 (93) 286-28-86</a>.</div>}
                  <button className="button button-primary submit-button" disabled={status === "sending"}>{status === "sending" ? "Надсилаємо…" : "Надіслати запит →"}</button>
                  <small>Натискаючи кнопку, ви погоджуєтеся на обробку даних відповідно до <a href="/privacy-policy" target="_blank" rel="noreferrer">Політики конфіденційності</a>.</small>
                </form>
              </>
            )}
          </div>
        </div>
      )}
      <button className="mobile-contact" onClick={() => openForm("hero")}>Записатися на консультацію</button>
    </>
  );
}
