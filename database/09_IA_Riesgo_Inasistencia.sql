/* Persistencia de las predicciones de riesgo de inasistencia. */
USE [AgendaStyle];
GO

IF OBJECT_ID(N'dbo.PrediccionesInasistencia', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.PrediccionesInasistencia
    (
        PrediccionId INT IDENTITY(1,1) NOT NULL,
        CitaId INT NOT NULL,
        InasistenciasPrevias DECIMAL(6,4) NOT NULL,
        AntelacionReserva DECIMAL(6,4) NOT NULL,
        FranjaHoraria DECIMAL(6,4) NOT NULL,
        ClienteNuevo DECIMAL(6,4) NOT NULL,
        Probabilidad DECIMAL(6,4) NOT NULL,
        NivelRiesgo VARCHAR(10) NOT NULL,
        AccionRecordatorio NVARCHAR(160) NOT NULL,
        ModeloVersion VARCHAR(30) NOT NULL,
        FechaPrediccion DATETIME2(0) NOT NULL CONSTRAINT DF_Predicciones_Fecha DEFAULT SYSDATETIME(),
        CONSTRAINT PK_PrediccionesInasistencia PRIMARY KEY (PrediccionId),
        CONSTRAINT FK_Predicciones_Citas FOREIGN KEY (CitaId) REFERENCES dbo.Citas (CitaId),
        CONSTRAINT UQ_Predicciones_Cita UNIQUE (CitaId),
        CONSTRAINT CK_Predicciones_Probabilidad CHECK (Probabilidad >= 0 AND Probabilidad <= 1),
        CONSTRAINT CK_Predicciones_Nivel CHECK (NivelRiesgo IN ('Bajo', 'Medio', 'Alto'))
    );
END;
GO
