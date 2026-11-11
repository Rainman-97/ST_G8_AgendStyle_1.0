/* Datos de trazabilidad para cancelaciones de citas. */
USE [AgendaStyle];
GO

IF COL_LENGTH(N'dbo.Citas', N'MotivoCancelacion') IS NULL
    ALTER TABLE dbo.Citas ADD MotivoCancelacion NVARCHAR(100) NULL;
GO

IF COL_LENGTH(N'dbo.Citas', N'DescripcionCancelacion') IS NULL
    ALTER TABLE dbo.Citas ADD DescripcionCancelacion NVARCHAR(500) NULL;
GO

IF COL_LENGTH(N'dbo.Citas', N'SolucionCancelacion') IS NULL
    ALTER TABLE dbo.Citas ADD SolucionCancelacion NVARCHAR(200) NULL;
GO

IF COL_LENGTH(N'dbo.Citas', N'FechaCancelacion') IS NULL
    ALTER TABLE dbo.Citas ADD FechaCancelacion DATETIME2(0) NULL;
GO
