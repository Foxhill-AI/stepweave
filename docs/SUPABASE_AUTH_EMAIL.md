# Verificación por email (doble verificación) y SMTP en Supabase

## Redirect URL para el enlace de verificación

Con "Confirm email" activado, el enlace que recibe el usuario debe redirigir a tu app. En **Supabase Dashboard** → **Authentication** → **URL Configuration** → **Redirect URLs**, añade:

- En desarrollo: `http://localhost:3000/auth/callback`
- En producción: `https://tu-dominio.com/auth/callback`

Así Supabase acepta redirigir al usuario a `/auth/callback` tras hacer clic en "Confirm your email".

---

## Error "error sending email confirmation" al hacer Sign up (500)

Si al registrarte con **email + username + password** ves un **500 (Internal Server Error)** y el mensaje **"error sending email confirmation"**, Supabase Auth está intentando enviar el correo de verificación pero falla (normalmente por la configuración de envío de emails).

---

## Opción 1: Desactivar la confirmación por email (rápido, para seguir probando)

Mientras arreglas el SMTP o solo para desarrollo:

1. Entra en **Supabase Dashboard** → tu proyecto.
2. **Authentication** → **Providers** → **Email**.
3. Desactiva **"Confirm email"** (toggle en OFF).
4. Guarda.

A partir de ahí, el sign up **no** intentará enviar el correo y no debería devolver 500. Los usuarios quedarán confirmados al registrarse. Cuando tengas el SMTP bien configurado, puedes volver a activar "Confirm email".

---

## Opción 2: Usar Resend como SMTP de Supabase (emails de verificación por Resend)

Para que el correo de verificación lo envíe **Resend** en lugar del servicio por defecto de Supabase:

### 1. Datos SMTP de Resend

En [Resend → Send with SMTP](https://resend.com/docs/send-with-smtp):

- **Host:** `smtp.resend.com`
- **Port:** `465` (SSL) o `587` (TLS)
- **Username:** `resend`
- **Password:** tu **API Key** de Resend (la que empieza por `re_`)

### 2. Configurar en Supabase

1. **Supabase Dashboard** → **Project Settings** (engranaje) → **Auth**.
2. Baja a **SMTP Settings**.
3. Activa **"Enable Custom SMTP"**.
4. Rellena:
   - **Sender email:** debe ser un email que Resend permita:
     - En desarrollo: si usas el dominio de prueba de Resend, solo puedes enviar **a tu propio email de cuenta**. Para el *remitente* suele usarse algo como `onboarding@resend.dev` (comprueba en Resend qué remitente te asignan).
     - En producción: un email de un **dominio verificado** en Resend (ej. `noreply@tudominio.com`).
   - **Sender name:** ej. `Mi App` o `Tu Tienda`.
   - **Host:** `smtp.resend.com`
   - **Port:** `465` o `587`
   - **Username:** `resend`
   - **Password:** tu API Key de Resend (`re_...`).
5. Guarda.

### 3. Comprobar en Resend

- Con dominio de prueba, el **destinatario** del correo de verificación suele tener que ser el email de tu cuenta de Resend.
- Si el remitente no está permitido o la API key es incorrecta, Supabase seguirá devolviendo 500 al intentar enviar. Revisa **Resend → Logs** para ver si llegan intentos y por qué fallan.

---

## Resumen

| Objetivo | Acción |
|----------|--------|
| Que el sign up funcione ya (sin verificación por email) | Opción 1: Desactivar "Confirm email" en Auth → Providers → Email. |
| Que el correo de verificación lo envíe Resend | Opción 2: Configurar SMTP de Resend en Supabase (Project Settings → Auth → SMTP). |

Si tras configurar SMTP sigues teniendo 500, revisa que el **Sender email** esté permitido en Resend y que la **API Key** sea la correcta y esté pegada sin espacios.
