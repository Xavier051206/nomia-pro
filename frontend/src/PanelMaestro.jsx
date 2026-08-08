import React, { useState, useEffect } from 'react';
import axios from 'axios';

function PanelMaestro() {
  const [pestañaActiva, setPestañaActiva] = useState('solicitudes'); 
  const [pendientes, setPendientes] = useState([]);
  const [aprobados, setAprobados] = useState([]);
  const [totalAprobados, setTotalAprobados] = useState(0);
  const [logs, setLogs] = useState([]);
  
  // Nuevo estado para el botón de cierre manual
  const [cargandoCierre, setCargandoCierre] = useState(false);

  const backendUrl = 'https://nomia-pro-production.up.railway.app';

  useEffect(() => {
    cargarDatos();
  }, [pestañaActiva]);

  const cargarDatos = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };

      const resPendientes = await axios.get(`${backendUrl}/usuarios/pendientes`, { headers });
      setPendientes(resPendientes.data);

      const resContador = await axios.get(`${backendUrl}/usuarios/aprobados/count`, { headers });
      setTotalAprobados(resContador.data.total);

      if (pestañaActiva === 'aprobados') {
        const resAprobados = await axios.get(`${backendUrl}/usuarios/aprobados`, { headers });
        setAprobados(resAprobados.data);
      }

      if (pestañaActiva === 'logs') {
        try {
          const resLogs = await axios.get(`${backendUrl}/auditoria`, { headers });
          setLogs(resLogs.data);
        } catch (errorLogs) {
          console.error("Error al pedir los logs:", errorLogs.response?.data);
          alert(`⚠️ Error cargando los logs: ${errorLogs.response?.data?.error || errorLogs.message}`);
        }
      }

    } catch (error) {
      console.error('Error general en el Panel Maestro:', error);
    }
  };

  const revisarUsuario = async (id, nuevoEstado) => {
    if (nuevoEstado === 'Rechazado') {
      const confirmar = window.confirm('🛑 ¿Estás seguro que deseas quitarle el acceso a este usuario?');
      if (!confirmar) return;
    }

    try {
      const token = localStorage.getItem('token');
      const respuesta = await axios.put(`${backendUrl}/usuarios/revision/${id}`, 
        { nuevoEstado },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      alert(`✅ ${respuesta.data.mensaje}`);
      cargarDatos(); 
    } catch (error) {
      alert('❌ Error al procesar la solicitud');
    }
  };

  // NUEVA FUNCIÓN: Forzar Cierre Semanal Manual
  const forzarCierreSemanal = async () => {
    const confirmar = window.confirm("⚠️ ALERTA DE SISTEMA\n\n¿Estás seguro de que deseas cerrar la semana laboral AHORA?\n\nEsto enviará el reporte a tu correo, calculará la nómina y limpiará la base de datos.");
    
    if (!confirmar) return;

    setCargandoCierre(true);
    try {
      const token = localStorage.getItem('token');
      const respuesta = await axios.post(`${backendUrl}/api/nomina/forzar-cierre`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert(`✅ ÉXITO: ${respuesta.data.mensaje || 'Corte realizado y correos enviados.'}`);
      
      // Actualizar los logs si el dueño está en esa pestaña para que vea el movimiento
      if (pestañaActiva === 'logs') {
        cargarDatos();
      }
    } catch (error) {
      console.error('Error en el cierre manual:', error);
      alert("❌ Ocurrió un error al intentar hacer el cierre. Revisa que el backend esté respondiendo.");
    } finally {
      setCargandoCierre(false);
    }
  };

  const formatearFecha = (cadenaFecha) => {
    const opciones = { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true };
    return new Date(cadenaFecha).toLocaleString('es-VE', opciones);
  };

  return (
    <div className="w-full max-w-6xl mx-auto px-2 sm:px-4">
      
      {/* Cabecera y tarjeta superior */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-800">👑 Panel del Maestro</h2>
          <p className="text-sm text-slate-500">Centro de control, seguridad y auditoría.</p>
        </div>
        
        {/* Contenedor de las tarjetas superiores */}
        <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
          
          {/* BOTÓN NUEVO: FORZAR CIERRE SEMANAL */}
          <button 
            onClick={forzarCierreSemanal}
            disabled={cargandoCierre}
            className={`bg-white p-4 rounded-xl shadow border-l-4 border-red-500 flex items-center gap-4 w-full md:min-w-[220px] md:w-auto text-left transition transform hover:scale-105 ${cargandoCierre ? 'opacity-70 cursor-wait' : 'cursor-pointer hover:bg-red-50'}`}
            title="Forzar el cierre de nómina, limpiar asistencias y enviar correo en Excel"
          >
            <div className="bg-red-100 p-3 rounded-full text-2xl">🚨</div>
            <div>
              <p className="text-xs text-red-600 font-bold uppercase tracking-wider">Cierre Semanal</p>
              <p className="text-lg sm:text-xl font-black text-slate-800">
                {cargandoCierre ? 'Procesando...' : 'Forzar Manual'}
              </p>
            </div>
          </button>

          {/* TARJETA ORIGINAL: USUARIOS ACTIVOS */}
          <div 
            onClick={() => setPestañaActiva('aprobados')}
            className="bg-white p-4 rounded-xl shadow border-l-4 border-blue-500 flex items-center gap-4 w-full md:min-w-[220px] md:w-auto cursor-pointer hover:bg-blue-50 transition transform hover:scale-105"
            title="Clic para ver la lista de usuarios activos"
          >
            <div className="bg-blue-100 p-3 rounded-full text-2xl">👥</div>
            <div>
              <p className="text-xs text-blue-600 font-bold uppercase tracking-wider">Ver Activos</p>
              <p className="text-2xl sm:text-3xl font-black text-slate-800">{totalAprobados} <span className="text-xs sm:text-sm text-slate-500 font-normal">permitidos</span></p>
            </div>
          </div>

        </div>
      </div>

      {/* Pestañas de navegación adaptadas */}
      <div className="flex border-b border-slate-300 mb-6 overflow-x-auto whitespace-nowrap">
        <button 
          onClick={() => setPestañaActiva('solicitudes')}
          className={`py-3 px-4 sm:px-6 font-bold text-xs sm:text-sm transition ${pestañaActiva === 'solicitudes' ? 'border-b-4 border-yellow-500 text-yellow-600' : 'text-slate-500 hover:text-slate-800'}`}
        >
          ⏱️ Solicitudes Pendientes
        </button>
        <button 
          onClick={() => setPestañaActiva('aprobados')}
          className={`py-3 px-4 sm:px-6 font-bold text-xs sm:text-sm transition ${pestañaActiva === 'aprobados' ? 'border-b-4 border-blue-600 text-blue-600' : 'text-slate-500 hover:text-slate-800'}`}
        >
          ✅ Usuarios Activos
        </button>
        <button 
          onClick={() => setPestañaActiva('logs')}
          className={`py-3 px-4 sm:px-6 font-bold text-xs sm:text-sm transition ${pestañaActiva === 'logs' ? 'border-b-4 border-indigo-600 text-indigo-600' : 'text-slate-500 hover:text-slate-800'}`}
        >
          🕵️‍♂️ Registro de Auditoría (Logs)
        </button>
      </div>

      {/* --- VISTA 1: SOLICITUDES PENDIENTES --- */}
      {pestañaActiva === 'solicitudes' && (
        <div className="bg-white rounded-xl shadow-lg p-4 sm:p-8 animate-fade-in">
          {pendientes.length === 0 ? (
            <div className="bg-green-50 text-green-700 p-6 rounded-lg text-center font-medium border border-green-200 text-sm">
              🎉 ¡Todo al día! No hay solicitudes de acceso pendientes.
            </div>
          ) : (
            <div className="overflow-x-auto border rounded-lg">
              <table className="w-full text-left border-collapse min-w-[500px]">
                <thead>
                  <tr className="bg-slate-800 text-white text-xs sm:text-sm">
                    <th className="p-3 sm:p-4">ID</th>
                    <th className="p-3 sm:p-4">Usuario Solicitante</th>
                    <th className="p-3 sm:p-4">Rol Solicitado</th>
                    <th className="p-3 sm:p-4 text-center">Acción</th>
                  </tr>
                </thead>
                <tbody className="text-xs sm:text-sm">
                  {pendientes.map(user => (
                    <tr key={user.usuarioid} className="border-b hover:bg-slate-50">
                      <td className="p-3 sm:p-4 font-mono text-slate-500">#{user.usuarioid}</td>
                      <td className="p-3 sm:p-4 font-bold text-slate-700">{user.username}</td>
                      <td className="p-3 sm:p-4">
                        <span className={`px-2 sm:px-3 py-1 rounded-full text-[10px] sm:text-xs font-bold uppercase ${
                          user.rol === 'supervisor' ? 'bg-amber-100 text-amber-800' : 'bg-purple-100 text-purple-800'
                        }`}>
                          {user.rol || 'asistente'}
                        </span>
                      </td>
                      <td className="p-3 sm:p-4 flex flex-col sm:flex-row justify-center gap-2">
                        <button onClick={() => revisarUsuario(user.usuarioid, 'Aprobado')} className="bg-green-500 hover:bg-green-600 text-white px-3 py-1.5 rounded shadow font-bold transition text-xs">✅ Aprobar</button>
                        <button onClick={() => revisarUsuario(user.usuarioid, 'Rechazado')} className="bg-red-500 hover:bg-red-600 text-white px-3 py-1.5 rounded shadow font-bold transition text-xs">❌ Declinar</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* --- VISTA 2: USUARIOS ACTIVOS --- */}
      {pestañaActiva === 'aprobados' && (
        <div className="bg-white rounded-xl shadow-lg p-4 sm:p-8 animate-fade-in">
          <div className="mb-4">
            <h3 className="text-lg sm:text-xl font-bold text-slate-800">Cuentas con acceso actual al sistema</h3>
            <p className="text-xs sm:text-sm text-slate-500">Nota: El Maestro principal está protegido y no aparece en esta lista.</p>
          </div>
          
          {aprobados.length === 0 ? (
            <div className="bg-slate-50 text-slate-600 p-6 rounded-lg text-center font-medium border border-slate-200 text-sm">
              No hay otros usuarios activos aparte de ti.
            </div>
          ) : (
            <div className="overflow-x-auto border rounded-lg">
              <table className="w-full text-left border-collapse min-w-[500px]">
                <thead>
                  <tr className="bg-blue-600 text-white text-xs sm:text-sm">
                    <th className="p-3 sm:p-4">ID</th>
                    <th className="p-3 sm:p-4">Nombre de Usuario</th>
                    <th className="p-3 sm:p-4">Rol en el Sistema</th>
                    <th className="p-3 sm:p-4 text-center">Zona de Peligro</th>
                  </tr>
                </thead>
                <tbody className="text-xs sm:text-sm">
                  {aprobados.map(user => (
                    <tr key={user.usuarioid} className="border-b hover:bg-red-50 transition">
                      <td className="p-3 sm:p-4 font-mono text-slate-500">#{user.usuarioid}</td>
                      <td className="p-3 sm:p-4 font-bold text-slate-700">{user.username}</td>
                      <td className="p-3 sm:p-4">
                        <span className={`px-2 sm:px-3 py-1 rounded-full text-[10px] sm:text-xs font-bold uppercase ${
                          user.rol === 'supervisor' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'
                        }`}>
                          {user.rol}
                        </span>
                      </td>
                      <td className="p-3 sm:p-4 flex justify-center">
                        <button 
                          onClick={() => revisarUsuario(user.usuarioid, 'Rechazado')} 
                          className="bg-red-100 hover:bg-red-600 text-red-700 hover:text-white border border-red-300 px-3 py-1.5 rounded shadow-sm font-bold transition text-xs flex items-center gap-1"
                        >
                          ⛔ Revocar Acceso
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* --- VISTA 3: REGISTRO DE AUDITORÍA (LOGS) --- */}
      {pestañaActiva === 'logs' && (
        <div className="bg-white rounded-xl shadow-lg overflow-hidden animate-fade-in border border-slate-200">
          <div className="bg-slate-800 p-4 text-white flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <h3 className="font-bold text-sm sm:text-base">Historial de Movimientos</h3>
            <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
              <span className="text-[10px] sm:text-xs bg-slate-700 px-2 py-1 rounded">Tus acciones en tiempo real</span>
              <button 
                onClick={cargarDatos}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs px-3 py-1.5 rounded font-bold transition shadow"
              >
                🔄 Actualizar Logs
              </button>
            </div>
          </div>
          <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
            <table className="w-full text-left border-collapse text-xs sm:text-sm min-w-[600px]">
              <thead className="sticky top-0 bg-slate-100 shadow">
                <tr className="text-slate-700">
                  <th className="p-3 border-b">Fecha y Hora</th>
                  <th className="p-3 border-b">Usuario</th>
                  <th className="p-3 border-b">Acción</th>
                  <th className="p-3 border-b">Detalles (Descripción exacta)</th>
                </tr>
              </thead>
              <tbody>
                {logs.length === 0 ? (
                  <tr><td colSpan="4" className="p-6 text-center text-slate-500 text-xs sm:text-sm">No hay registros de auditoría aún (o hubo un error al cargar).</td></tr>
                ) : (
                  logs.map(log => (
                    <tr key={log.id} className="border-b hover:bg-slate-50 transition">
                      <td className="p-3 whitespace-nowrap text-slate-500 font-mono text-[11px]">{formatearFecha(log.fecha)}</td>
                      <td className="p-3 font-bold text-slate-700">{log.usuario}</td>
                      <td className="p-3">
                        <span className={`px-2 py-1 rounded text-[9px] sm:text-[10px] font-bold uppercase tracking-wider ${
                          log.accion.includes('SESION') ? 'bg-blue-100 text-blue-700' :
                          log.accion.includes('REVOCADO') || log.accion.includes('ERROR') || log.accion.includes('FALLIDO') ? 'bg-red-100 text-red-700' :
                          log.accion.includes('CREAR') || log.accion.includes('APROBADO') ? 'bg-green-100 text-green-700' :
                          'bg-slate-200 text-slate-700'
                        }`}>
                          {log.accion}
                        </span>
                      </td>
                      <td className="p-3 text-slate-600 text-xs">{log.detalles}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
}

export default PanelMaestro;