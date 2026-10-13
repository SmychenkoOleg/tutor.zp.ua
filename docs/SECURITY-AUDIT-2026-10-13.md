# Аудит безпеки MathLab — 13.10.2026

**Об'єкт:** `SmychenkoOleg/tutor.zp.ua`, тестова гілка `feature/cms-content-foundation`, код на коміті `4554836de2392878b0c25370994f52abecd4bb8c`.

**Результат:** тестова версія придатна для контрольованого тестування з уже налаштованими паролями, але **не готова до запуску відкритого production сайту/CRM без усунення ризиків P1**.

## Метод і обмеження

Проведено статичний аналіз Worker, Next/Vinext API, клієнтської форми, CRM-авторизації, D1-запитів, експорту CSV, політики конфіденційності, GitHub workflows та наявних тестів. Перевірено результат останніх GitHub Actions (успішні збірка та тести). **Не проводилися** penetration test з реальними секретами, brute-force/DDoS, читання або зміни production D1, аудит акаунта Cloudflare/WAF/Zero Trust, повна перевірка історії Git, залежностей через npm audit або перевірка витоків у сторонніх сервісах. Спроба відкрити preview через зовнішній веб-інструмент не дала відповіді; реальні Cloudflare-заголовки і налаштування не підтверджені.

## Знахідки за пріоритетом

| ID | Ризик | Пріоритет | Підтвердження | Що робити |
|---|---|---|---|---|
| S-01 | Honeypot не працює для HTML-форми: приховане поле `website` не зчитується, а в POST завжди йде `website:""`. | **P1 високий** | `app/page.tsx:164-168,344` | Брати значення із фактичного прихованого поля, перевіряти на сервері; не вважати honeypot єдиним антибот-засобом |
| S-02 | У коді відсутня rate limit на `/api/lead`, `/admin/api/login` і HTTP Basic Auth; Turnstile відсутній. Конфігурація WAF акаунта не перевірена. | **P1 високий для production** | `worker/preview-security.mjs`, `worker/crm-admin.mjs`, `worker/crm-leads.mjs` | Ввести Cloudflare rate limits із обмеженнями по endpoint і тестами 429; додати Turnstile з **обов'язковою серверною Siteverify перевіркою**. Для CRM — Cloudflare Access/MFA |
| S-03 | У політиці обіцяно зберігання не довше 3 років, але в репозиторії немає автоматичної політики видалення за часом. D1 Time Travel/резервні копії можуть містити видалені записи протягом вікна відновлення. | **P1 комплаєнс/приватність** | `app/privacy-policy/page.tsx:99`, `migrations/`, `worker/crm-admin.mjs` | Затвердити строк; додати Scheduled Worker cleanup, журнал без PII, задокументувати backup/time-travel та процедуру виконання запитів на видалення |
| S-04 | Не використовується ключ ідемпотентності форми: повторний POST після затримки/помилки може створити дублікати в D1 та Telegram. | **P2 середній** | `app/page.tsx:159-174`, `worker/crm-leads.mjs:35-63` | Генерувати idempotency key на одну заявку; забезпечити унікальність на сервері й однакову відповідь для повторного запиту |
| S-05 | Звернення до Telegram синхронне, без тайм-ауту/повторної доставки: після збереження D1 можливий довгий запит або статус `failed` без автоматичного повторення. | **P2 середній** | `worker/crm-leads.mjs:48-63` | Ввести тайм-аут, контрольований retry/backoff або асинхронну чергу; відстежувати `pending/failed` |
| S-06 | Сервер перевіряє `phone` за цифрами після видалення всіх сторонніх символів, але зберігає оригінальне значення. `intent` довільний, не звіряється із дозволеними темами. | **P2 середній** | `worker/crm-leads.mjs:23-31,40-41`, `app/api/lead/route.ts:12-27` | Нормалізувати телефон до дозволеного канонічного формату, відхиляти control chars/надлишкові знаки, обмежити `intent` списком значень/ключів |
| S-07 | Визначені обмеження body size перевіряються вже після `request.text()` / `request.json()`. Великий запит спочатку може зайняти пам'ять Worker. | **P2 середній** | `worker/crm-leads.mjs:13-19`, `worker/crm-admin.mjs`, `app/api/lead/route.ts:8` | Обмежити розмір під час потокового читання та через edge правила, а не лише після накопичення body |
| S-08 | Сесія CRM HMAC-підписана та живе до 2 годин, але logout тільки видаляє cookie клієнта, не відкликаючи раніше скопійовану сесію. | **P2 середній** | `worker/crm-auth.mjs:3,28-47` | Для production — Access/MFA та серверний список сесій/версія токенів для logout-all/revocation; процедура ротації секрету |
| S-09 | CSP дозволяє `unsafe-inline` і не встановлює `frame-ancestors 'none'`; `frame-src 'none'` **не** забороняє вбудовувати сторінку в iframe. | **P2 середній** | `worker/preview-security.mjs:41` | Для адмінки `frame-ancestors 'none'`, `X-Frame-Options: DENY`, прибрати inline-script через зовнішні файли або nonce/hash і суворішу CSP |
| S-10 | Legacy Telegram-only endpoint може журналювати сире тіло Telegram-помилки; окремого timeout також немає. | **P2 середній** | `app/api/lead/route.ts:61-71` | Не записувати тіло помилки сервісу в лог; залишити код/status і безпечний error ID, тайм-аут |
| S-11 | Стандартний CSV використовує екранування клітинок, але спеціальний телефонний формат записує Excel-формулу `="номер"`. Хоча символи строго обмежені, це ускладнює політику «ніколи не виконувати формули з CSV». | **P3 покращення** | `worker/crm-records.mjs:15-23` | Для суворішого експорту перейти на XLSX із явним текстовим типом комірки або ретельно протестувати імпорт CSV у різних Excel/LibreOffice |
| S-12 | GitHub репозиторій публічний. Workflows використовують `permissions: contents: read` і `npm ci` — це позитивно, але перевірка уразливостей пакетів/SAST/secret scanning та налаштування branch protection не підтверджені. Repo rulesets API повернув порожній масив; API branch protection недоступний цьому підключенню. | **P2 для релізу** | `.github/workflows/*.yml`, `package*.json` | Увімкнути Dependabot alerts, dependency scanning, secret scanning за доступності; перевірити захист main, required status checks та доступ до Cloudflare deploy |

## Позитивні контрольні заходи

- Preview перевіряє Basic Authentication **до** маршрутизації HTML, API і статичних assets.
- CRM вимагає **другу окрему сесію**; паролі й HMAC-секрет читаються з runtime secrets, не з клієнтського JS.
- CRM cookie має атрибути `__Host-`, `HttpOnly`, `Secure`, `SameSite=Strict`.
- Запити зміни стану/видалення перевіряють `Origin`, сесію, статус та UUID.
- Вибірка/зміна/видалення D1 використовують `prepare().bind()`; конкретних SQL-injection шляхів у перевірених маршрутах не виявлено.
- UI CRM формує клітинки через `textContent`; у перевіреному коді немає очевидного unsafe HTML-рендерингу PII.
- Експорт обмежено 10 000 записів, перевищення ліміту не призводить до тихого неповного CSV; для полів передбачено захист від небезпечних початкових символів.
- Профіль пристрою зберігається тільки як категорія, без оригінального `User-Agent`.
- `main` не змінювалася під час аудиту; CRM залишається на preview Worker.

## План впровадження

**Етап 1 — перед будь-яким публічним релізом:** S-01, S-02 (rate limits + Turnstile Siteverify + Access/MFA), S-03 (retention), S-06 (нормалізація даних), S-07 (розмір запитів), базове резервування і відновлення D1. Після змін — негативні тести 400/401/403/429, повторний POST та контроль непотрапляння PII у логи.

**Етап 2 — надійність і безпека CRM:** S-04, S-05, S-08, S-09, S-10. Валідація logout/revocation, CSRF, clickjacking, невдалої доставки Telegram, відновлення після збою.

**Етап 3 — supply-chain і реліз:** S-11, S-12, перевірка npm audit/Dependabot, підтвердження Cloudflare Access, WAF, секретів і branch protection **в акаунтах власника** та живий smoke test.

## Дані, що треба перевірити власникові у Cloudflare / GitHub

- Cloudflare Worker → Variables and Secrets: назви `PREVIEW_AUTH_PASSWORD`, `LEADS_ADMIN_PASSWORD`, `LEADS_SESSION_SECRET`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` присутні як **Secret**. Значення нікуди не надсилати.
- Security → WAF/Rate limiting: чи є правила саме для `/api/lead` та `/admin/api/login`; чи працює тарифний/роутінговий режим Workers.
- Zero Trust → Access: чи захищено preview і CRM додатковою автентифікацією/MFA.
- D1 → Time Travel/backup: чи є протестована процедура відновлення без втрати нових заявок; дата останньої контрольної точки.
- GitHub → Settings → Branches/Rulesets та Security: require PR, protected main, alerts та secret scanning.

## Документація постачальника

- Turnstile: https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
- Workers Rate Limiting: https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/
- D1 Time Travel: https://developers.cloudflare.com/d1/reference/time-travel/

**Висновок:** у перевіреному коді не доведено витік персональних даних чи успішний несанкціонований доступ. Це **огляд вихідного коду й доступної конфігурації**, не сертифікація безпеки або підтвердження захищеності реального Cloudflare акаунта. Поки що залишити тестову версію приватною, `main` і DNS не змінювати.
