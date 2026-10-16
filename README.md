# AgendaStyle

AgendaStyle es un sistema web para la gestión de citas en peluquerías y barberías. El proyecto busca centralizar clientes, servicios, estilistas, disponibilidad y recordatorios en una solución sencilla para pequeños negocios de belleza.

## Estado actual del proyecto

El repositorio reúne el trabajo realizado hasta ahora en las primeras fases:

- **Fase 1 — Prototipo visual:** interfaz HTML, CSS y JavaScript con el panel administrativo de AgendaStyle.
- **Fase 2 — Modelo y documentación:** definición del dominio, necesidades del sistema y entidades principales.
- **Fase 3 — Base técnica inicial:** script de base de datos para SQL Server y estructura inicial de backend con Node.js y Express.

En esta etapa todavía no se han implementado todas las operaciones CRUD ni la conexión de la interfaz con la API. El objetivo actual es dejar lista la estructura sobre la cual se construirán las operaciones transaccionales.

## Funcionalidades representadas en el prototipo

La interfaz visual incluye:

- Panel de resumen con citas del día, ingresos estimados y clientes registrados.
- Calendario mensual y agenda de próximas citas.
- Estados de las citas: confirmada y pendiente.
- Visualización del equipo de estilistas.
- Indicador de recordatorios enviados.
- Formulario modal para simular la creación de una nueva cita.
- Diseño responsive para escritorio y dispositivos móviles.
- Identidad visual de AgendaStyle con logo y favicon en formato PNG.

La vista `auth.html` permite alternar entre iniciar sesión y crear una cuenta. El registro solicita nombres, apellidos, correo, clave y confirmación de clave, además del nombre, tipo, teléfono y dirección opcional del negocio. Incluye animaciones de entrada, transición entre formularios, indicador de carga, mensajes de éxito/error y botón para mostrar u ocultar la clave.

El primer registro crea el negocio y asigna al propietario el rol `Administrador`. El rol no se puede elegir libremente desde el formulario público.

## Tecnologías

### Prototipo frontend

- HTML5
- CSS3
- JavaScript vanilla
- Diseño responsive

### Base de datos

- Microsoft SQL Server
- SQL Server Management Studio (SSMS)
- Restricciones `PRIMARY KEY`, `FOREIGN KEY`, `CHECK`, `DEFAULT` y `UNIQUE`.
- Índices para las consultas principales.
- Trigger para evitar cruces de horario de un mismo estilista.

### Backend inicial

- Node.js 18 o superior
- Express
- `mssql` para la conexión con SQL Server
- `msnodesqlv8` para autenticación integrada de Windows
- `dotenv` para variables de entorno
- `cors` para permitir la comunicación con el frontend

## Estructura del proyecto

```text
Agenda_Style/
├── index.html                         # Panel visual de AgendaStyle
├── auth.html                          # Interfaz de registro e inicio de sesión
├── auth.css                           # Estilos y animaciones de autenticación
├── auth.js                             # Validaciones y conexión con la API de auth
├── styles.css                         # Estilos y diseño responsive
├── script.js                          # Interacciones del prototipo
├── Agendastyle_logo.png               # Logo principal
├── favicon.png                        # Icono de la pestaña del navegador
├── database/
│   ├── 01_AgendaStyle.sql             # Base de datos, tablas, relaciones y seeds
│   ├── 02_Usuarios_Auth.sql            # Migración para registro e inicio de sesión
│   └── 03_Negocios_Propietarios.sql    # Negocio y relación con el propietario
├── backend/
│   ├── package.json                   # Dependencias y scripts del backend
│   ├── scripts/
│   │   └── migrate.js                 # Ejecuta migraciones sobre AgendaStyle
│   ├── .env.example                   # Plantilla de configuración
│   ├── .gitignore                     # Archivos locales del backend
│   └── src/
│       ├── app.js                     # Servidor Express
│       ├── config/
│       │   └── database.js             # Pool de conexión a SQL Server
│       ├── middleware/
│       │   └── auth.middleware.js      # Validación de tokens JWT
│       └── routes/
│           ├── auth.routes.js          # Registro, login y usuario actual
│           └── health.routes.js        # Ruta de verificación de conexión
└── README.md
```

## Modelo de datos inicial

El modelo implementado conserva las entidades relacionadas con el dominio de AgendaStyle:

```text
Clientes 1 ──── N Citas N ──── 1 Estilistas
                         │
                         └──── N ──── 1 Servicios

Citas 1 ──── N Recordatorios

Usuarios: cuentas de acceso para la autenticación del sistema.
Usuarios N ──── 1 Negocios
```

### Tablas

- **Clientes:** nombres, apellidos, teléfono, correo y estado del cliente.
- **Estilistas:** datos de contacto, especialidad y estado activo.
- **Servicios:** catálogo de servicios, duración en minutos y precio.
- **Citas:** cliente, estilista, servicio, fecha, hora de inicio, hora de finalización, estado y observaciones.
- **Recordatorios:** cita asociada, tipo de mensaje, fecha programada, estado y fecha de envío.
- **Usuarios:** nombres, apellidos, email, hash de contraseña, rol, estado y último acceso.
- **Negocios:** nombre comercial, tipo de negocio, teléfono, dirección y estado.

El archivo SQL también incluye datos iniciales de clientes, estilistas, servicios, citas y recordatorios para comprobar las relaciones.

## Crear la base de datos

1. Instala SQL Server y SQL Server Management Studio.
2. Abre el archivo `database/01_AgendaStyle.sql` en SSMS.
3. Ejecuta el script completo con **Execute**.
4. Verifica la base de datos `AgendaStyle` y las tablas dentro del esquema `dbo`.

El script crea la base de datos si no existe, crea las tablas y carga datos de prueba. Las tablas y los registros iniciales tienen validaciones para evitar duplicados al ejecutar nuevamente el archivo.

## Crear usuarios y autenticación

Como la base de datos ya fue creada, ejecuta ahora el script de migración:

1. Abre `database/02_Usuarios_Auth.sql` en SQL Server Management Studio.
2. Verifica que la base seleccionada sea `AgendaStyle`.
3. Ejecuta el script completo.

Este archivo crea la tabla `Usuarios` con nombre, email, contraseña protegida, rol, estado, fecha de registro y último acceso. También crea un índice único para evitar emails duplicados.

Después ejecuta `database/03_Negocios_Propietarios.sql`. Este script crea la tabla `Negocios` y relaciona cada usuario con su negocio mediante `NegocioId`.

Las contraseñas no se almacenan en texto plano: el backend las transforma mediante `bcryptjs` antes de guardarlas.

## Configurar y ejecutar el backend

Desde la carpeta raíz del proyecto:

```powershell
cd backend
Copy-Item .env.example .env
npm install
```

Para crear las tablas de autenticación y negocio sobre la base existente:

```powershell
npm run migrate
```

Edita el archivo `.env` con los datos de tu instancia de SQL Server:

```env
PORT=3000
DB_AUTH=windows
DB_SERVER=localhost
DB_PORT=1433
DB_NAME=AgendaStyle
DB_DRIVER=ODBC Driver 18 for SQL Server
DB_ENCRYPT=true
DB_TRUST_SERVER_CERTIFICATE=true
```

Inicia el servidor:

```powershell
npm start
```

Para desarrollo puedes utilizar:

```powershell
npm run dev
```

## Rutas disponibles

El backend actual contiene únicamente rutas de verificación y estructura inicial:

- `GET http://localhost:3000/api` — información básica de la API.
- `GET http://localhost:3000/api/health` — verifica el estado del backend y la conexión con SQL Server.
- `POST http://localhost:3000/api/auth/register` — registra un usuario nuevo.
- `POST http://localhost:3000/api/auth/login` — valida credenciales y devuelve un token JWT.
- `GET http://localhost:3000/api/auth/me` — consulta el usuario autenticado usando un token Bearer.

### Registrar un usuario

```json
POST /api/auth/register
Content-Type: application/json

{
  "nombres": "Hemer Santiago",
  "apellidos": "Pérez Nieves",
  "email": "hemer@example.com",
  "password": "Agenda123!"
}
```

### Iniciar sesión

```json
POST /api/auth/login
Content-Type: application/json

{
  "email": "hemer@example.com",
  "password": "Agenda123!"
}
```

La respuesta incluye un `token`. Para consultar `/api/auth/me`, envíalo así:

```text
Authorization: Bearer <token>
```

Una respuesta exitosa de `/api/health` tendrá una estructura similar a:

```json
{
  "ok": true,
  "service": "AgendaStyle API",
  "database": {
    "databaseName": "AgendaStyle"
  }
}
```

## Abrir el prototipo visual

La interfaz puede abrirse directamente ejecutando `index.html` en el navegador. También puede servirse mediante una extensión como Live Server en Visual Studio Code.

La interfaz utiliza datos visuales de ejemplo y todavía no consulta la base de datos. La integración frontend-backend se realizará cuando se implementen los primeros endpoints transaccionales.

## Próximos pasos

1. Crear endpoints para clientes, servicios, estilistas y citas.
2. Implementar la transacción de creación de una cita con validación de disponibilidad.
3. Conectar formularios de registro e inicio de sesión del frontend con la API.
4. Conectar el dashboard con la información real de SQL Server.
5. Agregar consultas para agenda diaria e historial por cliente.
6. Implementar el envío y seguimiento de recordatorios.
7. Añadir autorización por roles y crear pruebas transaccionales.

## Alcance actual

El proyecto se encuentra en una etapa inicial de construcción. La base de datos y el backend ya tienen una estructura organizada, pero no se consideran terminadas las funcionalidades CRUD ni la integración completa con la interfaz.
