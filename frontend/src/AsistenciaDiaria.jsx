import React, { useState, useEffect } from 'react';
import axios from 'axios';

// Función para obtener la fecha local correcta y no rodar de día por el UTC (Ajustado a Venezuela UTC-4)
const getFechaHoyLocal = () => {
  const now = new Date();
  const vetTime = new Date(now.getTime() - (4 * 60 * 60 * 1000));
  return vetTime.toISOString().split('T')[0];
};

function AsistenciaDiaria() {
  const [empleados, setEmpleados] = useState([]);
  const [fechaSeleccionada, setFechaSeleccionada] = useState(getFechaHoyLocal());
  const [busqueda, setBusqueda] = useState('');
  const [cargando, setCargando] = useState(true);
  
  // NUEVO: Estado para saber qué empleado estamos editando su justificación
  const [editandoJustificacion, setEditandoJustificacion] = useState({});

  const rolUsuario = localStorage.getItem('rol'); 
  const esSupervisor = rolUsuario === 'supervisor';
  const backendUrl = 'https://nomia-pro-production.up.railway.app';
  
  // Hora actual calculada estrictamente en base a Venezuela (UTC-4) para evitar discrepancias con el servidor
  const now = new Date();
  const vetTime = new Date(now.getTime() - (4 * 60 * 60 * 1000));
  const horaActual = vetTime.getHours();

  // El supervisor no puede editar si ya son las 5:00 PM (17 hrs) o más, o si de algún modo alteró la fecha
  const bloqueadoPorHora = esSupervisor && horaActual >= 17;
  const bloqueadoPorFecha = esSupervisor && fechaSeleccionada !== getFechaHoyLocal();
  const modoSoloLectura = bloqueadoPorHora || bloqueadoPorFecha;

  useEffect(() => {
    cargarAsistencia(fechaSeleccionada);
  }, [fechaSeleccionada]);

  const cargarAsistencia = async (fecha) => {
    setCargando(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${backendUrl}/asistencia?fecha=${fecha}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      // Mapeo inicial: Permitimos que venga nulo (vacío) desde la base de datos
      setEmpleados(res.data.map(emp => ({ ...emp, asistencia_estado: emp.asistencia_estado || '', observacion: emp.observacion || '' })));
      // Limpiamos los estados de edición al cambiar de fecha
      setEditandoJustificacion({});
    } catch (error) {
      console.error("Error cargando asistencia:", error);
    } finally {
      setCargando(false);
    }
  };

  // Esta función ahora se usa principalmente para Presente y Ausente
  const guardarAsistenciaIndividual = async (empleadoID, nuevoEstado, observacionActual) => {
    if (modoSoloLectura) return; // Candado extra por seguridad

    // Si le dan a "Justificado", solo cambia el estado visualmente y abre el input, NO guarda aún.
    if (nuevoEstado === 'Justificado') {
       setEmpleados(empleados.map(emp => 
        emp.empleadoid === empleadoID ? { ...emp, asistencia_estado: 'Justificado' } : emp
      ));
      // Activamos el modo edición automáticamente para este empleado
      setEditandoJustificacion(prev => ({ ...prev, [empleadoID]: true }));
      return; 
    }

    // Para Presente y Ausente, sí guarda inmediatamente
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${backendUrl}/asistencia`, {
        empleadoID,
        fecha: fechaSeleccionada,
        estado: nuevoEstado,
        observacion: observacionActual
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setEmpleados(empleados.map(emp => 
        emp.empleadoid === empleadoID ? { ...emp, asistencia_estado: nuevoEstado } : emp
      ));
    } catch (error) {
      alert('❌ Error al guardar asistencia');
    }
  };

  const manejarCambioObservacion = (empleadoID, texto) => {
    if (modoSoloLectura) return;
    setEmpleados(empleados.map(emp => 
      emp.empleadoid === empleadoID ? { ...emp, observacion: texto } : emp
    ));
  };

  // Esta función ahora sirve para guardar la justificación y su motivo
  const guardarObservacionYJustificacion = async (empleadoID, estadoActual, observacionActual) => {
    if (modoSoloLectura) return;
    
    // Validación para asegurarse de que escriban el motivo
    if (estadoActual === 'Justificado' && (!observacionActual || observacionActual.trim() === '')) {
      alert('⚠️ Debes escribir el motivo de la justificación antes de guardar.');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      await axios.post(`${backendUrl}/asistencia`, {
        empleadoID,
        fecha: fechaSeleccionada,
        estado: estadoActual, // Será 'Justificado'
        observacion: observacionActual
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Apagamos el modo edición para mostrar el texto transparente con el lápiz
      setEditandoJustificacion(prev => ({ ...prev, [empleadoID]: false }));
      alert('✅ Falta justificada guardada con éxito');
    } catch (error) {
      alert('❌ Error al guardar la justificación');
    }
  };

  const empleadosFiltrados = empleados.filter(emp => {
    const texto = String(busqueda).toLowerCase();
    const dni = String(emp.dni || '').toLowerCase();
    const nombre = String(emp.nombre || '').toLowerCase();
    const apellido = String(emp.apellido || '').toLowerCase();
    const cuadrilla = String(emp.cuadrilla || '').toLowerCase();
    const puesto = String(emp.puesto || '').toLowerCase();

    // SUPER BUSCADOR: Ahora busca por número de cuadrilla o por nombre del puesto también
    return dni.includes(texto) || nombre.includes(texto) || apellido.includes(texto) || cuadrilla.includes(texto) || puesto.includes(texto);
  });

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 px-2 sm:px-4">
      
      {/* ALERTA DE BLOQUEO PARA SUPERVISOR */}
      {bloqueadoPorHora && (
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-lg shadow-sm font-bold flex items-center gap-3 animate-pulse text-xs sm:text-sm">
          <span>🛑</span> La jornada ha cerrado. No puedes modificar ni agregar asistencias después de las 5:00 PM.
        </div>
      )}

      {/* ENCABEZADO */}
      <div className="bg-slate-800 rounded-xl p-4 sm:p-8 text-white shadow-lg flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="text-center md:text-left">
          <h2 className="text-2xl sm:text-3xl font-black mb-1">📅 Control de Asistencia Diaria</h2>
          <p className="text-slate-300 text-xs sm:text-sm">Gestiona la presencia y notas del personal por tarjetas de trabajo.</p>
        </div>
        
        <div className="flex items-center gap-3 bg-slate-900 px-4 py-2.5 rounded-lg border border-slate-700">
          <span className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase">Jornada:</span>
          
          {esSupervisor ? (
            <span className="bg-slate-800 text-slate-200 font-bold px-3 py-1 rounded border border-slate-600 text-xs sm:text-sm">
              {fechaSeleccionada} (Hoy)
            </span>
          ) : (
            <input 
              type="date" 
              value={fechaSeleccionada}
              onChange={(e) => setFechaSeleccionada(e.target.value)}
              className="bg-slate-800 text-white font-bold p-1 rounded outline-none text-xs sm:text-sm cursor-pointer"
            />
          )}
        </div>
      </div>

      {/* SUPER BUSCADOR */}
      <div className="bg-white rounded-xl shadow-md p-3 border border-slate-200 flex items-center gap-3">
        <span className="text-xl pl-2">🔍</span>
        <input 
          type="text"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por empleado, puesto (Ej: Herrero) o número de cuadrilla (Ej: 3)..."
          className="w-full outline-none text-slate-700 font-medium placeholder-slate-400 text-xs sm:text-sm"
        />
        {busqueda && (
          <button onClick={() => setBusqueda('')} className="text-[10px] sm:text-xs bg-slate-200 hover:bg-slate-300 text-slate-600 font-bold px-3 py-1.5 rounded-lg transition">Limpiar</button>
        )}
      </div>

      {cargando ? (
        <div className="text-center py-16 text-slate-500 font-medium bg-white rounded-xl shadow">Cargando personal...</div>
      ) : empleadosFiltrados.length === 0 ? (
        <div className="text-center py-16 text-slate-500 font-medium bg-white rounded-xl shadow">No se encontraron empleados.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {empleadosFiltrados.map(emp => (
            <div 
              key={emp.empleadoid} 
              className={`bg-white rounded-2xl shadow-md border-2 p-4 sm:p-6 flex flex-col justify-between transition ${
                emp.asistencia_estado === 'Presente' ? 'border-green-400 bg-green-50/20' :
                emp.asistencia_estado === 'Ausente' ? 'border-red-400 bg-red-50/20' : 
                emp.asistencia_estado === 'Justificado' ? 'border-gray-400 bg-gray-50/20' : 'border-slate-200'
              } ${!modoSoloLectura && 'transform hover:-translate-y-1'}`}
            >
              <div>
                <div className="flex justify-between items-start mb-2">
                  <span className="bg-slate-100 text-slate-700 text-[10px] font-mono font-bold px-2.5 py-1 rounded-md border border-slate-200">
                    {emp.dni}
                  </span>
                  <span className="text-[9px] font-black uppercase px-2.5 py-1 rounded-full bg-slate-100 text-slate-500">
                    {emp.asistencia_estado || 'Sin Registro'}
                  </span>
                </div>
                <h3 className="text-base sm:text-lg font-black text-slate-800 mb-0.5">{emp.apellido}, {emp.nombre}</h3>
                
                {/* AQUI MOSTRAMOS EL PUESTO Y LA CUADRILLA */}
                <div className="flex items-center gap-2 mb-4 mt-1">
                  <p className="text-[10px] sm:text-xs text-slate-500 font-semibold">💼 {emp.puesto}</p>
                  <span className="text-gray-300">|</span>
                  <p className="text-[10px] sm:text-xs text-yellow-700 font-bold bg-yellow-50 px-2 py-0.5 rounded border border-yellow-200">
                    👷‍♂️ {emp.cuadrilla || 'Sin Cuadrilla'}
                  </p>
                </div>
              </div>

              <div className="space-y-4 pt-4 border-t border-slate-100">
                <div className="grid grid-cols-3 gap-2 sm:gap-3">
                  <button
                    onClick={() => guardarAsistenciaIndividual(emp.empleadoid, 'Presente', emp.observacion)}
                    disabled={modoSoloLectura}
                    title="Presente"
                    className={`py-2 rounded-xl text-lg sm:text-xl flex justify-center items-center transition shadow-sm ${
                      emp.asistencia_estado === 'Presente' ? 'bg-green-100 border-2 border-green-500 scale-105' : 'bg-slate-50 border border-transparent'
                    } ${!modoSoloLectura ? 'hover:bg-green-50 cursor-pointer' : 'opacity-50 cursor-not-allowed grayscale'}`}
                  >
                    ✅
                  </button>
                  <button
                    onClick={() => guardarAsistenciaIndividual(emp.empleadoid, 'Ausente', emp.observacion)}
                    disabled={modoSoloLectura}
                    title="Ausente"
                    className={`py-2 rounded-xl text-lg sm:text-xl flex justify-center items-center transition shadow-sm ${
                      emp.asistencia_estado === 'Ausente' ? 'bg-red-100 border-2 border-red-500 scale-105' : 'bg-slate-50 border border-transparent'
                    } ${!modoSoloLectura ? 'hover:bg-red-50 cursor-pointer' : 'opacity-50 cursor-not-allowed grayscale'}`}
                  >
                    ❌
                  </button>
                  <button
                    onClick={() => guardarAsistenciaIndividual(emp.empleadoid, 'Justificado', emp.observacion)}
                    disabled={modoSoloLectura}
                    title="Justificado (Falta cubierta)"
                    className={`py-2 rounded-xl text-lg sm:text-xl flex justify-center items-center transition shadow-sm ${
                      emp.asistencia_estado === 'Justificado' ? 'bg-gray-200 border-2 border-gray-500 scale-105' : 'bg-slate-50 border border-transparent'
                    } ${!modoSoloLectura ? 'hover:bg-gray-100 cursor-pointer' : 'opacity-50 cursor-not-allowed grayscale'}`}
                  >
                    ⚪
                  </button>
                </div>

                {/* LA BARRA DE NOTA SOLO APARECE SI EL ESTADO ES JUSTIFICADO */}
                {emp.asistencia_estado === 'Justificado' && (
                  <div className="mt-2 animate-fade-in">
                    {editandoJustificacion[emp.empleadoid] ? (
                      /* MODO EDICIÓN: Input normal y botón de guardar */
                      <div className="flex gap-2 items-center bg-gray-50 p-2 rounded-lg border border-gray-200">
                        <input 
                          type="text" 
                          value={emp.observacion} 
                          onChange={(e) => manejarCambioObservacion(emp.empleadoid, e.target.value)} 
                          placeholder="Escribe el motivo..." 
                          className="w-full p-2 border border-blue-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-blue-500 bg-white" 
                        />
                        <button 
                          onClick={() => guardarObservacionYJustificacion(emp.empleadoid, 'Justificado', emp.observacion)} 
                          className="bg-blue-600 text-white px-3 py-2 rounded-lg text-xs font-bold transition hover:bg-blue-700 shadow"
                          title="Guardar Justificación"
                        >
                          💾
                        </button>
                      </div>
                    ) : (
                      /* MODO LECTURA / GUARDADO: Texto transparente y botón editar */
                      <div className="flex gap-2 items-center justify-between bg-transparent border border-transparent p-2 rounded-lg">
                        <p className="text-xs text-slate-700 italic font-medium w-full px-1 truncate" title={emp.observacion}>
                          "{emp.observacion || 'Sin motivo especificado'}"
                        </p>
                        <button 
                          onClick={() => setEditandoJustificacion(prev => ({ ...prev, [emp.empleadoid]: true }))} 
                          disabled={modoSoloLectura}
                          className={`text-slate-600 bg-slate-200 hover:bg-slate-300 px-3 py-2 rounded-lg text-xs font-bold transition shadow-sm flex items-center justify-center ${modoSoloLectura ? 'opacity-50 cursor-not-allowed' : ''}`}
                          title="Editar Justificación"
                        >
                          ✏️
                        </button>
                      </div>
                    )}
                  </div>
                )}
                
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default AsistenciaDiaria;