import { NextRequest, NextResponse } from "next/server";

const NAME_PATTERN = /^\p{L}+\s+\p{L}+$/u;
const VALID_CODES = new Set(["039","050","063","066","067","068","073","075","077","089","091","092","093","094","095","096","097","098","099"]);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (body.website) return NextResponse.json({ ok: true });

    const name = String(body.name ?? "").trim();
    const phone = String(body.phone ?? "").trim();
    const email = String(body.email ?? "").trim();
    const intent = String(body.intent ?? "Консультація").slice(0, 150);
    const words = name.split(/\s+/);
    const digits = phone.replace(/\D/g, "").replace(/^38/, "");

    if (!NAME_PATTERN.test(name) || words.some((word) => word.length > 50)) {
      return NextResponse.json({ error: "invalid name" }, { status: 400 });
    }
    if (digits.length !== 10 || !VALID_CODES.has(digits.slice(0, 3))) {
      return NextResponse.json({ error: "invalid phone" }, { status: 400 });
    }
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(email)) {
      return NextResponse.json({ error: "invalid email" }, { status: 400 });
    }

    const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
    const telegramChat = process.env.TELEGRAM_CHAT_ID;
    const text = [
      "Нова заявка з сайту репетитора",
      `Мета: ${intent}`,
      `Ім’я: ${name}`,
      `Телефон: ${phone}`,
      `E-mail: ${email}`,
    ].join("\n");

    const deliveries: Promise<Response>[] = [];
    if (telegramToken && telegramChat) {
      deliveries.push(fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: telegramChat, text }),
      }));
    }

    deliveries.push(fetch("https://formsubmit.co/ajax/repetytor.in.zp@gmail.com", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        name, phone, email,
        message: intent,
        _subject: "Нова заявка: репетитор з математики",
        _template: "table",
      }),
    }));

    const results = await Promise.allSettled(deliveries);
    const delivered = results.some((result) => result.status === "fulfilled" && result.value.ok);
    if (!delivered) return NextResponse.json({ error: "delivery failed" }, { status: 502 });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
}
