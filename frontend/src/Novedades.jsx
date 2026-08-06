import React, { useState, useEffect } from 'react';
import axios from 'axios';

function Novedades() {
  const [sanciones, setSanciones] = useState([]);
  const [quejas, setQuejas] = useState([]);
  
  // Estados para el reporte y selección de múltiples empleados
  const [todosEmpleados, setTodosEmpleados] = useState([]);
  const [busquedaEmp, setBusquedaEmp] = useState('');
  const [empleadosSeleccionados, setEmpleadosSeleccionados] = useState([]);
  const [tipoIncidencia, setTipoIncidencia] = useState('Agua');
  const [descripcion, setDescripcion] = useState('');
  const [cargando, setCargando] = useState(false);
  
  // Saber si el usuario actual es el Master
  const rolUsuario = localStorage.getItem('rol');

  useEffect(() => {
    cargarNovedades();
    cargarListaEmpleados();
  }, []);

  const cargarNovedades = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get('[https://nomia-pro-production.up.railway.app](https://nomia-pro-production.up.railway.app)/novedades', { headers: { Authorization: `Bearer ${token}` } });
      setSanciones(res.data.sanciones || []);
      setQuejas(res.data.quejas || []);
    } catch (error) {
      console.error('Error cargando novedades', error);
    }
  };

  const cargarListaEmpleados = async () => {
    try {
      const token = localStorage.getItem('token');
      // Solicitamos limit=all para que Novedades tenga acceso a la lista completa para el buscador de incidencias
      const res = await axios.get('[https://nomia-pro-production.up.railway.app](https://nomia-pro-production.up.railway.app)/empleados?limit=all', { headers: { Authorization: `Bearer ${token}` } });
      // CORREGIDO: Extraemos el arreglo de empleados de la respuesta paginada del backend
      const lista = Array.isArray(res.data) ? res.data : (res.data.empleados || []);
      setTodosEmpleados(lista);
    } catch (error) {
      console.error('Error cargando empleados para el buscador', error);
      setTodosEmpleados([]);
    }
  };

  const empleadosFiltrados = Array.isArray(todosEmpleados) ? todosEmpleados.filter(emp => {
    if (busquedaEmp.length < 1) return false;
    const txt = busquedaEmp.toLowerCase();
    const yaSeleccionado = empleadosSeleccionados.some(sel => (sel.empleadoid || sel.empleadoID) === (emp.empleadoid || emp.empleadoID));
    if (yaSeleccionado) return false;
    return (
      (emp.dni && emp.dni.toLowerCase().includes(txt)) ||
      (emp.nombre && emp.nombre.toLowerCase().includes(txt)) ||
      (emp.apellido && emp.apellido.toLowerCase().includes(txt))
    );
  }) : [];

  const agregarEmpleado = (emp) => {
    setEmpleadosSeleccionados([...empleadosSeleccionados, emp]);
    setBusquedaEmp('');
  };

  const quitarEmpleado = (id) => {
    setEmpleadosSeleccionados(empleadosSeleccionados.filter(emp => (emp.empleadoid || emp.empleadoID) !== id));
  };

  const enviarQueja = async (e) => {
    e.preventDefault();
    setCargando(true);

    try {
      const token = localStorage.getItem('token');
      
      let textoEmpleados = '';
      if (empleadosSeleccionados.length > 0) {
        const listaNombres = empleadosSeleccionados.map(e => `${e.nombre} ${e.apellido} (C.I: ${e.dni})`).join(', ');
        textoEmpleados = `[Involucrados: ${listaNombres}] `;
      }
      
      const descripcionFinal = textoEmpleados + descripcion;

      await axios.post('[https://nomia-pro-production.up.railway.app](https://nomia-pro-production.up.railway.app)/quejas', {
        tipo: tipoIncidencia,
        descripcion: descripcionFinal
      }, { 
        headers: { Authorization: `Bearer ${token}` } 
      });
      
      alert('✅ Incidencia reportada con éxito.');
      setDescripcion('');
      setEmpleadosSeleccionados([]);
      setTipoIncidencia('Agua');
      cargarNovedades(); 
    } catch (error) {
      const mensajeError = error.response?.data?.error || error.message;
      alert(`❌ Error al reportar la incidencia: ${mensajeError}`);
    } finally {
      setCargando(false); 
    }
  };

  const eliminarReporte = async (id) => {
    const confirmar = window.confirm('🛑 ¿Estás seguro de que deseas eliminar este reporte permanentemente?');
    if (!confirmar) return;

    try {
      const token = localStorage.getItem('token');
      await axios.delete(`[https://nomia-pro-production.up.railway.app](https://nomia-pro-production.up.railway.app)/quejas/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert('✅ Reporte eliminado correctamente.');
      cargarNovedades();
    } catch (error) {
      const msg = error.response?.data?.error || 'Error al eliminar el reporte';
      alert(`❌ ${msg}`);
    }
  };

  const calcularEstadoSancion = (diasTotales, diasTranscurridos) => {
    const total = parseInt(diasTotales) || 0;
    const transcurridos = parseInt(diasTranscurridos) || 0;
    const restantes = total - transcurridos;

    if (restantes > 0) {
      return { texto: `Faltan ${restantes} días`, color: 'bg-orange-100 text-orange-700 border-orange-300' };
    } else if (restantes === 0) {
      return { texto: 'Termina Hoy', color: 'bg-yellow-100 text-yellow-700 border-yellow-300' };
    } else {
      return { texto: '¡Sanción Cumplida!', color: 'bg-green-100 text-green-700 border-green-300' };
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6">
      
      {/* ENCABEZADO CON BOTÓN DE RECARGA */}
      <div className="bg-slate-800 rounded-xl p-8 text-white shadow-lg flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h2 className="text-3xl font-black mb-2">📰 Panel de Novedades y Monitoreo</h2>
          <p className="text-slate-300">Monitorea el estado de las suspensiones y reporta incidencias diarias en la finca.</p>
        </div>
        <button 
          onClick={cargarNovedades}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg font-bold transition shadow flex items-center gap-2 text-sm whitespace-nowrap"
        >
          🔄 Actualizar Novedades
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* COLUMNA 1: SANCIONES ACTIVAS */}
        <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-6">
          <h3 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">⏱️ Control de Suspensiones</h3>
          <p className="text-sm text-slate-500 mb-4">Empleados con suspensión vigente (desaparecen al cumplirse el plazo).</p>
          
          <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
            {sanciones.length === 0 ? (
              <p className="p-4 bg-slate-50 text-slate-500 text-center rounded italic border border-dashed">No hay empleados suspendidos actualmente.</p>
            ) : (
              sanciones.map((s, index) => {
                const estado = calcularEstadoSancion(s.dias_suspension, s.dias_transcurridos);
                return (
                  <div key={s.empleadoid || index} className="p-4 border rounded-lg shadow-sm flex flex-col justify-between hover:shadow-md transition bg-slate-50">
                    <div>
                      <h4 className="font-bold text-slate-700">{s.nombre} {s.apellido}</h4>
                      <p className="text-xs text-slate-500 mt-1"><span className="font-semibold">Motivo:</span> {s.motivo}</p>
                      <p className="text-xs text-slate-500"><span className="font-semibold">Inició:</span> {s.fecha ? new Date(s.fecha).toLocaleDateString('es-VE') : 'Reciente'}</p>
                    </div>
                    <div className={`mt-3 px-3 py-2 rounded font-bold text-sm text-center border ${estado.color}`}>
                      {estado.texto} ({s.dias_suspension} días en total)
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* COLUMNA 2: INCIDENCIAS Y LISTADO CON ELIMINACIÓN DE MASTER */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-6">
            <h3 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">📢 Reportar Incidencia</h3>
            <form onSubmit={enviarQueja} className="space-y-4">
              
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Tipo de Incidencia:</label>
                <select 
                  className="w-full p-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 bg-white font-medium disabled:bg-gray-100" 
                  value={tipoIncidencia} 
                  onChange={e => setTipoIncidencia(e.target.value)}
                  disabled={cargando}
                >
                  <option value="Agua">💧 Agua</option>
                  <option value="Comida">🍲 Comida</option>
                  <option value="Problemas hacia el trato u otros">⚠️ Problemas hacia el trato u otros</option>
                </select>
              </div>

              {/* SELECCIÓN DE EMPLEADOS POR CÉDULA O NOMBRE */}
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Buscar y Seleccionar Empleados Involucrados (por Cédula o Nombre):</label>
                <input 
                  type="text"
                  placeholder="Escribe la cédula o nombre..."
                  value={busquedaEmp}
                  onChange={e => setBusquedaEmp(e.target.value)}
                  disabled={cargando}
                  className="w-full p-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />

                {empleadosFiltrados.length > 0 && (
                  <div className="max-h-36 overflow-y-auto border rounded-lg mt-1 bg-slate-50 shadow-sm">
                    {empleadosFiltrados.map(emp => (
                      <div 
                        key={emp.empleadoid || emp.empleadoID}
                        onClick={() => agregarEmpleado(emp)}
                        className="p-2 hover:bg-blue-100 cursor-pointer text-xs flex justify-between items-center border-b last:border-none"
                      >
                        <span className="font-bold text-slate-700">{emp.nombre} {emp.apellido}</span>
                        <span className="font-mono text-slate-500">C.I: {emp.dni}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex flex-wrap gap-2 mt-2">
                  {empleadosSeleccionados.map(emp => (
                    <span 
                      key={emp.empleadoid || emp.empleadoID} 
                      className="bg-blue-100 text-blue-800 text-xs font-bold px-3 py-1 rounded-full flex items-center gap-2 border border-blue-300"
                    >
                      {emp.nombre} {emp.apellido} ({emp.dni})
                      <button 
                        type="button" 
                        onClick={() => quitarEmpleado(emp.empleadoid || emp.empleadoID)}
                        className="text-red-600 font-black hover:text-red-800 ml-1"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                  {empleadosSeleccionados.length === 0 && (
                    <p className="text-[11px] text-slate-400 italic">Ningún empleado seleccionado (opcional).</p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Descripción detallada:</label>
                <textarea 
                  required 
                  className="w-full p-3 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 h-24 resize-none disabled:bg-gray-100" 
                  placeholder="Describe brevemente lo ocurrido..." 
                  value={descripcion} 
                  onChange={e => setDescripcion(e.target.value)}
                  disabled={cargando}
                ></textarea>
              </div>

              <button 
                type="submit" 
                disabled={cargando}
                className="w-full bg-slate-800 hover:bg-black text-white font-bold py-2.5 rounded-lg transition shadow disabled:opacity-50"
              >
                {cargando ? 'Guardando reporte...' : 'Guardar Reporte'}
              </button>
            </form>
          </div>

          {/* LISTA DE ÚLTIMOS REPORTES */}
          <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-6">
            <h3 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">📋 Últimos Reportes</h3>
            <div className="max-h-64 overflow-y-auto pr-2 space-y-3">
              {quejas.length === 0 ? (
                <p className="p-4 bg-slate-50 text-slate-500 text-center rounded italic border border-dashed">Sin novedades recientes.</p>
              ) : (
                quejas.map((q, index) => (
                  <div key={q.quejaid || index} className="p-3 border-l-4 border-blue-500 bg-slate-50 rounded shadow-sm flex justify-between items-start">
                    <div className="space-y-1 pr-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-blue-700 uppercase bg-blue-50 px-2 py-0.5 rounded border border-blue-200">{q.tipo}</span>
                        <span className="text-xs text-slate-400 font-mono">{q.fechaqueja ? new Date(q.fechaqueja).toLocaleDateString('es-VE') : 'Hoy'}</span>
                      </div>
                      <p className="text-sm text-slate-700 mt-1">{q.descripcion}</p>
                    </div>

                    {rolUsuario === 'master' && (
                      <button 
                        onClick={() => eliminarReporte(q.quejaid)}
                        title="Eliminar este reporte"
                        className="text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 p-1.5 rounded transition font-bold text-xs shrink-0"
                      >
                        🗑️
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

export default Novedades;