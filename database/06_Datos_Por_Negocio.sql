/*
  AgendaStyle - Datos aislados por negocio.
  Ejecutar después de 05_Citas_Transaccional.sql.
*/

USE [AgendaStyle];
GO

IF COL_LENGTH(N'dbo.Clientes', N'NegocioId') IS NULL
    ALTER TABLE dbo.Clientes ADD NegocioId INT NULL;
GO

IF COL_LENGTH(N'dbo.Estilistas', N'NegocioId') IS NULL
    ALTER TABLE dbo.Estilistas ADD NegocioId INT NULL;
GO

IF COL_LENGTH(N'dbo.Servicios', N'NegocioId') IS NULL
    ALTER TABLE dbo.Servicios ADD NegocioId INT NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_Clientes_Negocios')
    ALTER TABLE dbo.Clientes ADD CONSTRAINT FK_Clientes_Negocios
        FOREIGN KEY (NegocioId) REFERENCES dbo.Negocios (NegocioId);
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_Estilistas_Negocios')
    ALTER TABLE dbo.Estilistas ADD CONSTRAINT FK_Estilistas_Negocios
        FOREIGN KEY (NegocioId) REFERENCES dbo.Negocios (NegocioId);
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_Servicios_Negocios')
    ALTER TABLE dbo.Servicios ADD CONSTRAINT FK_Servicios_Negocios
        FOREIGN KEY (NegocioId) REFERENCES dbo.Negocios (NegocioId);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Clientes_Negocio' AND object_id = OBJECT_ID(N'dbo.Clientes'))
    CREATE INDEX IX_Clientes_Negocio ON dbo.Clientes (NegocioId, Activo, Apellidos, Nombres);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Estilistas_Negocio' AND object_id = OBJECT_ID(N'dbo.Estilistas'))
    CREATE INDEX IX_Estilistas_Negocio ON dbo.Estilistas (NegocioId, Activo, Apellidos, Nombres);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Servicios_Negocio' AND object_id = OBJECT_ID(N'dbo.Servicios'))
    CREATE INDEX IX_Servicios_Negocio ON dbo.Servicios (NegocioId, Activo, Nombre);
GO

IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UX_Clientes_Email' AND object_id = OBJECT_ID(N'dbo.Clientes'))
    DROP INDEX UX_Clientes_Email ON dbo.Clientes;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UX_Clientes_Negocio_Email' AND object_id = OBJECT_ID(N'dbo.Clientes'))
    CREATE UNIQUE INDEX UX_Clientes_Negocio_Email ON dbo.Clientes (NegocioId, Email) WHERE Email IS NOT NULL;
GO

IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UX_Estilistas_Email' AND object_id = OBJECT_ID(N'dbo.Estilistas'))
    DROP INDEX UX_Estilistas_Email ON dbo.Estilistas;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UX_Estilistas_Negocio_Email' AND object_id = OBJECT_ID(N'dbo.Estilistas'))
    CREATE UNIQUE INDEX UX_Estilistas_Negocio_Email ON dbo.Estilistas (NegocioId, Email) WHERE Email IS NOT NULL;
GO

SELECT TABLE_NAME AS Tabla
FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_SCHEMA = 'dbo' AND TABLE_TYPE = 'BASE TABLE'
ORDER BY TABLE_NAME;
