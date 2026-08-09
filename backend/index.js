const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs'); 
const jwt = require('jsonwebtoken');
const cron = require('node-cron');
const nodemailer = require('nodemailer'); 
const { Resend } = require('resend'); 
const ExcelJS = require('exceljs'); // NUEVO: Librería profesional para pintar el Excel
require('dotenv').config();

// INICIALIZAR RESEND CON LA VARIABLE DE ENTORNO SEGURA
const resend = new Resend(process.env.RESEND_API_KEY);

// FUERZA LA RED A IPv4
const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors()); 
app.use(express.json()); 

const pool = require('./db');

const getHoraVenezuela = () => {
    const now = new Date();
    return new Date(now.getTime() - (4 * 60 * 60 * 1000));
};

// =========================================================
// 1. FUNCIÓN ESPÍA: REGISTRO DE AUDITORÍA (LOGS)
// =========================================================
const registrarAuditoria = async (usuario, accion, detalles) => {
    try {
        await pool.query(
            'INSERT INTO Auditoria (usuario, accion, detalles) VALUES ($1, $2, $3)',
            [usuario || 'Sistema', accion, detalles]
        );
    } catch (error) {
        console.error('❌ Error guardando Log:', error);
    }
};

// =========================================================
// 2. CREACIÓN AUTOMÁTICA DEL USUARIO MAESTRO
// =========================================================
const inicializarMaestro = async () => {
    try {
        const res = await pool.query("SELECT * FROM Usuario WHERE rol = 'master'");
        if (res.rows.length === 0) {
            const hash = await bcrypt.hash('master123', 10);
            await pool.query(
                "INSERT INTO Usuario (username, password_hash, rol, estado) VALUES ($1, $2, 'master', 'Aprobado')",
                ['master', hash]
            );
            console.log("👑 Usuario Maestro creado -> User: master | Pass: master123");
            await registrarAuditoria('Sistema', 'INICIALIZACION', 'Se creó el usuario Maestro del sistema.');
        }
    } catch (error) {
        console.error("Error creando al maestro:", error);
    }
};
inicializarMaestro(); 

// =========================================================
// 3. MIDDLEWARE DE SEGURIDAD
// =========================================================
const verificarToken = (req, res, next) => {
    const token = req.header('Authorization');
    if (!token) return res.status(401).json({ error: 'Acceso denegado.' });
    
    try {
        const tokenLimpio = token.replace('Bearer ', '');
        req.usuario = jwt.verify(tokenLimpio, process.env.JWT_SECRET || 'clave_super_secreta');
        next();
    } catch (error) {
        res.status(400).json({ error: 'Token inválido o expirado' });
    }
};

// =========================================================
// 4. RUTAS DE AUTENTICACIÓN
// =========================================================
app.post('/registro', async (req, res) => {
    const { username, password, rol } = req.body;
    try {
        const hash = await bcrypt.hash(password, 10);
        const rolAsignado = rol === 'supervisor' ? 'supervisor' : 'asistente';

        await pool.query(
            "INSERT INTO Usuario (username, password_hash, rol, estado) VALUES ($1, $2, $3, 'Pendiente')",
            [username, hash, rolAsignado]
        );
        await registrarAuditoria(username, 'SOLICITUD_REGISTRO', `El usuario ${username} solicitó acceso como ${rolAsignado}.`);
        res.status(201).json({ mensaje: 'Solicitud enviada. Espera aprobación del Maestro.' });
    } catch (error) {
        if (error.code === '23505') return res.status(400).json({ error: 'El usuario ya existe.' });
        res.status(500).json({ error: 'Error al registrar', detalle: error.message });
    }
});

app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const result = await pool.query("SELECT * FROM Usuario WHERE username = $1", [username]);
        if (result.rows.length === 0) return res.status(401).json({ error: 'Usuario no encontrado.' });

        const user = result.rows[0];
        const claveValida = await bcrypt.compare(password, user.password_hash);
        if (!claveValida) {
            await registrarAuditoria(username, 'INTENTO_FALLIDO', 'Intento de inicio de sesión con clave incorrecta.');
            return res.status(401).json({ error: 'Contraseña incorrecta.' });
        }
        if (user.estado === 'Pendiente') {
            await registrarAuditoria(username, 'LOGIN_BLOQUEADO', 'Intentó entrar pero sigue en estado Pendiente.');
            return res.status(403).json({ error: 'Tu cuenta aún no ha sido aprobada.' });
        }
        if (user.estado === 'Rechazado') {
            return res.status(403).json({ error: 'Tu acceso al sistema está revocado o fue rechazado.' });
        }

        const token = jwt.sign(
            { id: user.usuarioid, username: user.username, rol: user.rol }, 
            process.env.JWT_SECRET || 'clave_super_secreta', 
            { expiresIn: '8h' }
        );
        
        await registrarAuditoria(username, 'INICIO_SESION', 'El usuario ingresó al sistema exitosamente.');
        res.json({ mensaje: 'Login exitoso', token, rol: user.rol, username: user.username });
    } catch (error) {
        console.error("Error en login:", error);
        res.status(500).json({ error: 'Error en el servidor.' });
    }
});

app.post('/logout', verificarToken, async (req, res) => {
    try {
        await registrarAuditoria(req.usuario.username, 'CIERRE_SESION', 'El usuario cerró su sesión y salió del sistema.');
        res.json({ mensaje: 'Sesión cerrada correctamente.' });
    } catch (error) {
        res.status(500).json({ error: 'Error al registrar la salida.' });
    }
});

// =========================================================
// 5. RUTAS PARA EL MAESTRO Y AUDITORÍA
// =========================================================
app.get('/usuarios/pendientes', verificarToken, async (req, res) => {
    if (req.usuario.rol !== 'master') return res.status(403).json({ error: 'No tienes permiso.' });
    const result = await pool.query("SELECT usuarioID, username, rol, estado FROM Usuario WHERE estado = 'Pendiente'");
    res.json(result.rows);
});

app.get('/usuarios/aprobados', verificarToken, async (req, res) => {
    if (req.usuario.rol !== 'master') return res.status(403).json({ error: 'No tienes permiso.' });
    try {
        const result = await pool.query("SELECT usuarioID, username, rol, estado FROM Usuario WHERE estado = 'Aprobado' AND rol != 'master'");
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener usuarios activos.' });
    }
});

app.get('/usuarios/aprobados/count', verificarToken, async (req, res) => {
    if (req.usuario.rol !== 'master') return res.status(403).json({ error: 'No tienes permiso.' });
    const result = await pool.query("SELECT COUNT(*) as total FROM Usuario WHERE estado = 'Aprobado' AND rol != 'master'");
    res.json({ total: result.rows[0].total });
});

app.get('/auditoria', verificarToken, async (req, res) => {
    if (req.usuario.rol !== 'master') return res.status(403).json({ error: 'No tienes permiso.' });
    try {
        const result = await pool.query("SELECT * FROM Auditoria ORDER BY fecha DESC");
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener los logs.' });
    }
});

app.post('/auditoria/exportar', verificarToken, async (req, res) => {
    const { tipoReporte, detalles } = req.body;
    try {
        await registrarAuditoria(
            req.usuario.username, 
            `EXPORTAR_${tipoReporte.toUpperCase()}`, 
            detalles || `El usuario descargó un reporte en Excel.`
        );
        res.json({ mensaje: 'Log de exportación registrado con éxito.' });
    } catch (error) {
        console.error("Error registrando auditoría de exportación:", error);
        res.status(500).json({ error: 'Error al registrar auditoría' });
    }
});

app.put('/usuarios/revision/:id', verificarToken, async (req, res) => {
    if (req.usuario.rol !== 'master') return res.status(403).json({ error: 'No tienes permiso.' });
    const { id } = req.params;
    const { nuevoEstado } = req.body; 
    
    try {
        if (nuevoEstado === 'Rechazado') {
            const userRes = await pool.query("DELETE FROM Usuario WHERE usuarioid = $1 RETURNING username", [id]);
            if (userRes.rows.length === 0) return res.status(404).json({ error: 'Usuario no encontrado.' });
            
            const usernameAfectado = userRes.rows[0].username;
            await registrarAuditoria(
                req.usuario.username, 
                'ACCESO_DECLINADO_Y_BORRADO', 
                `Declinó y eliminó la solicitud del usuario: "${usernameAfectado}". El nombre quedó disponible de nuevo.`
            );
            res.json({ mensaje: `La solicitud de ${usernameAfectado} ha sido declinada y el registro fue eliminado.` });
        } else {
            const userRes = await pool.query("UPDATE Usuario SET estado = $1 WHERE usuarioid = $2 RETURNING username", [nuevoEstado, id]);
            if (userRes.rows.length === 0) return res.status(404).json({ error: 'Usuario no encontrado.' });
            
            const usernameAfectado = userRes.rows[0].username;
            await registrarAuditoria(
                req.usuario.username, 
                'USUARIO_APROBADO', 
                `Dictaminó que la cuenta de "${usernameAfectado}" queda: Aprobado.`
            );
            res.json({ mensaje: `El usuario ${usernameAfectado} ha sido aprobado con éxito.` });
        }
    } catch (error) {
        console.error("Error al revisar usuario:", error);
        res.status(500).json({ error: 'Error al cambiar estado.' });
    }
});

// =========================================================
// 6. RUTAS DE EMPLEADOS
// =========================================================
app.post('/empleados', verificarToken, async (req, res) => {
    try {
        if (!req.body || Object.keys(req.body).length === 0) return res.status(400).json({ error: 'Datos vacíos.' });
        
        const { nombre, apellido, dni, numeroTelf, puesto, salarioBase, cuentaBancaria, fechaContratacion, direccion, cuadrilla } = req.body;
        
        const regexCedula = /^[VE][0-9]{5,8}$/;
        if (!dni || !regexCedula.test(dni)) return res.status(400).json({ error: 'Cédula inválida.' });

        const regexTelf = /^(0212|0414|0416|0412|0426|0424|0422)[0-9]{7}$/;
        if (!numeroTelf || !regexTelf.test(numeroTelf)) {
            return res.status(400).json({ error: 'Número de teléfono inválido.' });
        }

        if (puesto === 'Coordinador') {
            const existeCoord = await pool.query("SELECT COUNT(*) FROM Empleado WHERE puesto = 'Coordinador'");
            if (parseInt(existeCoord.rows[0].count) > 0) {
                return res.status(400).json({ error: 'Ya existe un Coordinador. Cámbiate a otro.' });
            }
        }

        let cuadrillaFinal = cuadrilla || 'Sin Cuadrilla';
        if (puesto !== 'Caporal' && puesto !== 'Cuadrillero') {
            cuadrillaFinal = 'Sin Cuadrilla'; 
        }

        if (puesto === 'Caporal' && cuadrillaFinal !== 'Sin Cuadrilla') {
            const existeCaporal = await pool.query("SELECT COUNT(*) FROM Empleado WHERE puesto = 'Caporal' AND cuadrilla = $1 AND estado != 'Vetado'", [cuadrillaFinal]);
            if (parseInt(existeCaporal.rows[0].count) > 0) {
                return res.status(400).json({ error: `La ${cuadrillaFinal} ya tiene un Caporal asignado.` });
            }
        }

        await pool.query('BEGIN'); 
        const personaResult = await pool.query(
            'INSERT INTO Persona (nombre, apellido, dni, numeroTelf, fechaNacimiento) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [nombre, apellido, dni, numeroTelf, '1990-01-01']
        );
        const rowPersona = personaResult.rows[0];
        const idDeLaPersona = rowPersona.personalid || rowPersona.id;

        const empleadoResult = await pool.query(
            'INSERT INTO Empleado (personaid, puesto, salarioBase, cuentaBancaria, fechaContratacion, estado, direccion, cuadrilla) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
            [idDeLaPersona, puesto, salarioBase, cuentaBancaria || '', fechaContratacion || new Date().toISOString().split('T')[0], 'Activo', direccion || 'No registrada', cuadrillaFinal]
        );
        await pool.query('COMMIT'); 

        await registrarAuditoria(req.usuario.username, 'CREAR_EMPLEADO', `Registró al empleado ${nombre} ${apellido} (C.I: ${dni}) en el puesto de ${puesto} (${cuadrillaFinal}).`);
        res.status(201).json({ mensaje: 'Empleado agregado exitosamente', empleado: empleadoResult.rows[0] });

    } catch (error) {
        await pool.query('ROLLBACK'); 
        if (error.code === '23505') return res.status(400).json({ error: 'Esta cédula ya se encuentra registrada en el sistema.' });
        res.status(500).json({ error: 'Error del servidor', detalle: error.message });
    }
});

app.get('/empleados', verificarToken, async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const isAll = req.query.limit === 'all';
    const limit = isAll ? 5000 : (parseInt(req.query.limit) || 50); 
    const offset = isAll ? 0 : (page - 1) * limit;
    const estado = req.query.estado || 'Todos';

    try {
        let query = `
            SELECT e.empleadoID as empleadoid, p.personalid as "personaid", p.nombre, p.apellido, p.dni, p.numeroTelf, e.puesto, e.salarioBase, e.estado, e.direccion, e.cuentaBancaria as cuentabancaria, e.cuadrilla,
            TO_CHAR(e.fechaContratacion, 'YYYY-MM-DD') as fechacontratacion,
            COALESCE((
                SELECT json_agg(json_build_object(
                    'fecha', TO_CHAR(a.fecha, 'YYYY-MM-DD'), 
                    'estado', a.estado, 
                    'dia', EXTRACT(ISODOW FROM a.fecha)
                ))
                FROM Asistencia a
                WHERE a.empleadoID = e.empleadoID 
            ), '[]'::json) as asistencia_semana,
            (SELECT COUNT(*) FROM Sancion s WHERE s.empleadoID = e.empleadoID) as suspensiones
            FROM Empleado e
            JOIN Persona p ON e.personaid = p.personalid
        `;
        
        let countQuery = 'SELECT COUNT(*) FROM Empleado e';
        let queryParams = [];

        if (estado !== 'Todos') {
            query += ` WHERE e.estado = $1 ORDER BY e.cuadrilla ASC, p.apellido ASC`;
            countQuery += ` WHERE e.estado = $1`;
            queryParams.push(estado);
            if (!isAll) {
                query += ` LIMIT $2 OFFSET $3`;
                queryParams.push(limit, offset);
            }
        } else {
            query += ` ORDER BY e.cuadrilla ASC, p.apellido ASC`;
            if (!isAll) {
                query += ` LIMIT $1 OFFSET $2`;
                queryParams.push(limit, offset);
            }
        }

        const result = await pool.query(query, queryParams);
        const countRes = await pool.query(countQuery, estado !== 'Todos' ? [estado] : []);
        const totalItems = parseInt(countRes.rows[0].count);

        res.json({
            empleados: result.rows,
            totalItems,
            totalPages: isAll ? 1 : Math.ceil(totalItems / limit),
            currentPage: page
        });
    } catch (error) {
        console.error("Error al obtener empleados:", error);
        res.status(500).json({ error: 'Error al obtener empleados' });
    }
});

app.put('/empleados/:id/cuenta', verificarToken, async (req, res) => {
    try {
        await pool.query('UPDATE Empleado SET cuentaBancaria = $1 WHERE empleadoID = $2', [req.body.cuentaBancaria, req.params.id]);
        res.json({ mensaje: 'Cuenta guardada exitosamente.' });
    } catch (error) {
        console.error("Error al guardar cuenta bancaria:", error);
        res.status(500).json({ error: 'Error al guardar cuenta' });
    }
});

app.put('/empleados/:id', verificarToken, async (req, res) => {
    const { id } = req.params;
    const { personaID, personaid, nombre, apellido, dni, numeroTelf, puesto, salarioBase, cuentaBancaria, estado, motivoSancion, diasSuspension, direccion, cuadrilla } = req.body;
    const idPersonaReal = personaid || personaID;
    
    const regexTelf = /^(0212|0414|0416|0412|0426|0424|0422)[0-9]{7}$/;
    if (!numeroTelf || !regexTelf.test(numeroTelf)) {
        return res.status(400).json({ error: 'Número de teléfono inválido.' });
    }

    try {
        if (puesto === 'Coordinador') {
            const existeCoord = await pool.query("SELECT COUNT(*) FROM Empleado WHERE puesto = 'Coordinador' AND empleadoID != $1", [id]);
            if (parseInt(existeCoord.rows[0].count) > 0) {
                return res.status(400).json({ error: 'Ya existe otro Coordinador en el sistema.' });
            }
        }

        let cuadrillaFinal = cuadrilla || 'Sin Cuadrilla';
        if (puesto !== 'Caporal' && puesto !== 'Cuadrillero') {
            cuadrillaFinal = 'Sin Cuadrilla';
        }

        if (puesto === 'Caporal' && cuadrillaFinal !== 'Sin Cuadrilla') {
            const existeCaporal = await pool.query("SELECT COUNT(*) FROM Empleado WHERE puesto = 'Caporal' AND cuadrilla = $1 AND empleadoID != $2 AND estado != 'Vetado'", [cuadrillaFinal, id]);
            if (parseInt(existeCaporal.rows[0].count) > 0) {
                return res.status(400).json({ error: `La ${cuadrillaFinal} ya tiene un Caporal asignado.` });
            }
        }

        await pool.query('BEGIN');
        
        await pool.query(
            'UPDATE Persona SET nombre = $1, apellido = $2, dni = $3, numeroTelf = $4 WHERE personalid = $5',
            [nombre, apellido, dni, numeroTelf, idPersonaReal]
        );
        
        await pool.query(
            'UPDATE Empleado SET puesto = $1, salarioBase = $2, cuentaBancaria = $3, estado = $4, direccion = $5, cuadrilla = $6 WHERE empleadoID = $7',
            [puesto, salarioBase, cuentaBancaria || '', estado, direccion || 'No registrada', cuadrillaFinal, id]
        );

        if (estado === 'Sancionado') {
            await pool.query(
                'INSERT INTO Sancion (empleadoID, fecha, motivo, tipo, dias_suspension) VALUES ($1, CURRENT_DATE, $2, $3, $4)',
                [id, motivoSancion || 'Suspensión temporal', 'Suspensión', parseInt(diasSuspension) || 3]
            );
        }

        await pool.query('COMMIT');
        
        await registrarAuditoria(
            req.usuario.username, 
            'EDITAR_EMPLEADO', 
            `Modificó al empleado C.I: ${dni} -> Nuevo Puesto: ${puesto}, Cuadrilla: ${cuadrillaFinal}, Estado: ${estado}`
        );

        res.json({ mensaje: 'Datos actualizados con éxito' });
    } catch (error) {
        await pool.query('ROLLBACK');
        console.error("Error al actualizar empleado:", error);
        res.status(500).json({ error: 'Error al actualizar', detalle: error.message });
    }
});

app.put('/empleados/:id/estado', verificarToken, async (req, res) => {
    const { id } = req.params;
    const { nuevoEstado } = req.body; 
    try {
        const result = await pool.query('UPDATE Empleado SET estado = $1 WHERE empleadoID = $2 RETURNING *', [nuevoEstado, id]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Empleado no encontrado.' });
        
        await registrarAuditoria(req.usuario.username, 'ESTADO_EMPLEADO', `Cambió el estado del empleado (ID interno ${id}) a ${nuevoEstado}`);
        res.json({ mensaje: `Estado cambiado a ${nuevoEstado}`, empleado: result.rows[0] });
    } catch (error) {
        res.status(500).json({ error: 'Error al cambiar estado', detalle: error.message });
    }
});

// =========================================================
// 7. SANCIONES
// =========================================================
app.post('/sanciones', verificarToken, async (req, res) => {
    const { empleadoID, fecha, motivo, tipo } = req.body;
    try {
        const result = await pool.query(
            'INSERT INTO Sancion (empleadoID, fecha, motivo, tipo) VALUES ($1, $2, $3, $4) RETURNING *',
            [empleadoID, fecha, motivo, tipo]
        );
        await registrarAuditoria(req.usuario.username, 'APLICAR_SANCION', `Sancionó al empleado ID ${empleadoID}. Motivo: ${motivo}`);
        res.status(201).json({ mensaje: 'Sanción registrada', sancion: result.rows[0] });
    } catch (error) {
        res.status(500).json({ error: 'Error registrando sanción', detalle: error.message });
    }
});

// =========================================================
// 8. MÓDULO DE NOVEDADES Y QUEJAS
// =========================================================
app.get('/novedades', verificarToken, async (req, res) => {
    try {
        let resSanciones;
        try {
            const querySanciones = `
                SELECT DISTINCT ON (e.empleadoID)
                    e.empleadoID AS empleadoid, 
                    p.nombre, 
                    p.apellido, 
                    COALESCE(s.fecha, CURRENT_DATE) AS fecha, 
                    COALESCE(s.motivo, 'Suspensión temporal') AS motivo, 
                    COALESCE(s.dias_suspension, 3) AS dias_suspension,
                    COALESCE((CURRENT_DATE - s.fecha), 0) AS dias_transcurridos
                FROM Empleado e
                JOIN Persona p ON e.personaid = p.personalid
                LEFT JOIN Sancion s ON e.empleadoID = s.empleadoID
                WHERE e.estado = 'Sancionado' 
                  AND (CURRENT_DATE - s.fecha) <= s.dias_suspension
                ORDER BY e.empleadoID, s.fecha DESC NULLS LAST
            `;
            resSanciones = await pool.query(querySanciones);
        } catch (errCol) {
            console.error(errCol);
            resSanciones = { rows: [] };
        }
        
        let resQuejas;
        try {
            resQuejas = await pool.query('SELECT * FROM Queja ORDER BY 1 DESC LIMIT 10');
        } catch (errQ) {
            resQuejas = { rows: [] };
        }

        const quejasMapeadas = resQuejas.rows.map(q => ({
            quejaid: q.quejaID || q.quejaid || q.id,
            tipo: q.tipo,
            descripcion: q.descripcion,
            fechaqueja: q.fechaQueja || q.fechaqueja || new Date()
        }));

        res.json({ sanciones: resSanciones.rows || [], quejas: quejasMapeadas });
    } catch (error) {
        console.error("Error detallado in novedades:", error);
        res.status(500).json({ error: 'Error cargando Novedades', detalle: error.message });
    }
});

app.post('/quejas', verificarToken, async (req, res) => {
    const { tipo, descripcion } = req.body;
    try {
        await pool.query(
            'INSERT INTO Queja (tipo, descripcion, fechaQueja) VALUES ($1, $2, CURRENT_DATE)', 
            [tipo, descripcion]
        );
        await registrarAuditoria(req.usuario.username, 'NUEVA_QUEJA', `Registró una incidencia tipo: ${tipo}`);
        res.status(201).json({ mensaje: 'Incidencia registrada.' });
    } catch (error) {
        console.error("❌ Error al guardar queja en PostgreSQL:", error);
        res.status(500).json({ error: error.message });
    }
});

app.delete('/quejas/:id', verificarToken, async (req, res) => {
    if (req.usuario.rol !== 'master') {
        return res.status(403).json({ error: 'Acceso denegado. Solo el Maestro puede eliminar reportes.' });
    }
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM Queja WHERE quejaID = $1 OR quejaid = $1 OR id = $1', [id]);
        await registrarAuditoria(req.usuario.username, 'ELIMINAR_QUEJA', `Eliminó el reporte/incidencia ID: ${id}`);
        res.json({ mensaje: 'Reporte eliminado con éxito.' });
    } catch (error) {
        console.error("❌ Error al eliminar queja:", error);
        res.status(500).json({ error: error.message });
    }
});

// =========================================================
// 9. MÓDULO DE ASISTENCIA DIARIA
// =========================================================
app.get('/asistencia', verificarToken, async (req, res) => {
    const { fecha } = req.query;
    const fechaConsulta = fecha || new Date().toISOString().split('T')[0];
    try {
        const query = `
            SELECT e.empleadoID as "empleadoID", e.empleadoID as empleadoid, p.nombre, p.apellido, p.dni, e.puesto, e.estado AS estado_empleado, e.cuadrilla,
                   a.estado AS asistencia_estado,
                   a.observacion
            FROM Empleado e
            JOIN Persona p ON e.personaid = p.personalid
            LEFT JOIN Asistencia a ON e.empleadoID = a.empleadoID AND a.fecha = $1
            WHERE e.estado = 'Activo'
            ORDER BY e.cuadrilla ASC, p.apellido ASC
        `;
        const result = await pool.query(query, [fechaConsulta]);
        res.json(result.rows);
    } catch (error) {
        console.error("Error al obtener asistencia:", error);
        res.status(500).json({ error: 'Error al cargar asistencia' });
    }
});

app.post('/asistencia', verificarToken, async (req, res) => {
    const { empleadoID, fecha, estado, observacion } = req.body;
    const fechaRegistro = fecha || new Date().toISOString().split('T')[0];
    try {
        await pool.query(`
            INSERT INTO Asistencia (empleadoID, fecha, estado, observacion)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (empleadoID, fecha)
            DO UPDATE SET estado = EXCLUDED.estado, observacion = EXCLUDED.observacion
        `, [empleadoID, fechaRegistro, estado, observacion || '']);

        res.json({ mensaje: 'Asistencia guardada correctamente' });
    } catch (error) {
        console.error("Error guardando asistencia:", error);
        res.status(500).json({ error: 'Error al guardar asistencia', detalle: error.message });
    }
});

// =========================================================
// 10. ESTADÍSTICAS Y CORTE SEMANAL
// =========================================================
app.get('/dashboard/stats', verificarToken, async (req, res) => {
    try {
        const activosRes = await pool.query("SELECT COUNT(*) FROM Empleado WHERE estado = 'Activo'");
        const sancionadosRes = await pool.query("SELECT COUNT(*) FROM Empleado WHERE estado = 'Sancionado'");
        const totalRes = await pool.query("SELECT COUNT(*) FROM Empleado");
        
        const cuadrillasRes = await pool.query("SELECT COUNT(DISTINCT cuadrilla) FROM Empleado WHERE estado = 'Activo' AND cuadrilla != 'Sin Cuadrilla'");

        const empleadosAsistencia = await pool.query(`
            SELECT e.salarioBase,
            COALESCE((
                SELECT json_agg(json_build_object(
                    'estado', a.estado,
                    'dia', EXTRACT(ISODOW FROM a.fecha)
                ))
                FROM Asistencia a
                WHERE a.empleadoID = e.empleadoID 
            ), '[]'::json) as asistencia_semana
            FROM Empleado e
            WHERE e.estado = 'Activo'
        `);

        let totalNomina = 0;
        let diasTrabajados = 0;
        let diasAusentes = 0;

        empleadosAsistencia.rows.forEach(emp => {
            const salarioBaseNum = Number(emp.salariobase || emp.salarioBase) || 0;
            const salarioDiario = salarioBaseNum / 6; 
            let ausencias = 0;

            emp.asistencia_semana.forEach(a => {
                if (a.dia === 7) return;

                if (a.estado === 'Ausente') {
                    ausencias += 1;
                    diasAusentes += 1; 
                } else if (a.estado === 'Presente' || a.estado === 'Justificado') {
                    diasTrabajados += 1; 
                }
            });

            const pagoFinal = salarioBaseNum - (ausencias * salarioDiario);
            totalNomina += (pagoFinal < 0 ? 0 : pagoFinal);
        });

        const totalDiasRegistrados = diasTrabajados + diasAusentes;
        let porcentajeAsistencia = 100; 
        if (totalDiasRegistrados > 0) {
            porcentajeAsistencia = (diasTrabajados / totalDiasRegistrados) * 100;
        } else {
            porcentajeAsistencia = 0; 
        }

        res.json({
            activos: parseInt(activosRes.rows[0].count) || 0,
            sancionados: parseInt(sancionadosRes.rows[0].count) || 0,
            total: parseInt(totalRes.rows[0].count) || 0,
            totalCuadrillas: parseInt(cuadrillasRes.rows[0].count) || 0,
            totalNomina: totalNomina.toFixed(2),
            porcentajeAsistencia: porcentajeAsistencia.toFixed(2)
        });
    } catch (error) {
        console.error("Error obteniendo estadísticas del dashboard:", error);
        res.status(500).json({ error: 'Error al cargar estadísticas' });
    }
});

app.get('/corte-semanal/verificar', verificarToken, async (req, res) => {
    try {
        const vetTime = getHoraVenezuela();
        const day = vetTime.getDay(); 
        const hour = vetTime.getHours();

        const esHoraDeCorte = (day === 5 && hour >= 16) || day === 6;
        if (!esHoraDeCorte) return res.json({ pendiente: false });

        const offsetToSaturday = day === 6 ? 0 : day + 1;
        const inicioSemana = new Date(vetTime);
        inicioSemana.setDate(vetTime.getDate() - offsetToSaturday); 
        inicioSemana.setHours(0,0,0,0);

        const existeCorte = await pool.query(
            'SELECT * FROM CorteSemanal WHERE creado_en >= $1',
            [inicioSemana]
        );

        if (existeCorte.rows.length > 0) return res.json({ pendiente: false });

        res.json({ pendiente: true });
    } catch (error) {
        console.error("Error verificando corte semanal:", error);
        res.status(500).json({ error: 'Error al verificar corte' });
    }
});

// =========================================================
// 11. CORREO Y REPORTE COMPLETO EN EXCEL (CON EXCELJS - DISEÑO HERMOSO)
// =========================================================
const ejecutarCorteSemanal = async (usuario = 'Sistema Automático') => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const activosRes = await client.query("SELECT COUNT(*) FROM Empleado WHERE estado = 'Activo'");
        const sancionadosRes = await client.query("SELECT COUNT(*) FROM Empleado WHERE estado = 'Sancionado'");
        
        const totalActivos = parseInt(activosRes.rows[0].count) || 0;
        const totalSancionados = parseInt(sancionadosRes.rows[0].count) || 0;
        const fechaHoy = new Date().toISOString().split('T')[0];

        // Añadí numeroTelf y cuentaBancaria al query SQL para que exceljs pueda dibujarlos
        const empQuery = await client.query(`
            SELECT e.empleadoID, p.nombre, p.apellido, p.dni, p.numeroTelf, e.puesto, e.estado, e.cuadrilla, e.salarioBase, e.cuentaBancaria,
            (SELECT json_agg(json_build_object('fecha', a.fecha, 'estado', a.estado, 'observacion', a.observacion, 'dia', EXTRACT(ISODOW FROM a.fecha))) 
             FROM Asistencia a WHERE a.empleadoID = e.empleadoID) as asistencias
            FROM Empleado e JOIN Persona p ON e.personaid = p.personalid
        `);

        let totalNomina = 0;
        let diasTrabajados = 0;
        let diasAusentes = 0;

        const empleadosConNomina = empQuery.rows.map(emp => {
            const salarioBaseNum = Number(emp.salariobase || emp.salarioBase) || 0;
            const salarioDiario = salarioBaseNum / 6; 
            let ausencias = 0;
            let diasTrabajadosInd = 0;
            const asistenciasArray = emp.asistencias || [];

            asistenciasArray.forEach(a => {
                if (a.dia === 7) return; 

                if (a.estado === 'Ausente') {
                    ausencias += 1;
                    diasAusentes += 1; 
                } else if (a.estado === 'Presente' || a.estado === 'Justificado') {
                    diasTrabajados += 1; 
                    diasTrabajadosInd += 1;
                }
            });

            const pagoFinal = salarioBaseNum - (ausencias * salarioDiario);
            const pagoReal = pagoFinal < 0 ? 0 : pagoFinal;
            
            if (emp.estado === 'Activo') {
                totalNomina += pagoReal;
            }

            return {
                // Campos base (no romper lógica antigua)
                "ID Empleado": emp.empleadoid || emp.empleadoID,
                "Nombre": emp.nombre,
                "Apellido": emp.apellido,
                "Cédula": emp.dni,
                "Puesto": emp.puesto,
                "Cuadrilla": emp.cuadrilla,
                "Estado": emp.estado,
                "Salario Base ($)": salarioBaseNum.toFixed(2),
                "Faltas Semanales": ausencias,
                "PAGO SEMANAL A RECIBIR ($)": pagoReal.toFixed(2),
                
                // Campos crudos para el diseño avanzado de ExcelJS
                empleadoid: emp.empleadoid || emp.empleadoID,
                nombre: emp.nombre,
                apellido: emp.apellido,
                dni: emp.dni,
                numerotelf: emp.numerotelf || emp.numeroTelf,
                puesto: emp.puesto,
                cuadrilla: emp.cuadrilla,
                estado: emp.estado,
                salarioBase: salarioBaseNum,
                cuentabancaria: emp.cuentabancaria || emp.cuentaBancaria,
                asistencia_semana: asistenciasArray,
                diasTrabajados: diasTrabajadosInd,
                pagoFinal: pagoReal
            };
        });

        const totalDiasRegistrados = diasTrabajados + diasAusentes;
        let porcentajeAsistencia = 100; 
        if (totalDiasRegistrados > 0) {
            porcentajeAsistencia = (diasTrabajados / totalDiasRegistrados) * 100;
        } else {
            porcentajeAsistencia = 0; 
        }

        const insertRes = await client.query(
            `INSERT INTO CorteSemanal (fecha_inicio, fecha_fin, total_activos, total_sancionados, porcentaje_asistencia, detalles) 
             VALUES ($1, $1, $2, $3, $4, $5) RETURNING *`,
            [fechaHoy, totalActivos, totalSancionados, porcentajeAsistencia.toFixed(2), 'Corte semanal y respaldo general por ' + usuario]
        );

        const sancQuery = await client.query(`
            SELECT s.sancionID as "ID Sancion", p.nombre as "Nombre", p.apellido as "Apellido", s.fecha as "Fecha", s.motivo as "Motivo", s.dias_suspension as "Dias Suspendido"
            FROM Sancion s 
            JOIN Empleado e ON s.empleadoID = e.empleadoID 
            JOIN Persona p ON e.personaid = p.personalid
            ORDER BY s.fecha DESC LIMIT 30
        `);

        const auditQuery = await client.query(`
            SELECT usuario as "Usuario", accion as "Accion", detalles as "Detalles de la Accion", fecha as "Fecha"
            FROM Auditoria 
            ORDER BY fecha DESC LIMIT 50
        `);

        const reporteConsolidado = {
            resumen_corte: {
                "Fecha de Corte": insertRes.rows[0].fecha_fin,
                "Total Empleados Activos": insertRes.rows[0].total_activos,
                "Total Empleados Sancionados": insertRes.rows[0].total_sancionados,
                "Porcentaje Global de Asistencia": insertRes.rows[0].porcentaje_asistencia + "%",
                "MONTO TOTAL NÓMINA ($)": totalNomina.toFixed(2),
                "Detalles": insertRes.rows[0].detalles
            },
            nomina_y_asistencias: empleadosConNomina,
            sanciones_suspensiones: sancQuery.rows,
            auditoria_logs: auditQuery.rows
        };

        try {
            await client.query('DELETE FROM Asistencia');
            await client.query('DELETE FROM Queja');
        } catch (eQ) {
            console.log("Aviso: No se pudo vaciar las tablas automáticamente:", eQ.message);
        }

        await client.query('COMMIT');
        await registrarAuditoria(usuario, 'CORTE_SEMANAL_Y_REPORTE', 'Se ejecutó el corte semanal y se consolidó el reporte. Nómina total calculada: $' + totalNomina.toFixed(2));
        
        return reporteConsolidado;
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};

const enviarCorreoReportes = async (datosReporte) => {
    try {
        const workbook = new ExcelJS.Workbook(); 

        // ==========================================
        // HOJA 1: RESUMEN DEL CORTE (DISEÑADA)
        // ==========================================
        const wsResumen = workbook.addWorksheet('Resumen del Corte', { views: [{ showGridLines: false }] });
        wsResumen.columns = [
            { header: 'Métrica', key: 'key', width: 35 },
            { header: 'Valor', key: 'val', width: 50 }
        ];
        wsResumen.getRow(1).font = { bold: true, color: { argb: 'FFFFFF' } };
        wsResumen.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '2C3E50' } };
        
        const resumen = datosReporte.resumen_corte;
        Object.keys(resumen).forEach(k => {
            const row = wsResumen.addRow({ key: k, val: resumen[k] });
            row.eachCell(cell => cell.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} });
        });

        // ==========================================
        // HOJA 2: NÓMINA OFICIAL (DISEÑO EXACTO AL FRONTEND)
        // ==========================================
        const sheet = workbook.addWorksheet('Nómina Oficial', { views: [{ showGridLines: false }] });

        const formatearCuentaBancaria = (cuenta) => {
            if (!cuenta) return "No registrada";
            const limpia = String(cuenta).replace(/\D/g, '');
            if (limpia.length !== 20) return limpia; 
            return limpia.match(/.{1,4}/g)?.join('-') || limpia;
        };

        const getIconoAsistenciaExcel = (asistenciaSemana, diaBusqueda) => {
            if (!asistenciaSemana || !Array.isArray(asistenciaSemana)) return '-';
            const registro = asistenciaSemana.find(a => Number(a.dia) === Number(diaBusqueda));
            if (!registro) return '-'; 
            if (registro.estado === 'Presente') return '✓';
            if (registro.estado === 'Ausente') return 'X';
            if (registro.estado === 'Justificado') return 'J'; 
            return '-';
        };

        const current = getHoraVenezuela();
        const mesActual = current.toLocaleString('es-ES', { month: 'long' }).toUpperCase();
        const anioActual = current.getFullYear();
        
        // Calcular número de semana (ISO)
        const getNumeroSemana = (d) => {
            const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
            const dayNum = date.getUTCDay() || 7;
            date.setUTCDate(date.getUTCDate() + 4 - dayNum);
            const yearStart = new Date(Date.UTC(date.getUTCFullYear(),0,1));
            return Math.ceil((((date - yearStart) / 86400000) + 1)/7);
        };
        const numeroSemana = getNumeroSemana(current);

        const currentDay = current.getDay(); 
        const offsetToSaturday = currentDay === 6 ? 0 : currentDay + 1; 
        const pastSaturday = new Date(current);
        pastSaturday.setDate(current.getDate() - offsetToSaturday);
        const fechasSemana = [];
        for(let i = 0; i < 7; i++) {
           if (i === 1) continue; 
           const tempDate = new Date(pastSaturday);
           tempDate.setDate(pastSaturday.getDate() + i);
           fechasSemana.push(tempDate.getDate()); 
        }

        const headers = [
            "#", "NOMBRES Y APELLIDOS", "CEDULA", "OCUPACION", 
            "SABADO", "LUNES", "MARTES", "MIERCOLES", "JUEVES", "VIERNES", 
            "TOTAL ASISTENCIAS", "% DE ASISTENCIAS", "SUELDO DIARIO $", 
            "SUELDO TOTAL $", "SUELDO TOTAL BS", "BANCO", "TELEFONO", 
            "CEDULA BANCARIA", "NUMERO DE CUENTA", "N° DE REFERENCIA"
        ];
        const colLetters = ['A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R','S','T'];

        const todosLosEmpleados = datosReporte.nomina_y_asistencias;
        const staff = todosLosEmpleados.filter(emp => !emp.cuadrilla || emp.cuadrilla === 'Sin Cuadrilla');
        const cuadrillas = todosLosEmpleados.filter(emp => emp.cuadrilla && emp.cuadrilla !== 'Sin Cuadrilla');

        const staffPorPuesto = {};
        staff.forEach(emp => {
            const puesto = emp.puesto || 'Sin Puesto';
            if (!staffPorPuesto[puesto]) staffPorPuesto[puesto] = [];
            staffPorPuesto[puesto].push(emp);
        });

        const cuadrillasMap = {};
        cuadrillas.forEach(emp => {
            if (!cuadrillasMap[emp.cuadrilla]) cuadrillasMap[emp.cuadrilla] = [];
            cuadrillasMap[emp.cuadrilla].push(emp);
        });

        Object.keys(cuadrillasMap).forEach(key => {
            cuadrillasMap[key].sort((a, b) => {
                if (a.puesto === 'Caporal' && b.puesto !== 'Caporal') return -1;
                if (b.puesto === 'Caporal' && a.puesto !== 'Caporal') return 1;
                return 0; 
            });
        });

        const gruposParaExportar = [];
        Object.keys(staffPorPuesto).sort().forEach(puesto => {
            gruposParaExportar.push({ nombre: `GRUPO: ${puesto.toUpperCase()}`, empleados: staffPorPuesto[puesto] });
        });
        Object.keys(cuadrillasMap).sort((a, b) => {
            const numA = parseInt(a.replace(/\D/g, '')) || 0;
            const numB = parseInt(b.replace(/\D/g, '')) || 0;
            return numA - numB;
        }).forEach(cuad => {
            gruposParaExportar.push({ nombre: cuad.toUpperCase(), empleados: cuadrillasMap[cuad] });
        });

        let currentRow = 1; 
        let indexGlobal = 1;

        gruposParaExportar.forEach((grupo, idxGrupo) => {
            // Título amarillo
            sheet.mergeCells(`A${currentRow}:T${currentRow}`); 
            const titleCell = sheet.getCell(`A${currentRow}`);
            titleCell.value = `ASISTENCIA DEL MES DE ${mesActual} ${anioActual} - SEMANA ${numeroSemana} (TASA BCV: A definir en caja)`;
            titleCell.font = { bold: true, size: 11, name: 'Arial' };
            titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
            titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF00' } }; 
            sheet.getRow(currentRow).height = 25;
            currentRow++;

            // Título azul del grupo
            sheet.mergeCells(`A${currentRow}:T${currentRow}`);
            const cellTitle = sheet.getCell(`A${currentRow}`);
            cellTitle.value = grupo.nombre;
            cellTitle.font = { bold: true, size: 10, name: 'Arial', color: { argb: 'FFFFFF' } };
            cellTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '2C3E50' } };
            cellTitle.alignment = { horizontal: 'center', vertical: 'middle' };
            sheet.getRow(currentRow).height = 22;
            currentRow++;

            // Cabeceras de tabla
            sheet.getRow(currentRow).height = 28;
            sheet.getRow(currentRow + 1).height = 18;
            headers.forEach((header, i) => {
                const col = colLetters[i];
                const isDayColumn = (i >= 4 && i <= 9); 
                const cellRow2 = sheet.getCell(`${col}${currentRow}`);
                cellRow2.value = header;
                cellRow2.font = { bold: true, size: 8, name: 'Arial' }; 
                cellRow2.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }; 
                
                if (!isDayColumn) {
                    sheet.mergeCells(`${col}${currentRow}:${col}${currentRow + 1}`);
                    sheet.getCell(`${col}${currentRow}`).border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
                } else {
                    cellRow2.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
                    const cellRow3 = sheet.getCell(`${col}${currentRow + 1}`);
                    cellRow3.value = fechasSemana[i - 4]; 
                    cellRow3.font = { bold: true, size: 9, name: 'Arial' };
                    cellRow3.alignment = { horizontal: 'center', vertical: 'middle' };
                    cellRow3.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
                }
            });
            currentRow += 2; 

            let sumaTotalDolaresGrupo = 0;

            grupo.empleados.forEach((emp) => {
                sumaTotalDolaresGrupo += emp.pagoFinal;
                const porcentajeAsistencia = (emp.diasTrabajados / 6); 

                const rowValues = [
                    indexGlobal++,
                    `${emp.nombre || ''} ${emp.apellido || ''}`.trim().toUpperCase(),
                    emp.dni || "",
                    (emp.puesto || '').toUpperCase(),
                    getIconoAsistenciaExcel(emp.asistencia_semana, 6), 
                    getIconoAsistenciaExcel(emp.asistencia_semana, 1), 
                    getIconoAsistenciaExcel(emp.asistencia_semana, 2), 
                    getIconoAsistenciaExcel(emp.asistencia_semana, 3), 
                    getIconoAsistenciaExcel(emp.asistencia_semana, 4), 
                    getIconoAsistenciaExcel(emp.asistencia_semana, 5), 
                    emp.diasTrabajados,
                    porcentajeAsistencia, 
                    emp.salarioBase / 6,       
                    emp.pagoFinal,            
                    "A calcular", // Como es automático, la tasa se calcula en caja
                    emp.cuentabancaria && String(emp.cuentabancaria).length >= 4 ? String(emp.cuentabancaria).substring(0, 4) : "",
                    emp.numerotelf || "",
                    emp.dni || "", 
                    formatearCuentaBancaria(emp.cuentabancaria), 
                    "" 
                ];

                const row = sheet.getRow(currentRow);
                row.values = rowValues;
                row.height = 20; 

                row.eachCell((cell, colNumber) => {
                    cell.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
                    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
                    cell.font = { size: 9, name: 'Arial' }; 
                    if (colNumber === 2) cell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
                    if (colNumber === 12) cell.numFmt = '0%'; 
                    if (colNumber === 13 || colNumber === 14) cell.numFmt = '#,##0.00'; 
                });
                currentRow++;
            });

            // Fila de Subtotal
            sheet.mergeCells(`A${currentRow}:M${currentRow}`);
            const subtotalLabelCell = sheet.getCell(`A${currentRow}`);
            subtotalLabelCell.value = `TOTAL ${grupo.nombre}:`;
            subtotalLabelCell.font = { bold: true, size: 9, name: 'Arial' };
            subtotalLabelCell.alignment = { horizontal: 'right', vertical: 'middle' };
            subtotalLabelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'EAEDED' } };

            const subtotalDolaresCell = sheet.getCell(`N${currentRow}`);
            subtotalDolaresCell.value = sumaTotalDolaresGrupo;
            subtotalDolaresCell.font = { bold: true, size: 9, name: 'Arial' };
            subtotalDolaresCell.numFmt = '#,##0.00';
            subtotalDolaresCell.alignment = { horizontal: 'center', vertical: 'middle' };
            subtotalDolaresCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'EAEDED' } };

            const subtotalBolivaresCell = sheet.getCell(`O${currentRow}`);
            subtotalBolivaresCell.value = "A calcular";
            subtotalBolivaresCell.font = { bold: true, size: 9, name: 'Arial' };
            subtotalBolivaresCell.alignment = { horizontal: 'center', vertical: 'middle' };
            subtotalBolivaresCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'EAEDED' } };

            for (let colIdx = 1; colIdx <= 20; colIdx++) {
                const colLetter = colLetters[colIdx - 1];
                sheet.getCell(`${colLetter}${currentRow}`).border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
            }
            sheet.getRow(currentRow).height = 22;
            currentRow++;

            if (idxGrupo < gruposParaExportar.length - 1) {
                currentRow += 2; 
            }
        });

        // Ajustar anchos de las columnas
        sheet.getColumn('A').width = 4;   
        sheet.getColumn('B').width = 24;  
        sheet.getColumn('C').width = 11;  
        sheet.getColumn('D').width = 13;
        for (let i=5; i<=10; i++) sheet.getColumn(i).width = 6.5; 
        sheet.getColumn('K').width = 9;   
        sheet.getColumn('L').width = 8;   
        sheet.getColumn('M').width = 10;  
        sheet.getColumn('N').width = 10;  
        sheet.getColumn('O').width = 12;  
        sheet.getColumn('P').width = 6;   
        sheet.getColumn('Q').width = 13;  
        sheet.getColumn('R').width = 11;  
        sheet.getColumn('S').width = 23;  
        sheet.getColumn('T').width = 10;  

        // ==========================================
        // HOJA 3: SANCIONES ACTIVAS (DISEÑADA)
        // ==========================================
        const wsSanciones = workbook.addWorksheet("Sanciones Activas");
        wsSanciones.columns = [
            { header: 'ID Sancion', key: 'ID Sancion', width: 15 },
            { header: 'Nombre', key: 'Nombre', width: 20 },
            { header: 'Apellido', key: 'Apellido', width: 20 },
            { header: 'Fecha', key: 'Fecha', width: 15 },
            { header: 'Motivo', key: 'Motivo', width: 40 },
            { header: 'Dias Suspendido', key: 'Dias Suspendido', width: 15 }
        ];
        wsSanciones.getRow(1).font = { bold: true, color: { argb: 'FFFFFF' } };
        wsSanciones.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '2C3E50' } };
        datosReporte.sanciones_suspensiones.forEach(s => {
            const r = wsSanciones.addRow(s);
            r.eachCell(c => c.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} });
        });

        // ==========================================
        // HOJA 4: REGISTRO DE AUDITORÍA (DISEÑADA)
        // ==========================================
        const wsAuditoria = workbook.addWorksheet("Registro de Auditoría");
        wsAuditoria.columns = [
            { header: 'Usuario', key: 'Usuario', width: 15 },
            { header: 'Accion', key: 'Accion', width: 25 },
            { header: 'Detalles de la Accion', key: 'Detalles de la Accion', width: 60 },
            { header: 'Fecha', key: 'Fecha', width: 25 }
        ];
        wsAuditoria.getRow(1).font = { bold: true, color: { argb: 'FFFFFF' } };
        wsAuditoria.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '2C3E50' } };
        datosReporte.auditoria_logs.forEach(a => {
            const r = wsAuditoria.addRow(a);
            r.eachCell(c => c.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} });
        });

        // GENERAR BUFFER DEL EXCEL HERMOSO
        const excelBuffer = await workbook.xlsx.writeBuffer();

        // Enviar correo utilizando Resend 
        const { data, error } = await resend.emails.send({
            from: 'onboarding@resend.dev',
            to: 'sjglysluismar3@gmail.com',
            subject: '📊 Reporte y Corte Semanal Consolidado - NóminaPro',
            html: '<p>Hola. Adjunto encontrarás el reporte consolidado del corte semanal en formato Excel. Este archivo incluye todos los registros de empleados, cálculo total de la nómina en dólares, asistencias, faltas justificadas, suspensiones activas y la auditoría completa.</p>',
            attachments: [
                {
                    filename: `Nomina_Oficial_Semanal_${new Date().toISOString().split('T')[0]}.xlsx`,
                    content: excelBuffer
                }
            ]
        });

        if (error) {
            console.error('❌ Error enviando correo con Resend:', error);
            throw new Error(error.message);
        }

        console.log('📧 Correo enviado con éxito mediante Resend:', data);
    } catch (error) {
        console.error('❌ Error general al crear o enviar el Excel:', error);
        throw error;
    }
};

// RUTA DEL BOTÓN ROJO (AHORA TE DIRÁ EL ERROR REAL SI EL CORREO FALLA)
app.post('/api/nomina/forzar-cierre', verificarToken, async (req, res) => {
    try {
        const resultadoReporte = await ejecutarCorteSemanal(req.usuario.username);
        
        await enviarCorreoReportes(resultadoReporte);

        res.json({ 
            mensaje: '¡Corte realizado y correo enviado con éxito!',
            datos: resultadoReporte.resumen_corte
        });
    } catch (error) {
        console.error("Error en cierre manual:", error);
        res.status(500).json({ error: 'El corte se hizo en la BD, pero el correo falló: ' + error.message });
    }
});

cron.schedule('59 23 * * 5', async () => {
    console.log('⏰ Iniciando corte semanal automático (Hora CCS)...');
    try {
        const resultadoReporte = await ejecutarCorteSemanal('Cron Automático 11:59PM');
        await enviarCorreoReportes(resultadoReporte);
        console.log('✅ Corte semanal automático, respaldo y correo ejecutados con éxito.');
    } catch (error) {
        console.error('❌ Error en el corte automático:', error);
    }
}, {
    scheduled: true,
    timezone: "America/Caracas"
});

// =========================================================
// 12. INICIO DEL SERVIDOR
// =========================================================
app.listen(port, () => console.log(`🚀 Backend corriendo en puerto ${port}`));