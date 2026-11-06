/*
  AgendaStyle - Preparación transaccional del módulo de citas.
  Ejecutar después de 03_Negocios_Propietarios.sql.
*/

USE [AgendaStyle];
GO

IF COL_LENGTH(N'dbo.Citas', N'NegocioId') IS NULL
BEGIN
    ALTER TABLE dbo.Citas ADD NegocioId INT NULL;
END;
GO

IF NOT EXISTS
(
    SELECT 1 FROM sys.foreign_keys
    WHERE name = N'FK_Citas_Negocios'
      AND parent_object_id = OBJECT_ID(N'dbo.Citas')
)
BEGIN
    ALTER TABLE dbo.Citas
        ADD CONSTRAINT FK_Citas_Negocios
        FOREIGN KEY (NegocioId) REFERENCES dbo.Negocios (NegocioId);
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Citas_Negocio_Horario' AND object_id = OBJECT_ID(N'dbo.Citas'))
    CREATE INDEX IX_Citas_Negocio_Horario ON dbo.Citas (NegocioId, EstilistaId, FechaHoraInicio, FechaHoraFin);
GO

SELECT CitaId, NegocioId, ClienteId, EstilistaId, ServicioId, FechaHoraInicio, FechaHoraFin, Estado
FROM dbo.Citas
ORDER BY FechaHoraInicio;
