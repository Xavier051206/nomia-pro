import React, { useState } from 'react';
import axios from 'axios';

function AgregarEmpleado() {
  const [nombre, setNombre] = useState('');
  const [apellido, setApellido] = useState('');
  const [dni, setDni] = useState('');
  
  // Estados para el teléfono separado
  const [phonePrefix, setPhonePrefix] = useState('0414');
  const [phoneRest, setPhoneRest] = useState('');

  const [direccion, setDireccion] = useState(''); 
  const [puesto, setPuesto] = useState(''); 
  const [salarioBase, setSalarioBase] = useState('');
  const [cuentaBancaria, setCuentaBancaria] = useState(''); 

  const backendUrl = 'https://nomia-pro-production.up.railway.app';

  const capitalizarTexto = (texto) => {
    return texto.split(' ').map(palabra => {
      if (palabra.length === 0) return '';
      return palabra.charAt(0).toUpperCase() + palabra.slice(1).toLowerCase();
    }).join(' ');
  };

  const manejarCuentaBancaria = (e) => {
    let val = e.target.value.replace(/\D/g, ''); 
    if (val.length > 0 && val[0] !== '0') {
      val = '0' + val; 
    }
    if (val.length > 20) {
      val = val.slice(0, 20); 
    }
    setCuentaBancaria(val);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validar teléfono completo (11 dígitos)
    const fullNumber = phonePrefix + phoneRest;
    if (phoneRest.length !== 7) {
      alert("⚠️ El número de teléfono debe tener exactamente 7 dígitos después del prefijo.");
      return;
    }

    if (cuentaBancaria && cuentaBancaria.length !== 20) {
      alert("⚠️ El número de cuenta debe tener EXACTAMENTE 20 dígitos.");
      return;
    }

    const cedulaLimpia = dni.toUpperCase().replace(/[-\s]/g, '');
    const regexCedula = /^[VE][0-9]{5,8}$/; 
    
    if (!regexCedula.test(cedulaLimpia)) {
      alert('⚠️ Error: La cédula debe empezar con V o E y tener máximo 8 números (Ejemplo: V12345678)');
      return; 
    }

    const nombreFormateado = capitalizarTexto(nombre);
    const apellidoFormateado = capitalizarTexto(apellido);

    try {
      const token = localStorage.getItem('token'); 
      await axios.post(`${backendUrl}/empleados`, {
        nombre: nombreFormateado,
        apellido: apellidoFormateado,
        dni: cedulaLimpia,
        numeroTelf: fullNumber, // Enviamos el teléfono unificado
        direccion: direccion.trim() || 'No registrada', 
        fechaNacimiento: '1990-01-01',
        puesto: puesto,
        salarioBase: parseFloat(salarioBase),
        cuentaBancaria: cuentaBancaria,
        fechaContratacion: new Date().toISOString().split('T')[0]
      }, {
        headers: { Authorization: `Bearer ${token}` } 
      });
      
      alert('✅ ¡Empleado registrado con éxito!');
      // Limpiamos los campos
      setNombre(''); setApellido(''); setDni(''); setPhoneRest(''); setDireccion(''); setPuesto(''); setSalarioBase(''); setCuentaBancaria('');
      
    } catch (error) {
      console.error("Error del backend:", error.response?.data);
      alert(error.response?.data?.error || '❌ Error con el servidor. Revisa la terminal de tu backend.');
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-4 sm:p-8 max-w-4xl mx-auto w-full animate-fade-in">
      <h2 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-6 border-b pb-4">➕ Registrar Nuevo Empleado</h2>
      
      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        
        <div className="col-span-1 md:col-span-2 bg-blue-50 p-3 rounded-lg border border-blue-100 mb-2">
          <h3 className="text-blue-800 font-semibold text-sm">Datos Personales</h3>
        </div>
        
        <input type="text" placeholder="Nombre" value={nombre} onChange={e => setNombre(e.target.value)} required className="p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm sm:text-base" />
        <input type="text" placeholder="Apellido" value={apellido} onChange={e => setApellido(e.target.value)} required className="p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm sm:text-base" />
        <input type="text" placeholder="Cédula (Ej: V12345678)" value={dni} onChange={e => setDni(e.target.value.toUpperCase())} required maxLength={10} className="p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm sm:text-base" />
        
        {/* NUEVO FORMATO DE TELÉFONO SEPARADO (Select + Input) */}
        <div className="flex gap-2">
          <select 
            value={phonePrefix} 
            onChange={e => setPhonePrefix(e.target.value)} 
            className="p-3 border rounded-lg bg-white w-32 font-bold text-blue-800 focus:ring-2 focus:ring-blue-500 outline-none text-sm sm:text-base"
          >
            <option value="0212">0212</option>
            <option value="0414">0414</option>
            <option value="0416">0416</option>
            <option value="0426">0426</option>
            <option value="0424">0424</option>
            <option value="0422">0422</option>
          </select>
          <input 
            type="text" 
            maxLength="7" 
            value={phoneRest} 
            onChange={e => setPhoneRest(e.target.value.replace(/\D/g, ''))} 
            placeholder="1234567" 
            required 
            className="flex-1 p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-mono text-sm sm:text-base" 
          />
        </div>
        
        {/* DIRECCIÓN */}
        <div className="col-span-1 md:col-span-2">
          <input 
            type="text" 
            placeholder="Dirección de Vivienda (Ej: Macuto, La Guaira...)" 
            value={direccion} 
            onChange={e => setDireccion(e.target.value)} 
            required 
            maxLength={100} 
            className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm sm:text-base" 
          />
        </div>
        
        <div className="col-span-1 md:col-span-2 bg-green-50 p-3 rounded-lg border border-green-100 mb-2 mt-2">
          <h3 className="text-green-800 font-semibold text-sm">Datos Laborales y Bancarios</h3>
        </div>

        <select value={puesto} onChange={e => setPuesto(e.target.value)} required className="p-3 border rounded-lg bg-white focus:ring-2 focus:ring-green-500 outline-none text-sm sm:text-base">
          <option value="" disabled>Seleccione una ocupacion...</option>
          <option value="Supervisor">Supervisor</option>
          <option value="Caporal">Caporal</option>
          <option value="Cuadrillero">Cuadrillero</option>
          <option value="Cocinero">Cocinero</option>
          <option value="Seguridad">Seguridad</option>
          <option value="Paramédico">Paramédico</option>
          <option value="Depositario">Depositario</option>
          <option value="Coordinador">Coordinador</option>
        </select>

        <input type="number" placeholder="Salario Base ($)" value={salarioBase} onChange={e => setSalarioBase(e.target.value)} required min="1" step="0.01" className="p-3 border rounded-lg focus:ring-2 focus:ring-green-500 outline-none text-sm sm:text-base" />
        
        <div className="col-span-1 md:col-span-2 relative mb-4">
          <input 
            type="text" 
            placeholder="Cuenta Bancaria (Ej: 01020000000000000000)" 
            value={cuentaBancaria} 
            onChange={manejarCuentaBancaria} 
            className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-green-500 outline-none font-mono tracking-widest text-xs sm:text-sm ${
              cuentaBancaria.length === 20 ? 'border-green-400 bg-green-50 text-green-800' : 
              cuentaBancaria.length > 0 ? 'border-red-400 bg-red-50 text-red-800' : ''
            }`}
          />
          {cuentaBancaria.length > 0 && cuentaBancaria.length < 20 && (
            <p className="text-xs text-red-600 font-bold mt-1 absolute -bottom-5 left-1">
              Faltan {20 - cuentaBancaria.length} dígitos
            </p>
          )}
        </div>
        
        <div className="col-span-1 md:col-span-2 mt-4">
          <button type="submit" className="w-full bg-blue-600 text-white font-bold py-3 sm:py-4 px-4 rounded-lg hover:bg-blue-700 transition shadow-lg text-base sm:text-lg">
            Guardar Empleado
          </button>
        </div>
      </form>
    </div>
  );
}

export default AgregarEmpleado;