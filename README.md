# FidiaCorp — aplicación web

Base del cliente web con Vue, Vue Router, PrimeVue y Tailwind CSS sobre Vite.

## Requisitos

- Node.js 24.22.1 (LTS utilizada para la validación).
- pnpm 12.15.0, fijado en `package.json`.

## Instalación y ejecución

```sh
pnpm install --frozen-lockfile --ignore-scripts
pnpm dev
```

Vite muestra la dirección local disponible, normalmente `http://localhost:5173`.
La instalación utiliza `pnpm-lock.yaml`; no se requiere npm ni npx. Los scripts
propios del proyecto se ejecutan explícitamente con los comandos siguientes.

```sh
pnpm build
pnpm preview
pnpm audit
```

`build` genera `dist/`; `preview` permite comprobar esa compilación localmente.
La auditoría detecta vulnerabilidades conocidas y no garantiza ausencia de malware.

## Configuración inicial y navegación

`src/main.js` registra Vue Router y PrimeVue en modo unstyled. Los estilos de la
base se definen en `src/style.css`, que también importa Tailwind mediante su
plugin de Vite. No se requieren plugins de traducción ni de estado para esta etapa.

La instancia del router se define en `src/router/index.js`; `src/router.js` la
reexporta por compatibilidad. Inicio utiliza la vista
`src/shared/presentation/views/home.vue` integrada desde `develop`.
Los destinos están centralizados en `src/router/navigation.js`:

| Ruta | Sección |
| --- | --- |
| `/home` | Inicio |
| `/realState` | Inmobiliario |
| `/messaging` | Mensajería |
| `/products` | Mis productos |
| `/profile` | Perfil |

La ruta `/` redirige a `/home`. Las rutas desconocidas muestran una página 404
con enlace al inicio. Inicio es público. `/login` y `/register` permiten ingresar y crear una cuenta.
Las otras secciones requieren sesión; Perfil consulta y actualiza los datos de la API.
Inmuebles, mensajería y productos conservan sus vistas iniciales.

El router utiliza historial HTML5 y respeta la base de Vite. En el servidor de
publicación se debe devolver `index.html` para rutas de la aplicación que no
correspondan a archivos, para permitir abrir y recargar enlaces directamente.

## API y cuentas

El frontend puede arrancar sin backend; registro, ingreso y perfil necesitan la API.
Crea `.env.local` con `VITE_API_BASE_URL=http://localhost:8080/api/v1`
(valor predeterminado) y reinicia Vite. En producción configura esa variable antes
de compilar. El backend debe permitir el origen del frontend mediante CORS.

El cliente usa `/auth/register`, `/auth/login` y `/users/me` (GET/PUT). Los tokens
se guardan en `sessionStorage` de la pestaña; nunca se guardan contraseñas. La
expiración o un 401 de una petición autenticada elimina la sesión y solicita
reingreso. Perfil permite actualizar nombres, apellidos y correo; los roles se
asignan en el backend. El botón «Cerrar sesión» del encabezado o Perfil envía `POST /auth/logout`
para revocar únicamente el token actual y elimina el acceso local inmediatamente.
Las respuestas privadas anteriores al cierre se descartan. Si la API falla, la
interfaz informa que no confirmó la invalidación; «Reintentar invalidación» usa
una copia del token solo en memoria y únicamente para revocarlo. Recargar/cerrar
la pestaña pierde ese reintento: no se presenta el cierre remoto como confirmado.
Un 401 al revocar indica que ese token ya no permite acceso. Otras sesiones
permanecen activas.

En Perfil se puede consultar, activar o desactivar el segundo factor TOTP. El
backend necesita `TWO_FACTOR_ENCRYPTION_KEY` configurada (véase su README).
La clave manual y la URI se muestran solo durante la configuración, sin QR ni
servicios externos; no se guardan en el navegador. La configuración vence en
10 minutos. Un código incorrecto o vencido no activa la función. Los códigos
son de un solo uso: espera al siguiente intervalo de 30 segundos después de
confirmar, ingresar o desactivar. Al ingresar, el código se solicita después
de validar correo y contraseña; no se inicia sesión hasta completar ambos pasos.
Los límites de intentos se presentan con el tiempo de espera que indica la API.

Para pruebas unitarias sin dependencias adicionales: `node --test tests/*.test.js`.


## Validación de la configuración inicial

La instalación con lockfile congelado y scripts de dependencias desactivados,
la compilación de producción y las respuestas HTTP del servidor local fueron
comprobadas con Node.js 24.22.1 y pnpm 12.15.0. La auditoría realizada el
27 de octubre de 2026 no reportó vulnerabilidades conocidas.

PrimeVue 5.0.2, ya declarado en el proyecto, emite un aviso de licencia PrimeUI
no configurada y puede mostrar un banner. Esta tarea no incorpora una licencia;
antes de publicar se deberá resolver el licenciamiento de esa dependencia.

También se comprobaron mediante renderizado en servidor siete navegaciones:
la redirección inicial, las cinco secciones y una ruta desconocida. Se verificaron
encabezados, títulos y enlaces activos. No se realizó una revisión visual en navegador.
