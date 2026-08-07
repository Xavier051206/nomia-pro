import React, { useState, useEffect } from 'react';
import axios from 'axios'; 
import ListaEmpleados from './ListaEmpleados'; 
import AgregarEmpleado from './AgregarEmpleado';
import EditarEmpleado from './EditarEmpleado'; 
import Novedades from './Novedades'; 
import Auth from './Auth'; 
import PanelMaestro from './PanelMaestro'; 
import Dashboard from './Dashboard'; 
import AsistenciaDiaria from './AsistenciaDiaria'; 

function App() {
  const [estaAutenticado, setEstaAutenticado] = useState(false);
  const [vistaActiva, setVistaActiva] = useState('dashboard'); 
  
  const [mostrarModalCorteGlobal, setMostrarModalCorteGlobal] = useState(false);
  const [exportandoGlobal, setExportandoGlobal] = useState(false);
  const [menuAbierto, setMenuAbierto] = useState(false); // Estado para el menú hamburguesa en móviles

  const rolUsuario = localStorage.getItem('rol'); 
  const nombreUsuario = localStorage.getItem('username');
  const backendUrl = 'https://nomia-pro-production.up.railway.app';

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      setEstaAutenticado(true);
      
      if (rolUsuario === 'supervisor') {
        setVistaActiva('novedades');
      }

      verificarCorteGlobal(token);
    }
  }, []);

  const verificarCorteGlobal = async (token) => {
    try {
      const res = await axios.get(`${backendUrl}/corte-semanal/verificar`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data.pendiente) {
        setMostrarModalCorteGlobal(true);
      }
    } catch (error) {
      console.error('Error verificando corte global:', error);
    }
  };

  const ejecutarCorteGlobalYExportar = async () => {
    setExportandoGlobal(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.post(`${backendUrl}/corte-semanal/ejecutar`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });

      alert(`✅ ${res.data.mensaje}`);
      setMostrarModalCorteGlobal(false);

      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(res.data.datos, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `Corte_Semanal_${new Date().toISOString().split('T')[0]}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();

      window.location.reload();
    } catch (error) {
      alert(`❌ Error al exportar: ${error.response?.data?.error || error.message}`);
    } finally {
      setExportandoGlobal(false);
    }
  };

  const cerrarSesion = async () => {
    try {
      const token = localStorage.getItem('token');
      if (token) {
        await axios.post(`${backendUrl}/logout`, {}, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }
    } catch (error) {
      console.error("No se pudo registrar la salida en el servidor:", error);
    } finally {
      localStorage.clear(); 
      setEstaAutenticado(false); 
    }
  };

  if (!estaAutenticado) {
    return <Auth onLoginSuccess={() => setEstaAutenticado(true)} />;
  }

  const cambiarVista = (vista) => {
    setVistaActiva(vista);
    setMenuAbierto(false); // Cierra el menú en móviles automáticamente al elegir una opción
  };

  return (
    <div className="flex flex-col md:flex-row h-screen bg-gray-100 font-sans relative overflow-hidden">
      
      {/* 🚨 NOTIFICACIÓN GLOBAL DE CORTE SEMANAL */}
      {mostrarModalCorteGlobal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 sm:p-8 border-4 border-amber-400 text-center space-y-4">
            <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center text-3xl mx-auto">
              ⏰
            </div>
            <h3 className="text-xl sm:text-2xl font-black text-slate-800">¡Cierre Operativo Semanal Requerido!</h3>
            <p className="text-slate-600 text-xs sm:text-sm leading-relaxed">
              Es momento del corte semanal (Sábado &gt; 3:00 PM). El sistema requiere exportar los datos para respaldar la información y limpiar el panel de reportes para el próximo lunes.
            </p>
            <div className="pt-4 flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => setMostrarModalCorteGlobal(false)}
                className="w-full sm:flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold py-3 rounded-xl transition text-sm"
              >
                Cancelar / Modificar
              </button>
              <button
                onClick={ejecutarCorteGlobalYExportar}
                disabled={exportandoGlobal}
                className="w-full sm:flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl transition shadow-lg disabled:opacity-50 text-sm"
              >
                {exportandoGlobal ? 'Exportando...' : '📥 Exportar y Limpiar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BOTÓN FLOTANTE PARA MENÚ EN MÓVILES */}
      <div className="md:hidden bg-slate-900 text-white p-4 flex justify-between items-center shadow-md z-30 shrink-0">
        <h1 className="font-bold text-xl tracking-wide">Nómina<span className="text-blue-400">Pro</span></h1>
        <button 
          onClick={() => setMenuAbierto(!menuAbierto)}
          className="bg-slate-800 p-2 rounded-lg text-white font-bold focus:outline-none"
        >
          {menuAbierto ? '✕ Cerrar' : '☰ Menú'}
        </button>
      </div>

      {/* --- MENÚ LATERAL (RESPONSIVO CON DRAWER) --- */}
      <div className={`
        fixed inset-y-0 left-0 z-40 w-64 bg-slate-900 text-white flex flex-col shadow-2xl transition-transform duration-300 ease-in-out md:static md:translate-x-0
        ${menuAbierto ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="p-6 text-center border-b border-slate-700 hidden md:block">
          <h1 className="font-bold text-2xl tracking-wide">Nómina<span className="text-blue-400">Pro</span></h1>
          <p className="text-xs text-slate-400 mt-1">Usuario: <span className="font-bold text-white">{nombreUsuario}</span></p>
          <span className="inline-block mt-2 px-2.5 py-0.5 rounded text-[10px] font-black uppercase bg-slate-800 text-indigo-400 border border-slate-700">
            Rol: {rolUsuario}
          </span>
        </div>

        {/* Info de usuario visible arriba en móviles cuando se abre el menú */}
        <div className="p-4 border-b border-slate-700 md:hidden bg-slate-950">
          <p className="text-xs text-slate-400">Usuario: <span className="font-bold text-white">{nombreUsuario}</span></p>
          <span className="inline-block mt-1 px-2 py-0.5 rounded text-[9px] font-black uppercase bg-slate-800 text-indigo-400">
            Rol: {rolUsuario}
          </span>
        </div>
        
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto mt-2">
          {rolUsuario !== 'supervisor' && (
            <button 
              onClick={() => cambiarVista('dashboard')} 
              className={`w-full text-left p-3 rounded-lg transition font-medium flex items-center gap-3 text-sm ${vistaActiva === 'dashboard' ? 'bg-blue-600 shadow-md' : 'hover:bg-slate-800 text-slate-300'}`}>
              📊 Dashboard
            </button>
          )}

          <button 
            onClick={() => cambiarVista('novedades')} 
            className={`w-full text-left p-3 rounded-lg transition font-medium flex items-center gap-3 text-sm ${vistaActiva === 'novedades' ? 'bg-blue-600 shadow-md' : 'hover:bg-slate-800 text-slate-300'}`}>
            📰 Novedades
          </button>
          
          <button 
            onClick={() => cambiarVista('asistencia')} 
            className={`w-full text-left p-3 rounded-lg transition font-medium flex items-center gap-3 text-sm ${vistaActiva === 'asistencia' ? 'bg-blue-600 shadow-md' : 'hover:bg-slate-800 text-slate-300'}`}>
            📅 Asistencia Diaria
          </button>

          {rolUsuario !== 'supervisor' && (
            <button 
              onClick={() => cambiarVista('agregar')} 
              className={`w-full text-left p-3 rounded-lg transition font-medium flex items-center gap-3 text-sm ${vistaActiva === 'agregar' ? 'bg-blue-600 shadow-md' : 'hover:bg-slate-800 text-slate-300'}`}>
              ➕ Nuevo Empleado
            </button>
          )}

          <button 
            onClick={() => cambiarVista('editar')} 
            className={`w-full text-left p-3 rounded-lg transition font-medium flex items-center gap-3 text-sm ${vistaActiva === 'editar' ? 'bg-blue-600 shadow-md' : 'hover:bg-slate-800 text-slate-300'}`}>
            🔍 Buscar / Editar
          </button>

          <button 
            onClick={() => cambiarVista('lista')} 
            className={`w-full text-left p-3 rounded-lg transition font-medium flex items-center gap-3 text-sm ${vistaActiva === 'lista' ? 'bg-blue-600 shadow-md' : 'hover:bg-slate-800 text-slate-300'}`}>
            📋 Lista y Filtros
          </button>

          {rolUsuario === 'master' && (
            <button 
              onClick={() => cambiarVista('panel_maestro')} 
              className={`w-full text-left p-3 rounded-lg transition font-medium flex items-center gap-3 mt-4 border border-yellow-600 text-sm ${vistaActiva === 'panel_maestro' ? 'bg-yellow-600 text-white shadow-md' : 'text-yellow-500 hover:bg-slate-800'}`}>
              👑 Panel Maestro
            </button>
          )}
        </nav>

        <div className="p-4 border-t border-slate-700">
          <button 
            onClick={cerrarSesion}
            className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-2.5 px-4 rounded transition shadow text-sm">
            🚪 Cerrar Sesión
          </button>
        </div>
      </div>

      {/* --- ÁREA PRINCIPAL --- */}
      <div className="flex-1 p-3 sm:p-6 lg:p-8 overflow-y-auto bg-gray-100 flex items-start justify-center w-full">
        
        {vistaActiva === 'dashboard' && rolUsuario !== 'supervisor' && <Dashboard />}
        {vistaActiva === 'novedades' && <Novedades />}
        {vistaActiva === 'asistencia' && <AsistenciaDiaria />}
        {vistaActiva === 'agregar' && rolUsuario !== 'supervisor' && <AgregarEmpleado />}
        {vistaActiva === 'editar' && <EditarEmpleado />}
        
        {vistaActiva === 'lista' && (
          <div className="w-full max-w-6xl">
            <ListaEmpleados />
          </div>
        )}

        {vistaActiva === 'panel_maestro' && rolUsuario === 'master' && <PanelMaestro />}

      </div>
    </div>
  );
}

export default App;