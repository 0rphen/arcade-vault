import { Resend } from "resend";

interface ContactPayload {
  name: string;
  email: string;
  message: string;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CONTACT_RECIPIENT = "the.bebop.88@gmail.com";

export async function POST(request: Request) {
  const payload = (await request.json()) as Partial<ContactPayload>;
  const { name, email, message } = payload;

  if (!name?.trim() || !email?.trim() || !message?.trim()) {
    return Response.json(
      { ok: false, error: "Todos los campos son obligatorios." },
      { status: 400 }
    );
  }

  if (!EMAIL_REGEX.test(email)) {
    return Response.json(
      { ok: false, error: "El email no tiene un formato válido." },
      { status: 400 }
    );
  }

  const resend = new Resend(process.env.RESEND_API_KEY);

  const { error } = await resend.emails.send({
    from: "onboarding@resend.dev",
    to: CONTACT_RECIPIENT,
    subject: `Nuevo mensaje de contacto — ${name}`,
    text: `Nombre: ${name}\nEmail: ${email}\n\nMensaje:\n${message}`,
    html: `<p><strong>Nombre:</strong> ${name}</p><p><strong>Email:</strong> ${email}</p><p><strong>Mensaje:</strong></p><p>${message}</p>`,
  });

  if (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }

  return Response.json({ ok: true });
}
