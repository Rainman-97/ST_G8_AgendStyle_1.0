USE [AgendaStyle];
GO

IF OBJECT_ID(N'dbo.TokensRecuperacionClave', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.TokensRecuperacionClave
    (
        TokenId       INT IDENTITY(1,1) NOT NULL,
        UsuarioId     INT NOT NULL,
        TokenHash     CHAR(64) NOT NULL,
        ExpiraEn      DATETIME2(0) NOT NULL,
        UsadoEn       DATETIME2(0) NULL,
        CreadoEn      DATETIME2(0) NOT NULL CONSTRAINT DF_TokensRecuperacion_Creado DEFAULT SYSDATETIME(),

        CONSTRAINT PK_TokensRecuperacionClave PRIMARY KEY (TokenId),
        CONSTRAINT FK_TokensRecuperacion_Usuarios FOREIGN KEY (UsuarioId) REFERENCES dbo.Usuarios (UsuarioId),
        CONSTRAINT UQ_TokensRecuperacion_Hash UNIQUE (TokenHash)
    );
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_TokensRecuperacion_Usuario' AND object_id = OBJECT_ID(N'dbo.TokensRecuperacionClave'))
    CREATE INDEX IX_TokensRecuperacion_Usuario ON dbo.TokensRecuperacionClave (UsuarioId, ExpiraEn, UsadoEn);
GO
