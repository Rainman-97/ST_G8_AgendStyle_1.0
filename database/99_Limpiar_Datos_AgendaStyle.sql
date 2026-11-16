/*
    AgendaStyle - Limpieza total de datos
    Conserva tablas, relaciones, índices y triggers.
    Elimina todos los registros de la base AgendaStyle.

    EJECUTAR SOLO SI SE DESEA EMPEZAR DESDE CERO.
*/

USE [AgendaStyle];
GO

/* Opciones requeridas por los índices filtrados de la base de datos. */
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET ARITHABORT ON;
SET NUMERIC_ROUNDABORT OFF;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

/* Tablas hijas: deben limpiarse antes de sus tablas relacionadas. */
DELETE FROM dbo.NotificacionesCitas;
DELETE FROM dbo.PrediccionesInasistencia;
DELETE FROM dbo.Recordatorios;
DELETE FROM dbo.DisponibilidadEstilistas;
DELETE FROM dbo.Citas;
DELETE FROM dbo.TokensRecuperacionClave;
DELETE FROM dbo.Clientes;
DELETE FROM dbo.Estilistas;
DELETE FROM dbo.Servicios;
DELETE FROM dbo.Usuarios;
DELETE FROM dbo.Negocios;

/* Reinicia los IDENTITY para que el siguiente registro empiece en 1. */
DBCC CHECKIDENT (N'dbo.NotificacionesCitas', RESEED, 0) WITH NO_INFOMSGS;
DBCC CHECKIDENT (N'dbo.PrediccionesInasistencia', RESEED, 0) WITH NO_INFOMSGS;
DBCC CHECKIDENT (N'dbo.Recordatorios', RESEED, 0) WITH NO_INFOMSGS;
DBCC CHECKIDENT (N'dbo.DisponibilidadEstilistas', RESEED, 0) WITH NO_INFOMSGS;
DBCC CHECKIDENT (N'dbo.Citas', RESEED, 0) WITH NO_INFOMSGS;
DBCC CHECKIDENT (N'dbo.TokensRecuperacionClave', RESEED, 0) WITH NO_INFOMSGS;
DBCC CHECKIDENT (N'dbo.Clientes', RESEED, 0) WITH NO_INFOMSGS;
DBCC CHECKIDENT (N'dbo.Estilistas', RESEED, 0) WITH NO_INFOMSGS;
DBCC CHECKIDENT (N'dbo.Servicios', RESEED, 0) WITH NO_INFOMSGS;
DBCC CHECKIDENT (N'dbo.Usuarios', RESEED, 0) WITH NO_INFOMSGS;
DBCC CHECKIDENT (N'dbo.Negocios', RESEED, 0) WITH NO_INFOMSGS;

COMMIT TRANSACTION;
GO

SELECT t.name AS Tabla, SUM(p.rows) AS Registros
FROM sys.tables AS t
INNER JOIN sys.partitions AS p ON p.object_id = t.object_id
WHERE t.schema_id = SCHEMA_ID(N'dbo')
  AND p.index_id IN (0, 1)
  AND t.name IN
  (
      N'Negocios', N'Usuarios', N'Clientes', N'Estilistas', N'Servicios',
      N'Citas', N'Recordatorios', N'DisponibilidadEstilistas',
      N'PrediccionesInasistencia', N'TokensRecuperacionClave', N'NotificacionesCitas'
  )
GROUP BY t.name
ORDER BY t.name;
