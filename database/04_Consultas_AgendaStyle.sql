/*
  AgendaStyle - Consultas de verificación
  Este script solo consulta información; no modifica registros.
*/

USE [AgendaStyle];
GO

/* 1. Clientes */
SELECT
    ClienteId,
    Nombres,
    Apellidos,
    Telefono,
    Email,
    FechaRegistro,
    Activo
FROM dbo.Clientes
ORDER BY Apellidos, Nombres;
GO

/* 2. Estilistas */
SELECT
    EstilistaId,
    Nombres,
    Apellidos,
    Especialidad,
    Telefono,
    Email,
    Activo
FROM dbo.Estilistas
ORDER BY Apellidos, Nombres;
GO

/* 3. Servicios disponibles */
SELECT
    ServicioId,
    Nombre,
    Descripcion,
    DuracionMinutos,
    Precio,
    Activo
FROM dbo.Servicios
ORDER BY Nombre;
GO

/* 4. Citas con información relacionada */
SELECT
    c.CitaId,
    CONCAT(cl.Nombres, ' ', cl.Apellidos) AS Cliente,
    CONCAT(e.Nombres, ' ', e.Apellidos) AS Estilista,
    s.Nombre AS Servicio,
    c.FechaHoraInicio,
    c.FechaHoraFin,
    c.Estado,
    c.Observaciones,
    c.FechaCreacion
FROM dbo.Citas AS c
INNER JOIN dbo.Clientes AS cl ON cl.ClienteId = c.ClienteId
INNER JOIN dbo.Estilistas AS e ON e.EstilistaId = c.EstilistaId
INNER JOIN dbo.Servicios AS s ON s.ServicioId = c.ServicioId
ORDER BY c.FechaHoraInicio;
GO

/* 5. Agenda de un día específico */
DECLARE @Fecha DATE = CAST(GETDATE() AS DATE);

SELECT
    c.CitaId,
    CAST(c.FechaHoraInicio AS DATE) AS Fecha,
    CAST(c.FechaHoraInicio AS TIME) AS HoraInicio,
    CAST(c.FechaHoraFin AS TIME) AS HoraFin,
    CONCAT(cl.Nombres, ' ', cl.Apellidos) AS Cliente,
    CONCAT(e.Nombres, ' ', e.Apellidos) AS Estilista,
    s.Nombre AS Servicio,
    c.Estado
FROM dbo.Citas AS c
INNER JOIN dbo.Clientes AS cl ON cl.ClienteId = c.ClienteId
INNER JOIN dbo.Estilistas AS e ON e.EstilistaId = c.EstilistaId
INNER JOIN dbo.Servicios AS s ON s.ServicioId = c.ServicioId
WHERE CAST(c.FechaHoraInicio AS DATE) = @Fecha
ORDER BY c.FechaHoraInicio;
GO

/* 6. Historial de citas por cliente */
DECLARE @ClienteId INT = NULL;

SELECT
    c.CitaId,
    CONCAT(cl.Nombres, ' ', cl.Apellidos) AS Cliente,
    s.Nombre AS Servicio,
    CONCAT(e.Nombres, ' ', e.Apellidos) AS Estilista,
    c.FechaHoraInicio,
    c.Estado
FROM dbo.Citas AS c
INNER JOIN dbo.Clientes AS cl ON cl.ClienteId = c.ClienteId
INNER JOIN dbo.Estilistas AS e ON e.EstilistaId = c.EstilistaId
INNER JOIN dbo.Servicios AS s ON s.ServicioId = c.ServicioId
WHERE @ClienteId IS NULL OR c.ClienteId = @ClienteId
ORDER BY c.FechaHoraInicio DESC;
GO

/* 7. Recordatorios y cita asociada */
SELECT
    r.RecordatorioId,
    r.Tipo,
    r.ProgramadoPara,
    r.Enviado,
    r.FechaEnvio,
    r.Estado,
    c.CitaId,
    CONCAT(cl.Nombres, ' ', cl.Apellidos) AS Cliente,
    c.FechaHoraInicio AS FechaCita
FROM dbo.Recordatorios AS r
INNER JOIN dbo.Citas AS c ON c.CitaId = r.CitaId
INNER JOIN dbo.Clientes AS cl ON cl.ClienteId = c.ClienteId
ORDER BY r.ProgramadoPara;
GO

/* 8. Usuarios y negocio asociado */
SELECT
    u.UsuarioId,
    CONCAT(u.Nombres, ' ', u.Apellidos) AS Usuario,
    u.Email,
    u.Rol,
    u.Activo,
    u.FechaRegistro,
    u.UltimoAcceso,
    n.NombreComercial AS Negocio,
    n.TipoNegocio
FROM dbo.Usuarios AS u
LEFT JOIN dbo.Negocios AS n ON n.NegocioId = u.NegocioId
ORDER BY u.Apellidos, u.Nombres;
GO

/* 9. Resumen de registros por tabla */
SELECT 'Clientes' AS Tabla, COUNT(*) AS Total FROM dbo.Clientes
UNION ALL
SELECT 'Estilistas', COUNT(*) FROM dbo.Estilistas
UNION ALL
SELECT 'Servicios', COUNT(*) FROM dbo.Servicios
UNION ALL
SELECT 'Citas', COUNT(*) FROM dbo.Citas
UNION ALL
SELECT 'Recordatorios', COUNT(*) FROM dbo.Recordatorios
UNION ALL
SELECT 'Usuarios', COUNT(*) FROM dbo.Usuarios
UNION ALL
SELECT 'Negocios', COUNT(*) FROM dbo.Negocios;
GO
