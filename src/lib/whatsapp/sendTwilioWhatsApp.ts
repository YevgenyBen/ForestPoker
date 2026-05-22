function requiredEnv(name: string): string | undefined {
  const v = process.env[name]?.trim();
  return v || undefined;
}

export function isWhatsAppNotifyConfigured(): boolean {
  return (
    !!requiredEnv("TWILIO_ACCOUNT_SID") &&
    !!requiredEnv("TWILIO_AUTH_TOKEN") &&
    !!requiredEnv("TWILIO_WHATSAPP_FROM") &&
    !!requiredEnv("WHATSAPP_NOTIFY_TO")
  );
}

export async function sendTwilioWhatsApp(body: string): Promise<void> {
  const accountSid = requiredEnv("TWILIO_ACCOUNT_SID");
  const authToken = requiredEnv("TWILIO_AUTH_TOKEN");
  const from = requiredEnv("TWILIO_WHATSAPP_FROM");
  const to = requiredEnv("WHATSAPP_NOTIFY_TO");

  if (!accountSid || !authToken || !from || !to) {
    return;
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const params = new URLSearchParams({ From: from, To: to, Body: body });
  const credentials = Buffer.from(`${accountSid}:${authToken}`).toString(
    "base64"
  );

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(
      `Twilio WhatsApp failed (${res.status})${detail ? `: ${detail.slice(0, 200)}` : ""}`
    );
  }
}
