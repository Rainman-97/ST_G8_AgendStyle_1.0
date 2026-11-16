USE [AgendaStyle];
GO

IF OBJECT_ID(N'dbo.NotificacionesCitas', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.NotificacionesCitas
    (
        NotificacionId      INT IDENTITY(1,1) NOT NULL,
        CitaId              INT NOT NULL,
        Canal               VARCHAR(15) NOT NULL,
        Destino             VARCHAR(30) NOT NULL,
        Mensaje             NVARCHAR(1000) NOT NULL,
        Estado               VARCHAR(20) NOT NULL CONSTRAINT DF_Notificaciones_Estado DEFAULT 'Pendiente',
        Proveedor            VARCHAR(30) NOT NULL CONSTRAINT DF_Notificaciones_Proveedor DEFAULT 'Mock',
        ProveedorMessageId   VARCHAR(80) NULL,
        ErrorDetalle         NVARCHAR(500) NULL,
        CreadoEn             DATETIME2(0) NOT NULL CONSTRAINT DF_Notificaciones_Creado DEFAULT SYSDATETIME(),
        EnviadoEn            DATETIME2(0) NULL,

        CONSTRAINT PK_NotificacionesCitas PRIMARY KEY (NotificacionId),
        CONSTRAINT FK_Notificaciones_Citas FOREIGN KEY (CitaId) REFERENCES dbo.Citas (CitaId),
        CONSTRAINT CK_Notificaciones_Canal CHECK (Canal IN ('WhatsApp', 'SMS')),
        CONSTRAINT CK_Notificaciones_Estado CHECK (Estado IN ('Pendiente', 'Enviado', 'Fallido', 'Simulado'))
    );
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Notificaciones_Cita' AND object_id = OBJECT_ID(N'dbo.NotificacionesCitas'))
    CREATE INDEX IX_Notificaciones_Cita ON dbo.NotificacionesCitas (CitaId, CreadoEn DESC);
GO
