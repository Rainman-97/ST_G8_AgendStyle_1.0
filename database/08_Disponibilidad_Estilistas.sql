/* Disponibilidad diaria del equipo. */
USE [AgendaStyle];
GO

IF OBJECT_ID(N'dbo.DisponibilidadEstilistas', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.DisponibilidadEstilistas
    (
        DisponibilidadId INT IDENTITY(1,1) NOT NULL,
        EstilistaId INT NOT NULL,
        Fecha DATE NOT NULL,
        Estado VARCHAR(20) NOT NULL CONSTRAINT DF_Disponibilidad_Estado DEFAULT 'Disponible',
        Observaciones NVARCHAR(250) NULL,
        FechaActualizacion DATETIME2(0) NOT NULL CONSTRAINT DF_Disponibilidad_Fecha DEFAULT SYSDATETIME(),
        CONSTRAINT PK_DisponibilidadEstilistas PRIMARY KEY (DisponibilidadId),
        CONSTRAINT FK_Disponibilidad_Estilistas FOREIGN KEY (EstilistaId) REFERENCES dbo.Estilistas (EstilistaId),
        CONSTRAINT UQ_Disponibilidad_Estilista_Fecha UNIQUE (EstilistaId, Fecha),
        CONSTRAINT CK_Disponibilidad_Estado CHECK (Estado IN ('Disponible', 'Descanso', 'No trabaja'))
    );
END;
GO
