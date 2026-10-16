

IF DB_ID(N'AgendaStyle') IS NULL
BEGIN
    CREATE DATABASE [AgendaStyle];
END;
GO

USE [AgendaStyle];
GO


IF OBJECT_ID(N'dbo.Clientes', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Clientes
    (
        ClienteId       INT IDENTITY(1,1) NOT NULL,
        Nombres         NVARCHAR(80) NOT NULL,
        Apellidos       NVARCHAR(80) NOT NULL,
        Telefono        VARCHAR(20) NOT NULL,
        Email           VARCHAR(150) NULL,
        FechaRegistro   DATETIME2(0) NOT NULL CONSTRAINT DF_Clientes_FechaRegistro DEFAULT SYSDATETIME(),
        Activo          BIT NOT NULL CONSTRAINT DF_Clientes_Activo DEFAULT 1,

        CONSTRAINT PK_Clientes PRIMARY KEY (ClienteId)
    );
END;
GO

IF OBJECT_ID(N'dbo.Estilistas', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Estilistas
    (
        EstilistaId     INT IDENTITY(1,1) NOT NULL,
        Nombres         NVARCHAR(80) NOT NULL,
        Apellidos       NVARCHAR(80) NOT NULL,
        Especialidad    NVARCHAR(80) NOT NULL,
        Telefono        VARCHAR(20) NULL,
        Email           VARCHAR(150) NULL,
        Activo          BIT NOT NULL CONSTRAINT DF_Estilistas_Activo DEFAULT 1,

        CONSTRAINT PK_Estilistas PRIMARY KEY (EstilistaId)
    );
END;
GO

IF OBJECT_ID(N'dbo.Servicios', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Servicios
    (
        ServicioId          INT IDENTITY(1,1) NOT NULL,
        Nombre              NVARCHAR(100) NOT NULL,
        Descripcion         NVARCHAR(250) NULL,
        DuracionMinutos     SMALLINT NOT NULL,
        Precio              DECIMAL(10,2) NOT NULL,
        Activo              BIT NOT NULL CONSTRAINT DF_Servicios_Activo DEFAULT 1,

        CONSTRAINT PK_Servicios PRIMARY KEY (ServicioId),
        CONSTRAINT UQ_Servicios_Nombre UNIQUE (Nombre),
        CONSTRAINT CK_Servicios_Duracion CHECK (DuracionMinutos > 0),
        CONSTRAINT CK_Servicios_Precio CHECK (Precio >= 0)
    );
END;
GO

IF OBJECT_ID(N'dbo.Citas', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Citas
    (
        CitaId              INT IDENTITY(1,1) NOT NULL,
        ClienteId           INT NOT NULL,
        EstilistaId         INT NOT NULL,
        ServicioId          INT NOT NULL,
        FechaHoraInicio     DATETIME2(0) NOT NULL,
        FechaHoraFin        DATETIME2(0) NOT NULL,
        Estado              VARCHAR(20) NOT NULL CONSTRAINT DF_Citas_Estado DEFAULT 'Pendiente',
        Observaciones       NVARCHAR(300) NULL,
        FechaCreacion       DATETIME2(0) NOT NULL CONSTRAINT DF_Citas_FechaCreacion DEFAULT SYSDATETIME(),

        CONSTRAINT PK_Citas PRIMARY KEY (CitaId),
        CONSTRAINT FK_Citas_Clientes FOREIGN KEY (ClienteId) REFERENCES dbo.Clientes (ClienteId),
        CONSTRAINT FK_Citas_Estilistas FOREIGN KEY (EstilistaId) REFERENCES dbo.Estilistas (EstilistaId),
        CONSTRAINT FK_Citas_Servicios FOREIGN KEY (ServicioId) REFERENCES dbo.Servicios (ServicioId),
        CONSTRAINT CK_Citas_RangoHorario CHECK (FechaHoraFin > FechaHoraInicio),
        CONSTRAINT CK_Citas_Estado CHECK (Estado IN ('Pendiente', 'Confirmada', 'Atendida', 'Cancelada', 'No asistió'))
    );
END;
GO

IF OBJECT_ID(N'dbo.Recordatorios', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Recordatorios
    (
        RecordatorioId      INT IDENTITY(1,1) NOT NULL,
        CitaId              INT NOT NULL,
        Tipo                VARCHAR(20) NOT NULL,
        ProgramadoPara      DATETIME2(0) NOT NULL,
        Enviado             BIT NOT NULL CONSTRAINT DF_Recordatorios_Enviado DEFAULT 0,
        FechaEnvio          DATETIME2(0) NULL,
        Estado              VARCHAR(20) NOT NULL CONSTRAINT DF_Recordatorios_Estado DEFAULT 'Pendiente',

        CONSTRAINT PK_Recordatorios PRIMARY KEY (RecordatorioId),
        CONSTRAINT FK_Recordatorios_Citas FOREIGN KEY (CitaId) REFERENCES dbo.Citas (CitaId),
        CONSTRAINT UQ_Recordatorios_Cita_Tipo UNIQUE (CitaId, Tipo),
        CONSTRAINT CK_Recordatorios_Tipo CHECK (Tipo IN ('SMS', 'Email', 'WhatsApp')),
        CONSTRAINT CK_Recordatorios_Estado CHECK (Estado IN ('Pendiente', 'Enviado', 'Fallido'))
    );
END;
GO


IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UX_Clientes_Email' AND object_id = OBJECT_ID(N'dbo.Clientes'))
    CREATE UNIQUE INDEX UX_Clientes_Email ON dbo.Clientes (Email) WHERE Email IS NOT NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UX_Estilistas_Email' AND object_id = OBJECT_ID(N'dbo.Estilistas'))
    CREATE UNIQUE INDEX UX_Estilistas_Email ON dbo.Estilistas (Email) WHERE Email IS NOT NULL;
GO


IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Citas_Estilista_Horario' AND object_id = OBJECT_ID(N'dbo.Citas'))
    CREATE INDEX IX_Citas_Estilista_Horario ON dbo.Citas (EstilistaId, FechaHoraInicio, FechaHoraFin);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Citas_Cliente' AND object_id = OBJECT_ID(N'dbo.Citas'))
    CREATE INDEX IX_Citas_Cliente ON dbo.Citas (ClienteId, FechaHoraInicio);
GO


CREATE OR ALTER TRIGGER dbo.trg_Citas_EvitarCrucesHorario
ON dbo.Citas
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    IF EXISTS
    (
        SELECT 1
        FROM inserted AS i
        INNER JOIN dbo.Citas AS c
            ON c.EstilistaId = i.EstilistaId
            AND c.CitaId <> i.CitaId
            AND c.Estado NOT IN ('Cancelada', 'No asistió')
            AND i.FechaHoraInicio < c.FechaHoraFin
            AND i.FechaHoraFin > c.FechaHoraInicio
        WHERE i.Estado NOT IN ('Cancelada', 'No asistió')
    )
    BEGIN
        RAISERROR('No es posible guardar la cita: el estilista ya tiene una cita en ese horario.', 16, 1);
        ROLLBACK TRANSACTION;
    END;
END;
GO


IF NOT EXISTS (SELECT 1 FROM dbo.Clientes WHERE Email = 'camila.rojas@ejemplo.com')
    INSERT INTO dbo.Clientes (Nombres, Apellidos, Telefono, Email)
    VALUES (N'Camila', N'Rojas', '3001234567', 'camila.rojas@ejemplo.com');

IF NOT EXISTS (SELECT 1 FROM dbo.Clientes WHERE Email = 'juan.lopez@ejemplo.com')
    INSERT INTO dbo.Clientes (Nombres, Apellidos, Telefono, Email)
    VALUES (N'Juan David', N'López', '3012345678', 'juan.lopez@ejemplo.com');

IF NOT EXISTS (SELECT 1 FROM dbo.Clientes WHERE Email = 'maria.valentina@ejemplo.com')
    INSERT INTO dbo.Clientes (Nombres, Apellidos, Telefono, Email)
    VALUES (N'María Valentina', N'Gómez', '3023456789', 'maria.valentina@ejemplo.com');

IF NOT EXISTS (SELECT 1 FROM dbo.Estilistas WHERE Email = 'laura.martinez@agendastyle.com')
    INSERT INTO dbo.Estilistas (Nombres, Apellidos, Especialidad, Telefono, Email)
    VALUES (N'Laura', N'Martínez', N'Estilista senior', '3101234567', 'laura.martinez@agendastyle.com');

IF NOT EXISTS (SELECT 1 FROM dbo.Estilistas WHERE Email = 'andres.perez@agendastyle.com')
    INSERT INTO dbo.Estilistas (Nombres, Apellidos, Especialidad, Telefono, Email)
    VALUES (N'Andrés', N'Pérez', N'Barbero', '3112345678', 'andres.perez@agendastyle.com');

IF NOT EXISTS (SELECT 1 FROM dbo.Estilistas WHERE Email = 'julia.gomez@agendastyle.com')
    INSERT INTO dbo.Estilistas (Nombres, Apellidos, Especialidad, Telefono, Email)
    VALUES (N'Julia', N'Gómez', N'Estilista', '3123456789', 'julia.gomez@agendastyle.com');

IF NOT EXISTS (SELECT 1 FROM dbo.Servicios WHERE Nombre = N'Corte + cepillado')
    INSERT INTO dbo.Servicios (Nombre, Descripcion, DuracionMinutos, Precio)
    VALUES (N'Corte + cepillado', N'Corte y finalizado con cepillado.', 60, 45000);

IF NOT EXISTS (SELECT 1 FROM dbo.Servicios WHERE Nombre = N'Corte clásico')
    INSERT INTO dbo.Servicios (Nombre, Descripcion, DuracionMinutos, Precio)
    VALUES (N'Corte clásico', N'Corte tradicional para caballero.', 45, 30000);

IF NOT EXISTS (SELECT 1 FROM dbo.Servicios WHERE Nombre = N'Coloración')
    INSERT INTO dbo.Servicios (Nombre, Descripcion, DuracionMinutos, Precio)
    VALUES (N'Coloración', N'Aplicación de color y tratamiento básico.', 120, 120000);

IF NOT EXISTS (SELECT 1 FROM dbo.Servicios WHERE Nombre = N'Barba + corte')
    INSERT INTO dbo.Servicios (Nombre, Descripcion, DuracionMinutos, Precio)
    VALUES (N'Barba + corte', N'Corte clásico más arreglo de barba.', 60, 40000);
GO

DECLARE @CamilaId INT = (SELECT ClienteId FROM dbo.Clientes WHERE Email = 'camila.rojas@ejemplo.com');
DECLARE @JuanId INT = (SELECT ClienteId FROM dbo.Clientes WHERE Email = 'juan.lopez@ejemplo.com');
DECLARE @MariaId INT = (SELECT ClienteId FROM dbo.Clientes WHERE Email = 'maria.valentina@ejemplo.com');
DECLARE @LauraId INT = (SELECT EstilistaId FROM dbo.Estilistas WHERE Email = 'laura.martinez@agendastyle.com');
DECLARE @AndresId INT = (SELECT EstilistaId FROM dbo.Estilistas WHERE Email = 'andres.perez@agendastyle.com');
DECLARE @CorteCepilladoId INT = (SELECT ServicioId FROM dbo.Servicios WHERE Nombre = N'Corte + cepillado');
DECLARE @CorteClasicoId INT = (SELECT ServicioId FROM dbo.Servicios WHERE Nombre = N'Corte clásico');
DECLARE @ColoracionId INT = (SELECT ServicioId FROM dbo.Servicios WHERE Nombre = N'Coloración');

IF NOT EXISTS (SELECT 1 FROM dbo.Citas WHERE ClienteId = @CamilaId AND FechaHoraInicio = '2026-09-25T09:00:00')
    INSERT INTO dbo.Citas (ClienteId, EstilistaId, ServicioId, FechaHoraInicio, FechaHoraFin, Estado, Observaciones)
    VALUES (@CamilaId, @LauraId, @CorteCepilladoId, '2026-09-25T09:00:00', '2026-09-25T10:00:00', 'Confirmada', N'Cita de prueba desde el script inicial.');

IF NOT EXISTS (SELECT 1 FROM dbo.Citas WHERE ClienteId = @JuanId AND FechaHoraInicio = '2026-09-25T10:30:00')
    INSERT INTO dbo.Citas (ClienteId, EstilistaId, ServicioId, FechaHoraInicio, FechaHoraFin, Estado)
    VALUES (@JuanId, @AndresId, @CorteClasicoId, '2026-09-25T10:30:00', '2026-09-25T11:15:00', 'Confirmada');

IF NOT EXISTS (SELECT 1 FROM dbo.Citas WHERE ClienteId = @MariaId AND FechaHoraInicio = '2026-09-25T12:00:00')
    INSERT INTO dbo.Citas (ClienteId, EstilistaId, ServicioId, FechaHoraInicio, FechaHoraFin, Estado)
    VALUES (@MariaId, @LauraId, @ColoracionId, '2026-09-25T12:00:00', '2026-09-25T14:00:00', 'Pendiente');
GO

DECLARE @CitaCamilaId INT =
(
    SELECT CitaId
    FROM dbo.Citas c
    INNER JOIN dbo.Clientes cl ON cl.ClienteId = c.ClienteId
    WHERE cl.Email = 'camila.rojas@ejemplo.com'
      AND c.FechaHoraInicio = '2026-09-25T09:00:00'
);

IF NOT EXISTS (SELECT 1 FROM dbo.Recordatorios WHERE CitaId = @CitaCamilaId AND Tipo = 'WhatsApp')
    INSERT INTO dbo.Recordatorios (CitaId, Tipo, ProgramadoPara, Estado)
    VALUES (@CitaCamilaId, 'WhatsApp', '2026-09-24T09:00:00', 'Pendiente');
GO


SELECT TABLE_NAME AS Tabla
FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_TYPE = 'BASE TABLE'
  AND TABLE_SCHEMA = 'dbo'
ORDER BY TABLE_NAME;
