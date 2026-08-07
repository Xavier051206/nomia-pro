import React, { useState, useEffect } from 'react';
import axios from 'axios';

function EditarEmpleado() {
  const [empleados, setEmpleados] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [empleadoEdit, setEmpleadoEdit] = useState(null); 
  
  const [cargando, setCargando] = useState(false);
  const [mensajeExito, setMensajeExito] = useState('');
  const [mensajeError, setMensajeError] = useState('');
  
  const [motivoSancion, setMotivoSancion] = useState('');
  const [diasSancion, setDiasSancion] = useState('');

  const backendUrl = 'https://nomia-pro-production.up.railway.app';

  useEffect(() => { cargarEmpleados(); }, []);

  const cargarEmpleados = async () => {
    try {
      const token = localStorage.getItem('token');
      const resp = await axios.get(`${backendUrl}/empleados?limit=all`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setEmpleados(resp.data.empleados || []);
    } catch (error) {
      console.error('Error cargando lista:', error);
    }
  };

  const empleadosFiltrados = empleados.filter(emp => {
    if (busqueda.length <= 1) return false;
    const texto = busqueda.toLowerCase();
    return (
      (emp.nombre && emp.nombre.toLowerCase().includes(texto)) || 
      (emp.dni && emp.dni.toLowerCase().includes(texto)) ||
      (emp.apellido && emp.apellido.toLowerCase().includes(texto))
    );
  });

  const seleccionarEmpleado = (emp) => {
    setEmpleadoEdit({
      empleadoid: emp.empleadoid || emp.empleadoID,
      personaID: emp.personaID || emp.personaid || emp.personalid,
      nombre: emp.nombre || '',
      apellido: emp.apellido || '',
      dni: emp.dni || '',
      numeroTelf: emp.numeroTelf || emp.numerotelf || '',
      direccion: emp.direccion || '', // <-- AÑADIDO: Cargar dirección de la BD
      puesto: emp.puesto || 'Cuadrillero',
      salarioBase: emp.salarioBase || emp.salariobase || '',
      cuentaBancaria: emp.cuentabancaria || '', 
      estado: emp.estado || 'Activo'
    });
    setMotivoSancion('');
    setDiasSancion('');
    setMensajeExito('');
    setMensajeError('');
  };

  const manejarCambio = (e) => {
    setEmpleadoEdit({ ...empleadoEdit, [e.target.name]: e.target.value });
  };

  const manejarCuentaBancaria = (e) => {
    let val = e.target.value.replace(/\D/g, ''); 
    if (val.length > 0 && val[0] !== '0') {
      val = '0' + val; 
    }
    if (val.length > 20) {
      val = val.slice(0, 20); 
    }
    setEmpleadoEdit({ ...empleadoEdit, cuentaBancaria: val });
  };

  const guardarCambios = async (e) => {
    e.preventDefault();

    if (empleadoEdit.cuentaBancaria && empleadoEdit.cuentaBancaria.length !== 20) {
      alert("⚠️ El número de cuenta debe tener EXACTAMENTE 20 dígitos.");
      return;
    }
    if (!empleadoEdit.salarioBase || Number(empleadoEdit.salarioBase) <= 0) {
      alert("⚠️ Debe ingresar un monto de salario válido.");
      return;
    }

    setCargando(true);
    setMensajeExito('');
    setMensajeError('');

    try {
      const token = localStorage.getItem('token');
      const idAEditar = empleadoEdit.empleadoid || empleadoEdit.empleadoID;

      await axios.put(`${backendUrl}/empleados/${idAEditar}`, {
        ...empleadoEdit,
        personaID: empleadoEdit.personaID, 
        motivoSancion: motivoSancion,
        diasSuspension: diasSancion
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setMensajeExito('✅ ¡Datos actualizados correctamente!');
      cargarEmpleados(); 

      setTimeout(() => {
        setEmpleadoEdit(null);
        setBusqueda('');
        setMensajeExito('');
      }, 1200);

    } catch (error) {
      setMensajeError(`❌ ${error.response?.data?.error || 'Error al actualizar el empleado'}`);
    } finally {
      setCargando(false); 
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-4 sm:p-8 max-w-5xl w-full mx-auto animate-fade-in">
      <h2 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-6 border-b pb-4">🔍 Buscar y Editar Empleado</h2>
      
      {mensajeExito && <div className="mb-4 p-4 bg-green-100 text-green-800 font-bold rounded-lg text-xs sm:text-sm">{mensajeExito}</div>}
      {mensajeError && <div className="mb-4 p-4 bg-red-100 text-red-800 font-bold rounded-lg text-xs sm:text-sm">{mensajeError}</div>}

      {!empleadoEdit && (
        <>
          <input 
            type="text" 
            placeholder="Escribe un Nombre o Cédula para buscar..." 
            value={busqueda} 
            onChange={e => setBusqueda(e.target.value)} 
            className="w-full p-3 sm:p-4 text-sm sm:text-lg border-2 border-blue-200 rounded-xl focus:border-blue-500 outline-none mb-6 shadow-sm"
          />
          
          {busqueda.length > 1 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[500px] overflow-y-auto pr-1">
              {empleadosFiltrados.map(emp => (
                <div 
                  key={emp.empleadoid || emp.empleadoID} 
                  onClick={() => seleccionarEmpleado(emp)} 
                  className="p-3 sm:p-4 border rounded-xl hover:bg-blue-50 cursor-pointer transition shadow-sm flex justify-between items-center group bg-slate-50"
                >
                  <div>
                    <p className="font-bold text-gray-800 text-sm sm:text-base">{emp.nombre} {emp.apellido}</p>
                    <p className="text-xs text-gray-500 font-mono">C.I: {emp.dni}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 rounded text-[10px] sm:text-xs font-bold ${
                      emp.estado === 'Activo' ? 'bg-green-100 text-green-700' : 
                      emp.estado === 'Sancionado' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
                    }`}>{emp.estado}</span>
                    <span className="text-blue-600 font-bold text-xs sm:text-sm">✏️</span>
                  </div>
                </div>
              ))}
              {empleadosFiltrados.length === 0 && (
                <p className="text-gray-500 col-span-2 text-center py-6 italic text-xs sm:text-sm">No se encontró a nadie con esos datos.</p>
              )}
            </div>
          )}
        </>
      )}

      {empleadoEdit && (
        <form onSubmit={guardarCambios} className="animate-fade-in space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 bg-slate-100 p-4 rounded-lg gap-3">
            <h3 className="text-lg sm:text-xl font-bold text-slate-800">Editando a: {empleadoEdit.nombre} {empleadoEdit.apellido}</h3>
            <button type="button" onClick={() => setEmpleadoEdit(null)} disabled={cargando} className="text-red-500 font-bold hover:underline disabled:opacity-50 text-xs sm:text-sm">✖ Cancelar</button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mb-6">
            <div>
              <label className="text-xs sm:text-sm font-semibold text-gray-600 block mb-1">Nombre</label>
              <input name="nombre" value={empleadoEdit.nombre} onChange={manejarCambio} required disabled={cargando} className="w-full p-2.5 border rounded text-xs sm:text-sm disabled:bg-gray-100" />
            </div>
            <div>
              <label className="text-xs sm:text-sm font-semibold text-gray-600 block mb-1">Apellido</label>
              <input name="apellido" value={empleadoEdit.apellido} onChange={manejarCambio} required disabled={cargando} className="w-full p-2.5 border rounded text-xs sm:text-sm disabled:bg-gray-100" />
            </div>
            <div>
              <label className="text-xs sm:text-sm font-semibold text-gray-600 block mb-1">Cédula</label>
              <input name="dni" value={empleadoEdit.dni} onChange={manejarCambio} required disabled={cargando} className="w-full p-2.5 border rounded text-xs sm:text-sm font-mono disabled:bg-gray-100" />
            </div>
            <div>
              <label className="text-xs sm:text-sm font-semibold text-gray-600 block mb-1">Teléfono</label>
              <input name="numeroTelf" value={empleadoEdit.numeroTelf} onChange={manejarCambio} disabled={cargando} className="w-full p-2.5 border rounded text-xs sm:text-sm font-mono disabled:bg-gray-100" />
            </div>

            {/* AÑADIDO: Campo para la Dirección (ocupa todo el ancho disponible) */}
            <div className="col-span-1 sm:col-span-2 md:col-span-3">
              <label className="text-xs sm:text-sm font-semibold text-gray-600 block mb-1">Dirección de Vivienda</label>
              <input 
                name="direccion" 
                value={empleadoEdit.direccion} 
                onChange={manejarCambio} 
                required 
                maxLength={100}
                disabled={cargando} 
                placeholder="Ej: Macuto, La Guaira..."
                className="w-full p-2.5 border rounded text-xs sm:text-sm disabled:bg-gray-100" 
              />
            </div>

            <div>
              <label className="text-xs sm:text-sm font-semibold text-gray-600 block mb-1">Puesto</label>
              <select name="puesto" value={empleadoEdit.puesto} onChange={manejarCambio} disabled={cargando} className="w-full p-2.5 border rounded text-xs sm:text-sm bg-white disabled:bg-gray-100">
                <option value="Supervisor">Supervisor</option>
                <option value="Caporal">Caporal</option>
                <option value="Cuadrillero">Cuadrillero</option>
                <option value="Cocinero">Cocinero</option>
                <option value="Seguridad">Seguridad</option>
                <option value="Paramédico">Paramédico</option>
                <option value="Depositario">Depositario</option>
                <option value="Coordinador">Coordinador</option>
              </select>
            </div>
            <div>
              <label className="text-xs sm:text-sm font-semibold text-gray-600 block mb-1">Salario Base ($)</label>
              <input type="number" step="0.01" min="0" name="salarioBase" value={empleadoEdit.salarioBase} onChange={manejarCambio} required disabled={cargando} className="w-full p-2.5 border rounded text-xs sm:text-sm disabled:bg-gray-100 text-emerald-700 font-bold" />
            </div>

            <div className="col-span-1 sm:col-span-2 md:col-span-3">
              <label className="text-xs sm:text-sm font-semibold text-gray-600 block mb-1">N° de Cuenta Bancaria (20 dígitos)</label>
              <input 
                type="text" 
                placeholder="01020000000000000000" 
                value={empleadoEdit.cuentaBancaria} 
                onChange={manejarCuentaBancaria} 
                disabled={cargando}
                className={`w-full p-2.5 border rounded outline-none focus:ring-2 focus:ring-blue-500 font-mono tracking-widest text-xs sm:text-sm disabled:bg-gray-100 ${
                  empleadoEdit.cuentaBancaria?.length === 20 ? 'border-green-400 bg-green-50' : 
                  empleadoEdit.cuentaBancaria?.length > 0 ? 'border-red-400 bg-red-50' : ''
                }`}
              />
            </div>
          </div>

          <div className="bg-orange-50 p-4 rounded-xl border border-orange-200 mb-6 mt-6">
             <label className="text-xs sm:text-sm font-bold text-orange-800 block mb-2">Estado Actual del Trabajador</label>
             <select name="estado" value={empleadoEdit.estado} onChange={manejarCambio} disabled={cargando} className="w-full p-2.5 sm:p-3 border rounded-lg bg-white font-bold outline-none focus:ring-2 focus:ring-orange-400 text-xs sm:text-sm disabled:bg-gray-100">
                <option value="Activo">🟢 Activo</option>
                <option value="Inactivo">⚪ Inactivo</option>
                <option value="Vetado">🔴 Vetado</option>
                <option value="Sancionado">🟡 Sancionado</option>
             </select>

             {empleadoEdit.estado === 'Sancionado' && (
               <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-yellow-100 rounded-lg border border-yellow-300">
                   <div>
                     <label className="block text-xs font-bold mb-1 text-yellow-800">Días de Suspensión:</label>
                     <input type="number" min="1" placeholder="Ej: 3" value={diasSancion} onChange={e=>setDiasSancion(e.target.value)} required disabled={cargando} className="w-full p-2 rounded border text-xs sm:text-sm disabled:bg-gray-100" />
                   </div>
                   <div>
                     <label className="block text-xs font-bold mb-1 text-yellow-800">Motivo de la sanción:</label>
                     <input type="text" placeholder="Ej: Llegadas tardías..." value={motivoSancion} onChange={e=>setMotivoSancion(e.target.value)} required disabled={cargando} className="w-full p-2 rounded border text-xs sm:text-sm disabled:bg-gray-100" />
                   </div>
               </div>
             )}
          </div>

          <button type="submit" disabled={cargando} className="w-full bg-blue-700 text-white font-bold py-3 rounded-lg hover:bg-blue-800 transition shadow-lg disabled:opacity-70 text-xs sm:text-sm">
            {cargando ? '💾 Guardando...' : '💾 Guardar Cambios en el Sistema'}
          </button>
        </form>
      )}
    </div>
  );
}

export default EditarEmpleado;