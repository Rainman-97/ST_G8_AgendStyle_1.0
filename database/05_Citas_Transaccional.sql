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

/* Evita cruces dentro del mismo negocio y no mezcla datos antiguos de otro negocio. */
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
            ON c.NegocioId = i.NegocioId
            AND c.EstilistaId = i.EstilistaId
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

SELECT CitaId, NegocioId, ClienteId, EstilistaId, ServicioId, FechaHoraInicio, FechaHoraFin, Estado
FROM dbo.Citas
ORDER BY FechaHoraInicio;
