import React, { useState } from 'react';
import axios from 'axios';

function Auth({ onLoginSuccess }) {
  const [esRegistro, setEsRegistro] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rolSolicitado, setRolSolicitado] = useState('asistente'); 
  const [cargando, setCargando] = useState(false);
 const backendUrl = 'https://nomia-pro-production.up.railway.app';

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!username || !password) return; 
    setCargando(true);
    
    try {
      delete axios.defaults.headers.common['Authorization'];

      const res = await axios.post(`${backendUrl}/login`, { username, password }, { timeout: 6000 });
      
      localStorage.setItem('token', res.data.token);
      localStorage.setItem('rol', res.data.rol);
      localStorage.setItem('username', res.data.username);
      
      axios.defaults.headers.common['Authorization'] = `Bearer ${res.data.token}`;

      setCargando(false);
      onLoginSuccess();

    } catch (error) {
      setCargando(false);
      const mensajeError = error.response?.data?.error || (error.code === 'ECONNABORTED' ? 'El servidor tardó demasiado en responder.' : 'Error de conexión con el servidor.');
      
      setTimeout(() => {
        alert(`❌ ${mensajeError}`);
      }, 50);
    }
  };

  const handleRegistro = async (e) => {
    e.preventDefault();
    if (!username || !password) return;
    setCargando(true);
    
    try {
      const res = await axios.post(`${backendUrl}/registro`, { 
        username, 
        password, 
        rol: rolSolicitado 
      }, { timeout: 6000 });

      setCargando(false);
      setEsRegistro(false); 
      setUsername('');
      setPassword('');
      setRolSolicitado('asistente');

      setTimeout(() => {
        alert(`✅ ${res.data.mensaje}`);
      }, 50);

    } catch (error) {
      setCargando(false);
      const mensajeError = error.response?.data?.error || 'Error al solicitar acceso';
      
      setTimeout(() => {
        alert(`❌ ${mensajeError}`);
      }, 50);
    }
  };

  if (esRegistro) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 animate-fade-in">
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden max-w-2xl w-full flex flex-col md:flex-row">
          
          <div className="bg-indigo-600 p-8 text-white flex flex-col justify-center md:w-2/5">
            <h2 className="text-2xl font-black mb-4">Alto ahí 🛑</h2>
            <p className="text-indigo-100 text-sm mb-4">
              El registro en <strong className="text-white">NóminaPro</strong> requiere autorización del Maestro.
            </p>
            <p className="text-indigo-200 text-xs italic">
              * Selecciona correctamente tu rol operativo.
            </p>
          </div>

          <div className="p-8 md:w-3/5 bg-slate-50">
            <h2 className="text-2xl font-bold text-slate-800 mb-6">Solicitar Acceso</h2>
            <form onSubmit={handleRegistro} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Crea un Usuario</label>
                <input 
                  type="text" 
                  value={username} 
                  onChange={e => setUsername(e.target.value)} 
                  required 
                  disabled={cargando} 
                  className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm disabled:bg-gray-200 disabled:text-gray-500 transition" 
                  placeholder="Ej: supervisor_carlos" 
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Crea una Contraseña</label>
                <input 
                  type="password" 
                  value={password} 
                  onChange={e => setPassword(e.target.value)} 
                  required 
                  disabled={cargando} 
                  className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm disabled:bg-gray-200 disabled:text-gray-500 transition" 
                  placeholder="••••••••" 
                />
              </div>
              
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Tipo de Puesto / Rol</label>
                <select 
                  value={rolSolicitado} 
                  onChange={e => setRolSolicitado(e.target.value)} 
                  disabled={cargando}
                  className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-sm font-medium disabled:bg-gray-200 disabled:text-gray-500 transition"
                >
                  <option value="asistente">📋 Asistente (Oficina / Administrativo)</option>
                  <option value="supervisor">🚜 Supervisor (Campo / Asistencia)</option>
                </select>
              </div>

              <button 
                type="submit" 
                disabled={cargando} 
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-lg transition shadow-lg mt-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
              >
                {cargando ? (
                  <span className="animate-pulse">Enviando...</span>
                ) : (
                  <><span>✉️</span> Enviar Solicitud al Maestro</>
                )}
              </button>
            </form>
            <div className="mt-6 text-center">
              <button 
                onClick={() => { 
                  if (!cargando) {
                    setEsRegistro(false); 
                    setUsername(''); 
                    setPassword(''); 
                  }
                }} 
                disabled={cargando}
                className="text-slate-500 hover:text-slate-800 text-sm font-semibold underline disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                ← Volver a Iniciar Sesión
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full border-t-8 border-blue-600">
        
        <div className="text-center mb-8">
          <h1 className="text-4xl font-black text-slate-800">Nómina<span className="text-blue-600">Pro</span></h1>
          <p className="text-slate-500 mt-2">Inicia sesión en tu cuenta</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">Usuario</label>
            <input 
              type="text" 
              value={username} 
              onChange={e => setUsername(e.target.value)} 
              required 
              disabled={cargando} 
              className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-gray-200 disabled:text-gray-500 transition" 
              placeholder="Ej: master o asistente" 
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">Contraseña</label>
            <input 
              type="password" 
              value={password} 
              onChange={e => setPassword(e.target.value)} 
              required 
              disabled={cargando} 
              className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-gray-200 disabled:text-gray-500 transition" 
              placeholder="••••••••" 
            />
          </div>
          <button 
            type="submit" 
            disabled={cargando} 
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg transition shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {cargando ? (
              <span className="animate-pulse">Verificando...</span>
            ) : (
              'Ingresar al Sistema'
            )}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-slate-200 text-center">
          <p className="text-slate-500 text-sm mb-2">¿Eres nuevo en el departamento?</p>
          <button 
            onClick={() => { 
              if (!cargando) {
                setEsRegistro(true); 
                setUsername(''); 
                setPassword(''); 
              }
            }} 
            disabled={cargando}
            className="text-blue-600 font-bold hover:underline text-sm border border-blue-600 px-4 py-2 rounded-lg hover:bg-blue-50 transition w-full disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Solicitar Acceso al Sistema
          </button>
        </div>

      </div>
    </div>
  );
}

export default Auth;