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

Los destinos están centralizados en `src/router/navigation.js`:

| Ruta | Sección |
| --- | --- |
| `/home` | Inicio |
| `/realState` | Inmobiliario |
| `/messaging` | Mensajería |
| `/products` | Mis productos |
| `/profile` | Perfil |

La ruta `/` redirige a `/home`. Las rutas desconocidas muestran una página 404
con enlace al inicio. Las secciones son vistas iniciales; la autenticación, los
inmuebles, las notificaciones y las simulaciones se integrarán en sus tareas.

El router utiliza historial HTML5 y respeta la base de Vite. En el servidor de
publicación se debe devolver `index.html` para rutas de la aplicación que no
correspondan a archivos, para permitir abrir y recargar enlaces directamente.

El backend no es necesario para arrancar esta base. La API local prevista es
`http://localhost:8080/api/v1`; aún no hay cliente HTTP ni llamadas al servidor.

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
