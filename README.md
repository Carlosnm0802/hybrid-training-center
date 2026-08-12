# Hybrid Training Center — Sistema de Gestión de Membresías

## 1. Contexto del proyecto

Hybrid Training Center es un gimnasio de reciente apertura (entrenamiento híbrido + boxeo) con 50-80 alumnos activos y potencial de crecimiento. Actualmente el control de membresías se hace con **recibos de papel + cuaderno de recepción**, sin ninguna persistencia de datos: si un alumno pierde su recibo, no hay forma de verificar su historial de pagos.

Este proyecto reemplaza ese proceso con una plataforma web ligera que digitaliza el control de alumnos, pagos, vigencias y asistencia.

**Objetivo de negocio:** proyecto de portafolio con intención real de venta/propuesta al gimnasio.

**Prioridad de hoy:** una demo funcional real (no mockup) conectada a Supabase de verdad: login + alta de alumno + registro de pago + check-in.

---

## 2. Stack técnico (decisión final, no cambiar sin aprobación)

- **Frontend:** HTML + CSS + JavaScript vanilla (mismo patrón que el proyecto AegonPerfumes)
- **Backend:** Supabase (Auth, Postgres, Edge Functions, Storage si se necesita)
- **Hosting:** GitHub Pages (sitio estático — por eso NO hay servidor propio; toda la lógica de negocio vive en Supabase Edge Functions, no en un backend Node/FastAPI)
- **Email transaccional (fase 2, no bloquea el MVP de hoy):** Resend, llamado desde una Edge Function
- **Sin frameworks de frontend** (no React, no Vue) — es una decisión explícita del desarrollador, no un olvido

### Estructura de archivos sugerida

```
/hybrid-training-center
  /assets
    /css
    /img
  /js
    auth.js          # login, sesión, roles
    alumnos.js        # alta, edición, listado de alumnos
    pagos.js           # registro y edición de pagos, cálculo de vigencia
    checkin.js         # búsqueda de alumno + marcar entrada
    supabaseClient.js  # inicialización del cliente Supabase
    utils.js            # helpers compartidos (fechas, folios, formato moneda)
  index.html            # login
  dashboard.html         # pantalla principal tras login (futuro: estadísticas)
  alumnos.html            # listado + alta de alumnos
  checkin.html             # pantalla de check-in
  README.md
```

---

## 3. Identidad visual

- Nombre: **Hybrid Training Center**
- Logo: escudo romano (referencia: identidad tipo Instagram @hybrid_training_ctr)
- Paleta: inspirada en marcas de entrenamiento funcional/HYROX — tonos oscuros (negro, gris concreto) con un acento fuerte (rojo, naranja o dorado). Definir paleta exacta en fase de diseño con la skill `frontend-design`.
- Tono visual: atlético, serio, robusto — no "fitness casual"

---

## 4. Roles y autenticación

Tres roles, gestionados vía Supabase Auth + tabla `usuarios` con columna `rol`:

| Rol | Permisos |
|---|---|
| **admin** | Todo lo que hacen recepción/coach + gestión de altas/bajas de usuarios (crear/eliminar cuentas de recepción y coach) |
| **recepcion** | Alta de alumnos, registro de pagos, check-in, ver listado completo de alumnos |
| **coach** | Mismas funciones que recepción (sin diferencias de permisos operativos) |

- Cada persona tiene **login individual** (para trazabilidad: quién registró qué pago, quién hizo qué check-in)
- No hay registro público — las cuentas las crea un admin
- Pantalla de inicio tras login: dashboard/estadísticas (fase 2). **Para el MVP de hoy, redirigir tras login a la pantalla de alumnos o check-in.**

---

## 5. Modelo de datos (Supabase / Postgres)

### Tabla `usuarios`
Vinculada a `auth.users` de Supabase.
| Campo | Tipo | Notas |
|---|---|---|
| id | uuid | FK a auth.users |
| nombre | text | |
| rol | text | 'admin' \| 'recepcion' \| 'coach' |
| created_at | timestamp | |

### Tabla `alumnos`
| Campo | Tipo | Notas |
|---|---|---|
| id | uuid (PK) | |
| nombre_completo | text | obligatorio |
| telefono | text | obligatorio |
| email | text | obligatorio (para recibo por email, fase 2) |
| modalidad | text | 'boxeo' \| 'hibrido' \| 'combo' |
| condicion_medica | text | opcional, puede ser "Ninguna" |
| contacto_emergencia_nombre | text | |
| contacto_emergencia_telefono | text | |
| fecha_alta | timestamp | default now() |
| fecha_vigencia_hasta | date | null si nunca ha pagado un plan con vigencia |
| tipo_plan_actual | text | 'clase' \| 'semana' \| 'mensual' \| 'combo' \| null |
| clase_disponible | boolean | true si tiene una "clase suelta" sin consumir aún |

### Tabla `pagos`
| Campo | Tipo | Notas |
|---|---|---|
| id | uuid (PK) | |
| folio | serial / text | consecutivo único, ver sección 7 |
| alumno_id | uuid (FK) | |
| conceptos | jsonb | ej. `[{"concepto":"inscripcion","monto":150},{"concepto":"mensualidad","monto":450}]` — permite recibo combinado |
| monto_total | numeric | suma de conceptos |
| metodo_pago | text | siempre 'efectivo' en MVP |
| fecha_pago | timestamp | default now() |
| registrado_por | uuid (FK a usuarios) | automático por sesión activa |
| editado | boolean | default false, true si fue corregido después |

### Tabla `checkins`
| Campo | Tipo | Notas |
|---|---|---|
| id | uuid (PK) | |
| alumno_id | uuid (FK) | |
| fecha_hora | timestamp | default now() |
| registrado_por | uuid (FK a usuarios) | |
| alerta_mostrada | boolean | true si el alumno estaba vencido/sin clase disponible al momento del check-in |

### Tabla `clases_horarios` (fase 2, no bloquea MVP)
| Campo | Tipo | Notas |
|---|---|---|
| id | uuid (PK) | |
| coach_id | uuid (FK a usuarios) | |
| modalidad | text | 'boxeo' \| 'hibrido' |
| dia_semana | text | |
| hora_inicio | time | |
| hora_fin | time | |

---

## 6. Planes y reglas de negocio (crítico — no improvisar)

| Plan | Precio | Vigencia | Reglas |
|---|---|---|---|
| Inscripción | $150 MXN | Pago único | Solo se cobra la primera vez que un alumno se da de alta. Nunca se repite. |
| Clase suelta | $50 MXN | 1 entrada | Se consume con un solo check-in y ya. No tiene fecha límite de uso previa al consumo. |
| Semana | $150 MXN | 7 días exactos desde el pago | Acceso ilimitado durante esos 7 días |
| Mensualidad | $450 MXN | 30 días exactos desde el pago | Acceso a UNA modalidad (boxeo o híbrido, la que eligió el alumno) |
| Combo | $500 MXN | 30 días exactos desde el pago | Acceso a AMBAS modalidades. Solo existe a nivel mensual — no hay "semana combo" ni "clase combo" |

**Reglas de vigencia:**
- Un pago nuevo de mensualidad/combo **reinicia** el conteo de 30 días desde la fecha del nuevo pago (no se suman los días restantes anteriores).
- Si un alumno nuevo se da de alta y paga su inscripción + su primer plan en la misma visita, se genera **un solo recibo combinado** con folio único (ver ejemplo en sección 8).
- Los pagos son **editables** después de registrados (por si recepción se equivoca de plan o nombre). No se maneja como "inmutable + anulación".

**Reglas de check-in:**
- El check-in es manual: se busca al alumno en una lista y se marca su entrada.
- El check-in **no distingue clase/modalidad** — solo confirma "vino hoy al gimnasio".
- Si el alumno está vencido, o ya consumió su clase suelta, el sistema debe **mostrar una alerta visual** (ej. banner rojo "Membresía vencida" o "Ya usó su clase") pero **NO debe bloquear** el check-in. Recepción decide si lo deja pasar.

---

## 7. Folio de recibos

- Consecutivo simple, único en toda la plataforma (no reinicia por mes/año en el MVP).
- Formato sugerido: `HTC-00001`, `HTC-00002`, etc.
- Se genera al momento de registrar el pago (no antes).

---

## 8. Ejemplo real de flujo (usar para validar que la demo funciona)

> Llega un alumno nuevo, **Juan Pérez**. Quiere inscribirse a la modalidad **Híbrido** con plan **Mensual**.
>
> 1. Recepción va a "Alta de alumno" y captura: nombre completo (Juan Pérez), teléfono, email, modalidad (Híbrido), condición médica, contacto de emergencia.
> 2. Se guarda el alumno con `fecha_vigencia_hasta = null` (aún no ha pagado ningún plan).
> 3. Recepción va a "Registrar pago", busca a Juan Pérez, y como es su primera vez, el sistema ofrece automáticamente agregar el concepto "Inscripción" ($150) además del plan elegido ("Mensualidad", $450).
> 4. Se genera un solo recibo con folio `HTC-00001`, monto total $600, desglosado en dos conceptos.
> 5. El sistema calcula `fecha_vigencia_hasta = hoy + 30 días` y actualiza el registro de Juan Pérez.
> 6. (Fase 2) Se dispara el email con el recibo formal a Juan.
>
> **Este flujo debe funcionar de principio a fin en la demo de hoy** (excepto el paso 6, que es fase 2).

---

## 9. Alcance del MVP de HOY (no construir de más)

✅ Incluir:
- Login con Supabase Auth (email/password), redirección según sesión activa
- Alta de alumno nuevo (formulario completo, sección 5)
- Registro de pago con selección de plan, cálculo automático de vigencia, soporte para recibo combinado (inscripción + primer plan)
- Listado de alumnos con estado visual claro (activo / vencido / sin plan) y días restantes
- Check-in: buscar alumno, marcar entrada, alerta visual si está vencido
- Edición de un pago ya registrado

❌ NO incluir hoy (fase 2/3, ya especificado arriba pero no bloquea el MVP):
- Envío de email con recibo (queda el modelo de datos listo, pero la Edge Function se hace después)
- Panel de estadísticas
- Módulo de asignación coach-horario
- Portal del alumno
- Cualquier tipo de notificación por WhatsApp

---

## 10. Criterios de calidad (cómo sabemos que está bien hecho)

- Un usuario puede loguearse, dar de alta a un alumno, cobrarle, y hacer check-in sin errores, siguiendo el ejemplo de Juan Pérez de punta a punta.
- Las fechas de vigencia se calculan correctamente para los 5 tipos de plan (ver sección 6).
- El folio de recibo nunca se repite ni se salta al reiniciar sesión o recargar la página.
- El check-in de un alumno vencido muestra alerta pero no bloquea la acción.
- El código JS está separado por módulo (auth, alumnos, pagos, checkin) — nada de un solo archivo gigante.
- Las políticas de Row Level Security (RLS) de Supabase están activas: sin sesión válida, no se puede leer ni escribir en ninguna tabla.