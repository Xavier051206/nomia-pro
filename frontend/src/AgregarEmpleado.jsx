import React, { useState } from 'react';
import axios from 'axios';

function AgregarEmpleado() {
  const [nombre, setNombre] = useState('');
  const [apellido, setApellido] = useState('');
  const [dni, setDni] = useState('');
  const [numeroTelf, setNumeroTelf] = useState('');
  const [puesto, setPuesto] = useState(''); 
  const [salarioBase, setSalarioBase] = useState('');
  const [cuentaBancaria, setCuentaBancaria] = useState(''); 

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
      const token = localStorage.getItem('token'); // <-- TOKEN RECUPERADO DE LOCALSTORAGE
      await axios.post('http://localhost:3000/empleados', {
        nombre: nombreFormateado,
        apellido: apellidoFormateado,
        dni: cedulaLimpia,
        numeroTelf: numeroTelf, 
        fechaNacimiento: '1990-01-01',
        puesto: puesto,
        salarioBase: parseFloat(salarioBase),
        cuentaBancaria: cuentaBancaria,
        fechaContratacion: new Date().toISOString().split('T')[0]
      }, {
        headers: { Authorization: `Bearer ${token}` } // <-- HEADERS CON AUTORIZACIÓN INCLUIDOS
      });
      
      alert('✅ ¡Empleado registrado con éxito!');
      setNombre(''); setApellido(''); setDni(''); setNumeroTelf(''); setPuesto(''); setSalarioBase(''); setCuentaBancaria('');
      
    } catch (error) {
      console.error("Error del backend:", error.response?.data);
      alert(error.response?.data?.error || '❌ Error con el servidor. Revisa la terminal de tu backend.');
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-8 max-w-4xl mx-auto w-full">
      <h2 className="text-3xl font-bold text-gray-800 mb-6 border-b pb-4">➕ Registrar Nuevo Empleado</h2>
      
      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        <div className="col-span-1 md:col-span-2 bg-blue-50 p-3 rounded-lg border border-blue-100 mb-2">
          <h3 className="text-blue-800 font-semibold text-sm">Datos Personales</h3>
        </div>
        
        <input type="text" placeholder="Nombre" value={nombre} onChange={e => setNombre(e.target.value)} required className="p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
        <input type="text" placeholder="Apellido" value={apellido} onChange={e => setApellido(e.target.value)} required className="p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
        <input type="text" placeholder="Cédula (Ej: V12345678)" value={dni} onChange={e => setDni(e.target.value.toUpperCase())} required maxLength={10} className="p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
        <input type="text" placeholder="Teléfono (Ej: 0414-1234567)" value={numeroTelf} onChange={e => setNumeroTelf(e.target.value)} required className="p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
        
        <div className="col-span-1 md:col-span-2 bg-green-50 p-3 rounded-lg border border-green-100 mb-2 mt-4">
          <h3 className="text-green-800 font-semibold text-sm">Datos Laborales y Bancarios</h3>
        </div>

        <select value={puesto} onChange={e => setPuesto(e.target.value)} required className="p-3 border rounded-lg bg-white focus:ring-2 focus:ring-green-500 outline-none">
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

        <input type="number" placeholder="Salario Base ($)" value={salarioBase} onChange={e => setSalarioBase(e.target.value)} required min="1" step="0.01" className="p-3 border rounded-lg focus:ring-2 focus:ring-green-500 outline-none" />
        
        <div className="col-span-1 md:col-span-2 relative mb-4">
          <input 
            type="text" 
            placeholder="Cuenta Bancaria (Ej: 01020000000000000000)" 
            value={cuentaBancaria} 
            onChange={manejarCuentaBancaria} 
            className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-green-500 outline-none font-mono tracking-widest ${
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
        
        <div className="col-span-1 md:col-span-2 mt-2">
          <button type="submit" className="w-full bg-blue-600 text-white font-bold py-4 px-4 rounded-lg hover:bg-blue-700 transition shadow-lg text-lg">
            Guardar Empleado
          </button>
        </div>
      </form>
    </div>
  );
}

export default AgregarEmpleado;