/*
  AgendaStyle - Relación entre el propietario y su negocio.
  Ejecutar después de 02_Usuarios_Auth.sql.
*/

USE [AgendaStyle];
GO

IF OBJECT_ID(N'dbo.Negocios', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Negocios
    (
        NegocioId        INT IDENTITY(1,1) NOT NULL,
        NombreComercial  NVARCHAR(120) NOT NULL,
        TipoNegocio      VARCHAR(20) NOT NULL,
        Telefono         VARCHAR(20) NOT NULL,
        Direccion        NVARCHAR(180) NULL,
        Email            VARCHAR(150) NULL,
        FechaRegistro    DATETIME2(0) NOT NULL CONSTRAINT DF_Negocios_FechaRegistro DEFAULT SYSDATETIME(),
        Activo           BIT NOT NULL CONSTRAINT DF_Negocios_Activo DEFAULT 1,

        CONSTRAINT PK_Negocios PRIMARY KEY (NegocioId),
        CONSTRAINT CK_Negocios_Tipo CHECK (TipoNegocio IN ('Peluquería', 'Barbería', 'Peluquería y barbería'))
    );
END;
GO

IF COL_LENGTH(N'dbo.Usuarios', N'NegocioId') IS NULL
BEGIN
    ALTER TABLE dbo.Usuarios ADD NegocioId INT NULL;
END;
GO

IF NOT EXISTS
(
    SELECT 1
    FROM sys.foreign_keys
    WHERE name = N'FK_Usuarios_Negocios'
      AND parent_object_id = OBJECT_ID(N'dbo.Usuarios')
)
BEGIN
    ALTER TABLE dbo.Usuarios
        ADD CONSTRAINT FK_Usuarios_Negocios
        FOREIGN KEY (NegocioId) REFERENCES dbo.Negocios (NegocioId);
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Usuarios_Negocio' AND object_id = OBJECT_ID(N'dbo.Usuarios'))
    CREATE INDEX IX_Usuarios_Negocio ON dbo.Usuarios (NegocioId, Rol);
GO

SELECT
    u.UsuarioId,
    u.Nombres,
    u.Apellidos,
    u.Email,
    u.Rol,
    n.NombreComercial,
    n.TipoNegocio
FROM dbo.Usuarios AS u
LEFT JOIN dbo.Negocios AS n ON n.NegocioId = u.NegocioId;

SELECT TABLE_NAME AS Tabla
FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_SCHEMA = 'dbo'
  AND TABLE_TYPE = 'BASE TABLE'
ORDER BY TABLE_NAME;
