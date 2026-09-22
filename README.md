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
- `dotenv` para variables de entorno
- `cors` para permitir la comunicación con el frontend

## Estructura del proyecto

```text
Agenda_Style/
├── index.html                         # Panel visual de AgendaStyle
├── styles.css                         # Estilos y diseño responsive
├── script.js                          # Interacciones del prototipo
├── Agendastyle_logo.png               # Logo principal
├── favicon.png                        # Icono de la pestaña del navegador
├── database/
│   └── 01_AgendaStyle.sql             # Base de datos, tablas, relaciones y seeds
├── backend/
│   ├── package.json                   # Dependencias y scripts del backend
│   ├── .env.example                   # Plantilla de configuración
│   ├── .gitignore                     # Archivos locales del backend
│   └── src/
│       ├── app.js                     # Servidor Express
│       ├── config/
│       │   └── database.js             # Pool de conexión a SQL Server
│       └── routes/
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
```

### Tablas

- **Clientes:** nombres, apellidos, teléfono, correo y estado del cliente.
- **Estilistas:** datos de contacto, especialidad y estado activo.
- **Servicios:** catálogo de servicios, duración en minutos y precio.
- **Citas:** cliente, estilista, servicio, fecha, hora de inicio, hora de finalización, estado y observaciones.
- **Recordatorios:** cita asociada, tipo de mensaje, fecha programada, estado y fecha de envío.

El archivo SQL también incluye datos iniciales de clientes, estilistas, servicios, citas y recordatorios para comprobar las relaciones.

## Crear la base de datos

1. Instala SQL Server y SQL Server Management Studio.
2. Abre el archivo `database/01_AgendaStyle.sql` en SSMS.
3. Ejecuta el script completo con **Execute**.
4. Verifica la base de datos `AgendaStyle` y las tablas dentro del esquema `dbo`.

El script crea la base de datos si no existe, crea las tablas y carga datos de prueba. Las tablas y los registros iniciales tienen validaciones para evitar duplicados al ejecutar nuevamente el archivo.

## Configurar y ejecutar el backend

Desde la carpeta raíz del proyecto:

```powershell
cd backend
Copy-Item .env.example .env
npm install
```

Edita el archivo `.env` con los datos de tu instancia de SQL Server:

```env
PORT=3000
DB_SERVER=localhost
DB_PORT=1433
DB_NAME=AgendaStyle
DB_USER=sa
DB_PASSWORD=TuPasswordAqui
DB_ENCRYPT=false
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
3. Conectar el formulario del frontend con la API.
4. Agregar consultas para agenda diaria e historial por cliente.
5. Implementar el envío y seguimiento de recordatorios.
6. Añadir autenticación y perfiles de usuario.
7. Crear pruebas para las operaciones transaccionales.

## Alcance actual

El proyecto se encuentra en una etapa inicial de construcción. La base de datos y el backend ya tienen una estructura organizada, pero no se consideran terminadas las funcionalidades CRUD ni la integración completa con la interfaz.
