# MathLab CRM: тестові заявки в Cloudflare D1

**Стан:** код і SQL-міграція у гілці `feature/cms-content-foundation`. Поки D1 не підключено, поточні заявки як і раніше надходять до Telegram через `app/api/lead/route.ts`. Не з'єднуйте з main та не змінюйте DNS.

## 1. Створити окрему D1 базу

У Cloudflare Dashboard → **Storage & databases → D1 SQL Database** (або D1) → **Create database**.

- Ім'я: `tutor-zp-ua-leads-preview`.
- Це база лише для тестового Worker.
- Після створення збережіть **Database ID** (UUID). Він не є паролем.
- Регіон оберіть відповідно до вимог розташування даних; для користувачів України зазвичай доречна європейська локація.

## 2. Створити таблицю

Поки база не містить даних, виконайте SQL зі **`migrations/0001_leads.sql`** у консолі D1 (або через авторизований Wrangler):

```bash
npx wrangler d1 execute tutor-zp-ua-leads-preview --remote --file migrations/0001_leads.sql
```

Команду виконувати лише в директорії проєкту з авторизованим Wrangler. У Cloudflare Dashboard можна вставити SQL із файлу в D1 Console, якщо є відповідна опція.

## 3. Підключити binding через GitHub

В `wrangler.preview.jsonc` необхідно додати:

```json
"d1_databases": [
  {
    "binding": "LEADS_DB",
    "database_name": "tutor-zp-ua-leads-preview",
    "database_id": "UUID_ІЗ_CLOUDFLARE",
    "migrations_dir": "migrations"
  }
]
```

Не додавайте вигаданий UUID: Wrangler не зможе опублікувати Worker. Після отримання реального ID конфігурацію оновлюємо в GitHub, автоматичний deploy підхопить binding.

**Порядок важливий:** створити БД → застосувати міграцію → додати binding → переконатися, що Cloudflare Build Ready → тестувати. Без binding новий модуль збереження не активний, і чинна форма лишається працездатною.

## 4. Додати два додаткові секрети Runtime → Production

У Worker `tutor-zp-ua-preview` → Settings → **Runtime variables and secrets** (не Build variables):

- `LEADS_ADMIN_PASSWORD`: окремий унікальний пароль адміністратора CRM, щонайменше 24 символи.
- `LEADS_SESSION_SECRET`: окремий випадковий секрет для підпису сесій, щонайменше 32 символи.

Обидва — **Secret**. Не передавайте значення в чат/GitHub. Наявні секрети `PREVIEW_AUTH_PASSWORD`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` залишаються.

## 5. Інтерфейс

Після успішного налаштування відкрийте `https://tutor-zp-ua-preview.smychenkooleg.workers.dev/admin/leads`.

1. Спершу браузер попросить вже наявний пароль тестового сайту (`preview`).
2. Потім окрема сторінка попросить `LEADS_ADMIN_PASSWORD`.
3. Ви побачите останні 50 заявок, їхні статуси та стан Telegram-сповіщень. Можна змінювати статус і службову нотатку.
4. Після виходу адміністраторська сесія видаляється. Сесія діє не довше двох годин (без повторного входу).

Адмін-API вимагає окрему підписану `HttpOnly`, `Secure`, `SameSite=Strict` cookie-сесію. Запити зміни стану додатково перевіряють Origin. Список заявок не відкривається без сесії. Сервер віддає `no-store` і `noindex`.

## 6. Поведінка заявки

- Валідація та honeypot перед записом у D1.
- Успішний запис → Telegram → `telegram_status=sent/failed`.
- Якщо Telegram не відповідає, заявка в D1 залишається, а клієнт бачить успішне приймання.
- Якщо D1 недоступна або запис не вдався, користувач бачить повідомлення про помилку; система **не** стверджує, що заявку збережено.
- Тестові Telegram-повідомлення позначені `ТЕСТОВА ЗАЯВКА MathLab`.
- Дані заявників у GitHub не передаються.

## 7. Додаткові перевірки перед production

- Підключити захист від частих запитів до `/api/lead` та `/admin/api/login` через Cloudflare WAF/rate limiting. У тестовому оточенні додатково діє Basic Auth.
- Резервування, обмеження доступу до D1, політика зберігання і видалення персональних даних.
- Перевірити, що збережені заявки не потрапляють у технічні логи.
- Граничні випадки доставки Telegram, дублювання та повторні натискання.
- Перед публікацією на робочому домені потрібна окрема production D1, інша конфігурація доступу та аудит захисту.
