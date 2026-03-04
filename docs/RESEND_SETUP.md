# Configuración de Resend (emails de confirmación de orden)

El proyecto envía un **email de confirmación** al comprador cuando el pago se completa (webhook de Stripe). Para que funcione necesitas configurar Resend y unas variables de entorno.

---

## 1. Cuenta en Resend

1. Entra en [resend.com](https://resend.com) y crea una cuenta (plan gratuito).
2. Verifica tu email si te lo piden.

---

## 2. API Key

1. En Resend: **API Keys** → **Create API Key**.
2. Dale un nombre (ej. "First template dev").
3. Copia la key (empieza por `re_`). **Solo se muestra una vez.**

---

## 3. Variables de entorno

Añade en tu archivo **`.env`** (en la raíz del proyecto):

```env
# Resend (emails de confirmación de orden)
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxx

# Opcional: remitente del email. Por defecto se usa "Orders <onboarding@resend.dev>"
# Cuando verifiques un dominio en Resend, usa algo como: "Orders <orders@tudominio.com>"
RESEND_FROM_EMAIL=Orders <onboarding@resend.dev>

# Opcional: URL base de tu app (para el enlace "Ver tu orden" en el email).
# En local suele ser http://localhost:3000; en producción tu dominio.
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

- **RESEND_API_KEY** es obligatorio para enviar emails. Si no está, el webhook sigue funcionando pero no se envía el correo (y en desarrollo se escribe un log).
- **RESEND_FROM_EMAIL** es opcional. Si no lo pones, se usa `Orders <onboarding@resend.dev>`. Con el dominio de prueba de Resend solo puedes enviar al email con el que te registraste.
- **NEXT_PUBLIC_APP_URL** es opcional. Se usa para el enlace "View your order" en el email. Por defecto: `http://localhost:3000`.

---

## 4. Dominio (producción)

Para **desarrollo** puedes usar el remitente por defecto `onboarding@resend.dev`. Resend solo te deja enviar a la dirección de tu cuenta.

Para **producción** (enviar a cualquier email):

1. En Resend: **Domains** → **Add Domain**.
2. Añade tu dominio (ej. `tudominio.com`).
3. Configura en tu proveedor DNS los registros que te indique Resend (SPF, DKIM, etc.).
4. Cuando el dominio esté verificado, pon en `.env`:
   ```env
   RESEND_FROM_EMAIL=Orders <orders@tudominio.com>
   ```
   (o el email que hayas verificado en ese dominio.)

---

## 5. Cómo probar

1. Configura `RESEND_API_KEY` (y opcionalmente `RESEND_FROM_EMAIL` y `NEXT_PUBLIC_APP_URL`) en `.env`.
2. Arranca el servidor y el webhook de Stripe (por ejemplo con `stripe listen --forward-to localhost:3000/api/webhooks/stripe`).
3. Haz una compra de prueba con la tarjeta `4242 4242 4242 4242` y el **mismo email** con el que te registraste en Resend (si usas `onboarding@resend.dev`).
4. Tras completar el pago, deberías recibir el email "Order confirmation #…" con el detalle de la orden.

Si no llega el email:

- Revisa la consola del servidor por errores de Resend.
- En Resend → **Logs** puedes ver envíos y fallos.
- Comprueba que el webhook devuelve 200 y que Stripe está enviando el evento (en la terminal de `stripe listen`).

---

## Resumen de archivos

- **`lib/email.ts`** – Cliente Resend y función `sendOrderConfirmationEmail`.
- **`app/api/webhooks/stripe/route.ts`** – Después de marcar la orden como pagada, obtiene el email del comprador y llama a `sendOrderConfirmationEmail`.
- El email incluye: número de orden, ítems, total, dirección de envío (si existe) y entrega estimada, más un enlace a la página de confirmación.
