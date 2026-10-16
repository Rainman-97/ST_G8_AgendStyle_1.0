

USE [AgendaStyle];
GO

IF OBJECT_ID(N'dbo.Usuarios', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Usuarios
    (
        UsuarioId       INT IDENTITY(1,1) NOT NULL,
        Nombres         NVARCHAR(80) NOT NULL,
        Apellidos       NVARCHAR(80) NOT NULL,
        Email           VARCHAR(150) NOT NULL,
        PasswordHash    VARCHAR(255) NOT NULL,
        Rol             VARCHAR(20) NOT NULL CONSTRAINT DF_Usuarios_Rol DEFAULT 'Cliente',
        Activo          BIT NOT NULL CONSTRAINT DF_Usuarios_Activo DEFAULT 1,
        FechaRegistro   DATETIME2(0) NOT NULL CONSTRAINT DF_Usuarios_FechaRegistro DEFAULT SYSDATETIME(),
        UltimoAcceso    DATETIME2(0) NULL,

        CONSTRAINT PK_Usuarios PRIMARY KEY (UsuarioId),
        CONSTRAINT CK_Usuarios_Rol CHECK (Rol IN ('Administrador', 'Estilista', 'Cliente'))
    );
END;
GO

IF NOT EXISTS
(
    SELECT 1
    FROM sys.indexes
    WHERE name = N'UX_Usuarios_Email'
      AND object_id = OBJECT_ID(N'dbo.Usuarios')
)
BEGIN
    CREATE UNIQUE INDEX UX_Usuarios_Email ON dbo.Usuarios (Email);
END;
GO

SELECT UsuarioId, Nombres, Apellidos, Email, Rol, Activo, FechaRegistro, UltimoAcceso
FROM dbo.Usuarios;
