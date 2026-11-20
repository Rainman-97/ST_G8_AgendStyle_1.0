/* Permite guardar correctamente "Peluquería y barbería" en SQL Server. */
USE [AgendaStyle];
GO

IF COL_LENGTH(N'dbo.Negocios', N'TipoNegocio') IS NOT NULL
BEGIN
    ALTER TABLE dbo.Negocios ALTER COLUMN TipoNegocio VARCHAR(30) NOT NULL;
END;
GO
