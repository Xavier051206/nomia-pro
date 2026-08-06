import React, { useState, useEffect } from 'react';
import axios from 'axios';

function Dashboard() {
  const [stats, setStats] = useState({ 
    activos: 0, 
    sancionados: 0, 
    total: 0,
    totalNomina: '0.00',
    porcentajeAsistencia: '0.00'
  });
  const [cargando, setCargando] = useState(true);
  const [mostrarBotonExportar, setMostrarBotonExportar] = useState(false);
  const [exportando, setExportando] = useState(false);

  useEffect(() => {
    cargarEstadisticas();
    verificarSiTocaExportar();
  }, []);

  const cargarEstadisticas = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get('http://localhost:3000/dashboard/stats', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setStats(res.data);
    } catch (error) {
      console.error('Error cargando estadísticas:', error);
    } finally {
      setCargando(false);
    }
  };

  const verificarSiTocaExportar = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get('http://localhost:3000/corte-semanal/verificar', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data.pendiente) {
        setMostrarBotonExportar(true);
      } else {
        setMostrarBotonExportar(false); 
      }
    } catch (error) {
      console.error('Error verificando estado del corte:', error);
    }
  };

  const ejecutarCorteYExportar = async () => {
    setExportando(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.post('http://localhost:3000/corte-semanal/ejecutar', {}, {
        headers: { Authorization: `Bearer ${token}` }
      });

      alert(`✅ ${res.data.mensaje}`);
      setMostrarBotonExportar(false); 

      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(res.data.datos, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `Corte_Semanal_${new Date().toISOString().split('T')[0]}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();

      cargarEstadisticas();
    } catch (error) {
      alert(`❌ Error al exportar: ${error.response?.data?.error || error.message}`);
    } finally {
      setExportando(false);
    }
  };

  // Protecciones para evitar los "undefined" si el backend responde lento o con info vieja
  const asistenciaSegura = stats.porcentajeAsistencia !== undefined ? stats.porcentajeAsistencia : '0.00';
  const nominaSegura = stats.totalNomina !== undefined ? stats.totalNomina : '0.00';

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6 animate-fade-in">
      
      {/* ENCABEZADO */}
      <div className="bg-slate-800 rounded-xl p-8 text-white shadow-lg flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h2 className="text-3xl font-black mb-2">📊 Panel Principal (Dashboard)</h2>
          <p className="text-slate-300">Resumen operativo del personal, finanzas y métricas de la finca.</p>
        </div>

        {mostrarBotonExportar && (
          <button 
            onClick={ejecutarCorteYExportar}
            disabled={exportando}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-lg font-bold transition shadow flex items-center gap-2 text-sm whitespace-nowrap animate-bounce disabled:opacity-50 disabled:animate-none shrink-0"
          >
            {exportando ? 'Exportando...' : '📥 Exportar y Limpiar'}
          </button>
        )}
      </div>

      {/* TARJETAS DE MÉTRICAS (Estructura 2x2 con md:grid-cols-2) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* TARJETA 1: EMPLEADOS ACTIVOS */}
        <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-6 flex flex-col justify-between hover:-translate-y-1 transition transform h-full">
          <div className="flex justify-between items-start gap-4">
            <div className="min-w-0">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider truncate">Empleados Activos</p>
              <h3 className="text-4xl font-black text-slate-800 mt-2 truncate">
                {cargando ? '...' : stats.activos}
              </h3>
            </div>
            <div className="bg-green-100 p-3 rounded-xl text-green-700 text-xl font-bold shrink-0">👥</div>
          </div>
          <p className="text-xs text-green-600 font-semibold mt-4">🟢 Trabajando actualmente</p>
        </div>

        {/* TARJETA 2: EMPLEADOS SANCIONADOS */}
        <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-6 flex flex-col justify-between hover:-translate-y-1 transition transform h-full">
          <div className="flex justify-between items-start gap-4">
            <div className="min-w-0">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider truncate">Sancionados</p>
              <h3 className="text-4xl font-black text-slate-800 mt-2 truncate">
                {cargando ? '...' : stats.sancionados}
              </h3>
            </div>
            <div className="bg-orange-100 p-3 rounded-xl text-orange-700 text-xl font-bold shrink-0">⏱️</div>
          </div>
          <p className="text-xs text-orange-600 font-semibold mt-4">🟡 Suspendidos temporalmente</p>
        </div>

        {/* TARJETA 3: PORCENTAJE DE ASISTENCIA */}
        <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-6 flex flex-col justify-between hover:-translate-y-1 transition transform h-full">
          <div className="flex justify-between items-start gap-4">
            <div className="min-w-0 w-full">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider truncate">% Asistencia Global</p>
              <h3 className="text-4xl font-black text-slate-800 mt-2 truncate">
                {cargando ? '...' : `${asistenciaSegura}%`}
              </h3>
            </div>
            <div className="bg-blue-100 p-3 rounded-xl text-blue-700 text-xl font-bold shrink-0">📈</div>
          </div>
          
          <div className="mt-4 w-full bg-slate-100 rounded-full h-2">
            <div className="bg-blue-600 h-2 rounded-full transition-all duration-1000" style={{ width: `${Number(asistenciaSegura) || 0}%` }}></div>
          </div>
        </div>

        {/* TARJETA 4: PROYECCIÓN DE NÓMINA (PLATA) */}
        <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl shadow-lg border border-emerald-200 p-6 flex flex-col justify-between hover:-translate-y-1 transition transform h-full">
          <div className="flex justify-between items-start gap-4">
            <div className="min-w-0">
              <p className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider truncate">Proyección Nómina</p>
              <h3 className="text-4xl font-black text-emerald-900 mt-2 tracking-tight truncate">
                {cargando ? '...' : `$${nominaSegura}`}
              </h3>
            </div>
            <div className="bg-emerald-200 p-3 rounded-xl text-emerald-800 text-xl font-bold shrink-0">💸</div>
          </div>
          <p className="text-xs text-emerald-700 mt-4 border-t border-emerald-200 pt-3 font-medium">
            Dinero estimado a pagar esta semana.
          </p>
        </div>

      </div>

    </div>
  );
}

export default Dashboard;