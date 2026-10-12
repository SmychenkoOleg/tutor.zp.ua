# Tutor.zp.ua — Cloudflare preview (ізольоване тестове середовище)

Ця конфігурація НЕ змінює поточний сайт tutor.zp.ua та НЕ розгортає робочу гілку main.

## Архітектура

- Проєкт у GitHub: `SmychenkoOleg/tutor.zp.ua`
- Гілка для тестування: `feature/cms-content-foundation`
- Конфігурація тестового Worker: `wrangler.preview.jsonc`
- Ім'я окремого Worker: `tutor-zp-ua-preview`
- Сторінка й API: скомпільований `dist/server/index.js`
- Статичні ресурси: `dist/client`, прив'язка `ASSETS`

Жодних `routes`, `custom_domains` та DNS-змін у preview-конфігурації немає. Worker може отримати окрему адресу у домені `workers.dev` після розгортання. Адресу не слід вгадувати, її потрібно скопіювати з Cloudflare.

## Перевірка пакування, без реального розгортання

На Linux/macOS із сумісним Node.js:

```bash
npm ci
npm run build
npx wrangler deploy --config wrangler.preview.jsonc --dry-run --outdir .wrangler-preview
node --test tests/production-rendered-html.test.mjs
node --test tests/content-config.test.mjs
```

GitHub Actions `Production build & rendered HTML` виконує цю перевірку автоматично в PR.

## Публікація тестового Worker

Власник акаунта має авторизувати Cloudflare (через UI або CLI). Без Cloudflare-повноважень GitHub сама по собі не розгортає Worker.

1. Відкрийте Cloudflare Dashboard → **Workers & Pages**.
2. Увімкніть або перевірте `workers.dev` для вашого акаунта.
3. З'єднайте репозиторій GitHub з Cloudflare Workers Builds або налаштуйте ручне розгортання.
4. Для тесту обирайте **тільки** гілку `feature/cms-content-foundation`; команди: `npm ci && npm run build`, потім `npx wrangler deploy --config wrangler.preview.jsonc`. Якщо Cloudflare використовує інтеграцію, у якої є окремі поля для build і deploy, розмістіть команди у відповідних полях.
5. Переконайтеся, що об'єкт розгортання називається **`tutor-zp-ua-preview`**, а не `tutor.zp.ua`; не додавати власний домен і не змінювати DNS.
6. Після першого розгортання перевірте фактичну URL-адресу з Cloudflare та обмежте доступ до тестового середовища за потреби через Cloudflare Access. Без Access URL може бути публічно доступною.

Якщо опублікувати вручну через авторизований локальний Wrangler:

```bash
npm ci
npm run build
npx wrangler deploy --config wrangler.preview.jsonc
```

## Telegram

Маршрут `/api/lead` читає `TELEGRAM_BOT_TOKEN` та `TELEGRAM_CHAT_ID` на сервері. Без цих секретів коректна заявка поверне 503; це очікувано на першому етапі. Не передавайте токен у чат і не записуйте його до GitHub.

Перед наскрізним тестуванням налаштуйте **окремого тестового бота та чат** у секретах саме тестового Worker через Cloudflare Dashboard. Не використовуйте production-токен для тестів.

## Ручний контроль якості

- Desktop 1440×900, tablet 768×1024, mobile 390×844; перевірити відсутність горизонтального скролу.
- Головна, меню, усі CTA, блоки програм/FAQ, cookie-банер і сторінка приватності.
- Відкрити DevTools → Network / Console: відсутність JS-помилок, 404 ресурсів та помилок гідратації.
- POST `/api/lead`: невалідні поля — 400; відсутні тестові Telegram-секрети — 503; валідна заявка з тестовими секретами — 200 та фактичне повідомлення в окремому тестовому чаті.
- Відключити preview від пошукової індексації (robots / `X-Robots-Tag`) та від production-аналітики перед активним використанням тестового URL. Поточний preview-конфіг **не реалізує** цих обмежень, тому не слід поширювати адресу тестового Worker публічно.
- Лише після тестів переглянути PR, виконати merge у main та окремо узгодити публікацію сайту на основний домен.

## Безпека

- Cloudflare API-токени й секрети — тільки в Cloudflare/GitHub Secrets. Не додавати `.env`, `.dev.vars` та секрети до комітів.
- Наявність окремої Workers.dev-адреси не означає, що працівник є приватним.
- Перед запуском з тестовими реальними заявками — включити контроль доступу до preview.

## Парольний захист без Zero Trust

Тестовий Worker використовує HTTP Basic Authentication. Це окремий вхід `worker/preview-entry.mjs`, який накладає захист **до** серверних маршрутів і статичних файлів (`assets.run_worker_first: true`). Він працює тільки у preview-конфігурації Cloudflare, а не в основному застосунку.

1. Переконайтесь, що у Cloudflare → `tutor-zp-ua-preview` → **Settings → Variables and Secrets** створено змінну:
   - **Name:** `PREVIEW_AUTH_PASSWORD`
   - **Type:** `Secret` (НЕ Plaintext!)
   - **Value:** ваш випадковий унікальний пароль з не менше ніж 20 символів ASCII.
2. Збережіть та розгорніть налаштування (Cloudflare може створити нову версію Worker). Пароль не потрібно додавати в GitHub чи надсилати в чат.
3. Переконайтесь, що остання збірка тестової Git-гілки **Ready**. Потім у **Domains** увімкніть **Production Worker URL** `workers.dev` для цього тестового Worker. **Preview URL** можна залишити вимкненим.
4. У браузері відкрийте URL з Cloudflare. Ім'я користувача: **`preview`**, пароль: значення `PREVIEW_AUTH_PASSWORD`.
5. Без Secret або з коротким паролем Worker поверне **503** і нічого не віддасть; з неправильними даними **401**; із правильним паролем відкриє сайт та ресурси.

Захист також додає `X-Robots-Tag: noindex`, `Cache-Control: no-store` і CSP, яка блокує сторонні Analytics/GTM на тестовій адресі. `X-Robots-Tag` — додатковий сигнал; основний захист забезпечує автентифікація.

**Увага:** пароль Basic Auth зберігається у сесії браузера, й інтерфейс не має кнопки виходу. Для завершення доступу закрийте приватне вікно або змініть пароль у Cloudflare. Використовуйте лише HTTPS (`workers.dev`). Рекомендований надійний пароль — випадковий і унікальний, від 24 символів.

Тести захисту: `node --test tests/preview-access.test.mjs` (після `npm run build`).
