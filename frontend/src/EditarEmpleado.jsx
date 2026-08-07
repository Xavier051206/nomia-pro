import React, { useState, useEffect } from 'react';
import axios from 'axios';

function EditarEmpleado() {
  const [empleados, setEmpleados] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [empleadoEdit, setEmpleadoEdit] = useState(null); 
  
  // Estados para el teléfono separado
  const [phonePrefix, setPhonePrefix] = useState('0414');
  const [phoneRest, setPhoneRest] = useState('');
  
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
    const fullTelf = emp.numeroTelf || emp.numerotelf || '04140000000';
    
    // Separamos el prefijo y el resto al seleccionar
    setPhonePrefix(fullTelf.slice(0, 4));
    setPhoneRest(fullTelf.slice(4));

    setEmpleadoEdit({
      empleadoid: emp.empleadoid || emp.empleadoID,
      personaID: emp.personaID || emp.personaid || emp.personalid,
      nombre: emp.nombre || '',
      apellido: emp.apellido || '',
      dni: emp.dni || '',
      direccion: emp.direccion || '',
      fechaContratacion: emp.fechacontratacion || '',
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

    // Validar teléfono completo (11 dígitos)
    const fullNumber = phonePrefix + phoneRest;
    if (phoneRest.length !== 7) {
        alert("⚠️ El número de teléfono debe tener 7 dígitos después del prefijo.");
        return;
    }

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
        numeroTelf: fullNumber, // Unimos el prefijo con el resto antes de enviar
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
          <div className="flex justify-between items-center mb-6 bg-slate-100 p-4 rounded-lg">
            <h3 className="text-lg font-bold">Editando: {empleadoEdit.nombre} {empleadoEdit.apellido}</h3>
            <button type="button" onClick={() => setEmpleadoEdit(null)} className="text-red-500 font-bold hover:underline">✖ Cancelar</button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-bold text-gray-600 block mb-1">Nombre</label>
              <input name="nombre" value={empleadoEdit.nombre} onChange={manejarCambio} required className="w-full p-2 border rounded" />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-600 block mb-1">Apellido</label>
              <input name="apellido" value={empleadoEdit.apellido} onChange={manejarCambio} required className="w-full p-2 border rounded" />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-600 block mb-1">Cédula</label>
              <input name="dni" value={empleadoEdit.dni} onChange={manejarCambio} required className="w-full p-2 border rounded" />
            </div>
            
            {/* NUEVO FORMATO DE TELÉFONO */}
            <div className="col-span-1 sm:col-span-2 md:col-span-1">
              <label className="text-xs font-bold text-gray-600 block mb-1">Teléfono</label>
              <div className="flex gap-2">
                <select value={phonePrefix} onChange={(e) => setPhonePrefix(e.target.value)} className="p-2 border rounded bg-white w-28 font-bold text-blue-800">
                    <option value="0212">0212</option>
                    <option value="0414">0414</option>
                    <option value="0416">0416</option>
                    <option value="0212">0412</option>
                    <option value="0426">0426</option>
                    <option value="0424">0424</option>
                    <option value="0422">0422</option>
                </select>
                <input type="text" maxLength="7" value={phoneRest} onChange={(e) => setPhoneRest(e.target.value.replace(/\D/g, ''))} placeholder="1234567" className="flex-1 p-2 border rounded font-mono" />
              </div>
            </div>

            <div className="col-span-1 sm:col-span-2 md:col-span-1">
              <label className="text-xs font-bold text-gray-600 block mb-1">Dirección</label>
              <input name="direccion" value={empleadoEdit.direccion} onChange={manejarCambio} className="w-full p-2 border rounded" />
            </div>

            <div>
              <label className="text-xs font-bold text-gray-600 block mb-1">Fecha Contratación</label>
              <input type="date" name="fechaContratacion" value={empleadoEdit.fechaContratacion} onChange={manejarCambio} className="w-full p-2 border rounded" />
            </div>

            <div>
              <label className="text-xs font-bold text-gray-600 block mb-1">Salario Base ($)</label>
              <input type="number" name="salarioBase" value={empleadoEdit.salarioBase} onChange={manejarCambio} required className="w-full p-2 border rounded" />
            </div>
            
            <div>
                <label className="text-xs font-bold text-gray-600 block mb-1">Estado</label>
                <select name="estado" value={empleadoEdit.estado} onChange={manejarCambio} className="w-full p-2 border rounded bg-white">
                    <option value="Activo">Activo</option>
                    <option value="Inactivo">Inactivo</option>
                    <option value="Vetado">Vetado</option>
                    <option value="Sancionado">Sancionado</option>
                </select>
            </div>
            
            <div className="col-span-1 sm:col-span-2 md:col-span-3">
              <label className="text-xs font-bold text-gray-600 block mb-1">N° de Cuenta Bancaria (20 dígitos)</label>
              <input type="text" value={empleadoEdit.cuentaBancaria} onChange={manejarCuentaBancaria} className="w-full p-2 border rounded font-mono" />
            </div>
          </div>

          <button type="submit" className="w-full bg-blue-700 text-white font-bold py-3 rounded-lg hover:bg-blue-800 transition">
            {cargando ? '💾 Guardando...' : '💾 Guardar Cambios'}
          </button>
        </form>
      )}
    </div>
  );
}

export default EditarEmpleado;