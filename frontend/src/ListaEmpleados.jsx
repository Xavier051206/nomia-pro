import React, { useState, useEffect } from 'react';
import axios from 'axios';
import ExcelJS from 'exceljs/dist/exceljs.min.js';
import { saveAs } from 'file-saver';

function ListaEmpleados() {
  const [empleados, setEmpleados] = useState([]);
  const [filtroEstado, setFiltroEstado] = useState('Todos');
  const [cargando, setCargando] = useState(true);

  // Estados de paginación corporativa para 1,500+ empleados
  const [paginaActual, setPaginaActual] = useState(1);
  const [totalPaginas, setTotalPaginas] = useState(1);
  const [totalRegistros, setTotalRegistros] = useState(0);

  const rolUsuario = (localStorage.getItem('rol') || 'asistente').toLowerCase();

  const [mostrarModalExcel, setMostrarModalExcel] = useState(false);
  const [numeroSemana, setNumeroSemana] = useState('');
  const [tasaBCV, setTasaBCV] = useState('');

  const hoy = new Date();
  const esSabado = hoy.getDay() === 6; 
  const hora = hoy.getHours(); 
  // Restricción exacta: Sábados de 3:00 PM a 8:30 PM
  const esHoraOficial = esSabado && (hora >= 15 && (hora < 20 || (hora === 20 && hoy.getMinutes() <= 30)));

  const supervisorBloqueado = esHoraOficial && rolUsuario === 'supervisor';

  useEffect(() => {
    cargarEmpleados(paginaActual, filtroEstado);
  }, [paginaActual, filtroEstado]);

  const cargarEmpleados = async (pagina, estado) => {
    setCargando(true);
    try {
      const token = localStorage.getItem('token');
      const respuesta = await axios.get(`[https://nomia-pro-production.up.railway.app](https://nomia-pro-production.up.railway.app)/empleados?page=${pagina}&limit=50&estado=${estado}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setEmpleados(respuesta.data.empleados || []);
      setTotalPaginas(respuesta.data.totalPages || 1);
      setTotalRegistros(respuesta.data.totalItems || 0);
    } catch (error) {
      console.error('Error cargando empleados:', error);
      setEmpleados([]);
    } finally {
      setCargando(false);
    }
  };

  // Función auxiliar para traer a TODOS los empleados de golpe solo para los reportes de Excel
  const obtenerTodosParaExcel = async () => {
    try {
      const token = localStorage.getItem('token');
      const respuesta = await axios.get(`[https://nomia-pro-production.up.railway.app](https://nomia-pro-production.up.railway.app)/empleados?limit=all&estado=${filtroEstado}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      return respuesta.data.empleados || [];
    } catch (error) {
      console.error('Error obteniendo datos para Excel:', error);
      return [];
    }
  };

  const getIconoAsistencia = (asistenciaSemana, diaBusqueda) => {
    if (!asistenciaSemana || !Array.isArray(asistenciaSemana)) return '➖';
    const registro = asistenciaSemana.find(a => Number(a.dia) === Number(diaBusqueda));
    if (!registro) return '➖'; 

    if (registro.estado === 'Presente') return '✅';
    if (registro.estado === 'Ausente') return '❌';
    if (registro.estado === 'Justificado') return '✳️'; 
    return '➖';
  };

  const getIconoAsistenciaExcel = (asistenciaSemana, diaBusqueda) => {
    if (!asistenciaSemana || !Array.isArray(asistenciaSemana)) return '-';
    const registro = asistenciaSemana.find(a => Number(a.dia) === Number(diaBusqueda));
    if (!registro) return '-'; 

    if (registro.estado === 'Presente') return '✓';
    if (registro.estado === 'Ausente') return 'X';
    if (registro.estado === 'Justificado') return 'J'; 
    return '-';
  };

  const calcularPagoDolares = (salarioBase, asistenciaSemana) => {
    let ausencias = 0;
    if (asistenciaSemana && Array.isArray(asistenciaSemana)) {
      asistenciaSemana.forEach(a => { 
        if (a.estado === 'Ausente') ausencias += 1; 
      });
    }
    const salarioBaseNum = Number(salarioBase) || 0;
    const salarioDiario = salarioBaseNum / 6; 
    const total = salarioBaseNum - (ausencias * salarioDiario);
    return total < 0 ? 0 : total;
  };

  const obtenerFechasLunesASabado = () => {
    const current = new Date();
    const diaSemana = current.getDay() === 0 ? 7 : current.getDay(); 
    const diferenciaLunes = current.getDate() - diaSemana + 1;
    
    const fechas = [];
    for(let i = 0; i < 6; i++) {
       const tempDate = new Date(current);
       tempDate.setDate(diferenciaLunes + i);
       fechas.push(tempDate.getDate()); 
    }
    return fechas;
  };

  const registrarLogExportacion = async (tipo, detalles) => {
    try {
      const token = localStorage.getItem('token');
      await axios.post('[https://nomia-pro-production.up.railway.app](https://nomia-pro-production.up.railway.app)/auditoria/exportar', {
        tipoReporte: tipo,
        detalles: detalles
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
    } catch (err) {
      console.error("No se pudo registrar la auditoría de exportación:", err);
    }
  };

  const intentarExportar = () => {
    if (esHoraOficial) {
      setMostrarModalExcel(true); 
    } else {
      generarArchivoExcelBasico(); 
    }
  };

  const generarArchivoExcelBasico = async () => {
    const todosLosEmpleados = await obtenerTodosParaExcel();
    if (todosLosEmpleados.length === 0) return alert("No hay datos para exportar.");

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Personal', { views: [{ showGridLines: false }] });

    sheet.mergeCells('A1:H1');
    const titleCell = sheet.getCell('A1');
    titleCell.value = `LISTADO DE PERSONAL - ESTADO: ${filtroEstado.toUpperCase()}`;
    titleCell.font = { bold: true, size: 11, name: 'Arial' };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF00' } }; 
    sheet.getRow(1).height = 25;

    const headers = ["#", "NOMBRES Y APELLIDOS", "CÉDULA", "TELÉFONO", "PUESTO", "ESTADO", "CUENTA BANCARIA", "SALARIO BASE ($)"];
    const row2 = sheet.getRow(2);
    row2.values = headers;
    row2.height = 25;

    headers.forEach((_, idx) => {
      const colLetter = String.fromCharCode(65 + idx); 
      const cell = sheet.getCell(`${colLetter}2`);
      cell.font = { bold: true, size: 9, name: 'Arial' };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'E2E8F0' } }; 
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
    });

    let currentRow = 3;
    todosLosEmpleados.forEach((emp, index) => {
      const baseNum = Number(emp.salariobase || emp.salarioBase) || 0; 
      const row = sheet.getRow(currentRow);
      row.values = [
        index + 1,
        `${emp.nombre || ''} ${emp.apellido || ''}`.trim().toUpperCase(),
        emp.dni || "N/A",
        emp.numerotelf || "No registrado",
        (emp.puesto || '').toUpperCase(),
        emp.estado,
        emp.cuentabancaria || "No registrada",
        baseNum 
      ];
      row.height = 20;

      row.eachCell((cell, colNumber) => {
        cell.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.font = { size: 9, name: 'Arial' };
        if (colNumber === 2) cell.alignment = { horizontal: 'left', vertical: 'middle' }; 
        if (colNumber === 8) {
          cell.numFmt = '"$"#,##0.00';
          cell.alignment = { horizontal: 'right', vertical: 'middle' };
        }
      });
      currentRow++;
    });

    sheet.getColumn('A').width = 4;
    sheet.getColumn('B').width = 28;
    sheet.getColumn('C').width = 13;
    sheet.getColumn('D').width = 15;
    sheet.getColumn('E').width = 15;
    sheet.getColumn('F').width = 12;
    sheet.getColumn('G').width = 24;
    sheet.getColumn('H').width = 16;

    const buffer = await workbook.xlsx.writeBuffer();
    const fechaHoy = new Date().toISOString().split('T')[0];
    saveAs(new Blob([buffer]), `Data_Personal_${filtroEstado}_${fechaHoy}.xlsx`);
    
    await registrarLogExportacion("LISTADO_BÁSICO", `Exportó el listado básico completo (${filtroEstado}).`);
    alert("✅ Archivo de datos básicos descargado con éxito.");
  };

  const generarArchivoExcelOficial = async () => {
    if (!numeroSemana) return alert("Por favor, ingresa el número de la semana.");
    if (!tasaBCV || Number(tasaBCV) <= 0) return alert("Por favor, ingresa una Tasa BCV válida.");

    const todosLosEmpleados = await obtenerTodosParaExcel();
    if (todosLosEmpleados.length === 0) return alert("No hay datos para exportar.");

    const tasa = Number(tasaBCV);
    const mesActual = new Date().toLocaleString('es-ES', { month: 'long' }).toUpperCase();
    const anioActual = new Date().getFullYear();
    const fechasSemana = obtenerFechasLunesASabado();

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Nómina Oficial', { views: [{ showGridLines: false }] });

    sheet.mergeCells('A1:T1');
    const titleCell = sheet.getCell('A1');
    titleCell.value = `ASISTENCIA DEL MES DE ${mesActual} ${anioActual} - SEMANA ${numeroSemana} (TASA BCV: ${tasa.toFixed(2)} Bs)`;
    titleCell.font = { bold: true, size: 11, name: 'Arial' };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF00' } }; 
    sheet.getRow(1).height = 25;

    const headers = [
      "#", "NOMBRES Y APELLIDOS", "CEDULA", "OCUPACION", 
      "LUNES", "MARTES", "MIERCOLES", "JUEVES", "VIERNES", "SABADO", 
      "TOTAL ASISTENCIAS", "% DE ASISTENCIAS", "SUELDO DIARIO $", 
      "SUELDO TOTAL $", "SUELDO TOTAL BS", "BANCO", "TELEFONO", 
      "CEDULA BANCARIA", "NUMERO DE CUENTA", "N° DE REFERENCIA"
    ];
    
    const colLetters = ['A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R','S','T'];
    sheet.getRow(2).height = 28;
    sheet.getRow(3).height = 18;
    
    headers.forEach((header, i) => {
      const col = colLetters[i];
      const isDayColumn = (i >= 4 && i <= 9); 
      const cellRow2 = sheet.getCell(`${col}2`);
      cellRow2.value = header;
      cellRow2.font = { bold: true, size: 8, name: 'Arial' }; 
      cellRow2.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }; 
      
      if (!isDayColumn) {
        sheet.mergeCells(`${col}2:${col}3`);
        sheet.getCell(`${col}2`).border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
      } else {
        cellRow2.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
        const cellRow3 = sheet.getCell(`${col}3`);
        cellRow3.value = fechasSemana[i - 4]; 
        cellRow3.font = { bold: true, size: 9, name: 'Arial' };
        cellRow3.alignment = { horizontal: 'center', vertical: 'middle' };
        cellRow3.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
      }
    });

    let currentRow = 4;
    todosLosEmpleados.forEach((emp, index) => {
      const baseNum = Number(emp.salariobase || emp.salarioBase) || 0; 
      const salarioDiario = baseNum / 6;

      let ausencias = 0;
      let diasTrabajados = 0;
      if (emp.asistencia_semana && Array.isArray(emp.asistencia_semana)) {
        emp.asistencia_semana.forEach(a => { 
          if (a.estado === 'Ausente') ausencias += 1; 
          if (a.estado === 'Presente' || a.estado === 'Justificado') diasTrabajados += 1;
        });
      }

      const pagoDolares = baseNum - (ausencias * salarioDiario);
      const pagoFinal = pagoDolares < 0 ? 0 : pagoDolares;
      const pagoBolivares = pagoFinal * tasa; 
      const porcentajeAsistencia = (diasTrabajados / 6); 
      
      const nombreCompleto = `${emp.nombre || ''} ${emp.apellido || ''}`.trim().toUpperCase();
      const puestoLimpio = (emp.puesto || '').toUpperCase();
      const bancoCodigo = emp.cuentabancaria && String(emp.cuentabancaria).length >= 4 
                          ? String(emp.cuentabancaria).substring(0, 4) : "";

      const rowValues = [
        index + 1,
        nombreCompleto,
        emp.dni || "",
        puestoLimpio,
        getIconoAsistenciaExcel(emp.asistencia_semana, 1),
        getIconoAsistenciaExcel(emp.asistencia_semana, 2),
        getIconoAsistenciaExcel(emp.asistencia_semana, 3),
        getIconoAsistenciaExcel(emp.asistencia_semana, 4),
        getIconoAsistenciaExcel(emp.asistencia_semana, 5),
        getIconoAsistenciaExcel(emp.asistencia_semana, 6),
        diasTrabajados,
        porcentajeAsistencia, 
        salarioDiario,        
        pagoFinal,            
        pagoBolivares,        
        bancoCodigo,
        emp.numerotelf || "",
        emp.dni || "", 
        emp.cuentabancaria || "",
        "" 
      ];

      const row = sheet.getRow(currentRow);
      row.values = rowValues;
      row.height = 20; 

      row.eachCell((cell, colNumber) => {
        cell.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        cell.font = { size: 9, name: 'Arial' }; 
        if (colNumber === 2) cell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
        if (colNumber === 12) cell.numFmt = '0%'; 
        if (colNumber === 13 || colNumber === 14 || colNumber === 15) cell.numFmt = '#,##0.00'; 
      });
      currentRow++;
    });

    sheet.getColumn('A').width = 4;   
    sheet.getColumn('B').width = 24;  
    sheet.getColumn('C').width = 11;  
    sheet.getColumn('D').width = 13;  
    sheet.columns.forEach((col, idx) => { if (idx >= 4 && idx <= 9) col.width = 6.5; }); 
    sheet.getColumn('K').width = 9;   
    sheet.getColumn('L').width = 8;   
    sheet.getColumn('M').width = 10;  
    sheet.getColumn('N').width = 10;  
    sheet.getColumn('O').width = 12;  
    sheet.getColumn('P').width = 6;   
    sheet.getColumn('Q').width = 13;  
    sheet.getColumn('R').width = 11;  
    sheet.getColumn('S').width = 21;  
    sheet.getColumn('T').width = 10;  

    const buffer = await workbook.xlsx.writeBuffer();
    const fechaHoy = new Date().toISOString().split('T')[0];
    saveAs(new Blob([buffer]), `Nomina_Oficial_S${numeroSemana}_${fechaHoy}.xlsx`);

    await registrarLogExportacion("NÓMINA_OFICIAL", `Generó la nómina completa de la Semana ${numeroSemana}.`);

    setMostrarModalExcel(false);
    setNumeroSemana('');
    setTasaBCV('');
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-6 w-full animate-fade-in relative">
      
      {mostrarModalExcel && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
          <div className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-sm border-t-8 border-green-500">
            <h3 className="text-2xl font-black text-slate-800 mb-2">Corte de Nómina 📊</h3>
            <p className="text-sm text-slate-500 font-medium mb-6">Ingresa los datos para calcular y generar el archivo oficial de pagos.</p>
            
            <label className="block text-xs font-bold text-slate-600 mb-1 uppercase">Número de Semana</label>
            <input 
              type="number" 
              value={numeroSemana} 
              onChange={e => setNumeroSemana(e.target.value)} 
              placeholder="Ej: 29" 
              className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-green-500 outline-none font-bold text-center mb-4 text-slate-700 bg-slate-50"
            />

            <label className="block text-xs font-bold text-slate-600 mb-1 uppercase">Tasa BCV Actual (Bs.)</label>
            <input 
              type="number" 
              step="0.01"
              value={tasaBCV} 
              onChange={e => setTasaBCV(e.target.value)} 
              placeholder="Ej: 36.50" 
              className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-green-500 outline-none font-bold text-center mb-6 text-emerald-700 bg-emerald-50"
            />
            
            <div className="flex justify-between gap-3">
              <button 
                onClick={() => { setMostrarModalExcel(false); setNumeroSemana(''); setTasaBCV(''); }} 
                className="w-full px-4 py-3 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition font-bold"
              >
                Cancelar
              </button>
              <button 
                onClick={generarArchivoExcelOficial} 
                className="w-full px-4 py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl transition shadow-lg"
              >
                Generar
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-between items-center mb-6 border-b pb-4">
        <div>
          <h2 className="text-3xl font-bold text-gray-800">📋 Lista, Asistencia y Nómina ({totalRegistros} total)</h2>
          <p className="text-sm text-gray-500 mt-1">Control visual de los trabajadores, su asistencia y salarios.</p>
        </div>
        
        <div className="flex items-center gap-3">
          {!esHoraOficial && rolUsuario === 'master' && (
            <button 
              onClick={() => setMostrarModalExcel(true)} 
              className="bg-amber-600 text-white font-bold py-2.5 px-4 rounded-lg shadow-md hover:bg-amber-700 transition flex items-center gap-2 transform hover:-translate-y-0.5 text-sm"
              title="Acceso exclusivo del Master para generar la nómina oficial en cualquier momento"
            >
              ⭐ Forzar Nómina Oficial (Master)
            </button>
          )}

          {!supervisorBloqueado && (
            <button 
              onClick={intentarExportar} 
              className="bg-green-600 text-white font-bold py-2.5 px-5 rounded-lg shadow-md hover:bg-green-700 transition flex items-center gap-2 transform hover:-translate-y-0.5"
            >
              📊 Exportar Archivo
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        <span className="p-2 font-semibold text-gray-600">Filtrar por:</span>
        {['Todos', 'Activo', 'Vetado', 'Sancionado', 'Inactivo'].map(estado => (
          <button key={estado} onClick={() => { setFiltroEstado(estado); setPaginaActual(1); }}
            className={`px-4 py-2 rounded-lg font-medium transition ${filtroEstado === estado ? 'bg-blue-600 text-white shadow' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
          >
            {estado}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto border rounded-lg shadow-sm">
        <table className="w-full text-left border-collapse whitespace-nowrap">
          <thead>
            <tr className="bg-slate-800 text-white">
              <th className="p-4 border-r border-slate-700">Nombre Completo</th>
              <th className="p-4 border-r border-slate-700">Cédula y Teléfono</th>
              <th className="p-4 border-r border-slate-700 text-center">Estado</th>
              
              <th className="p-3 text-center text-sm font-bold bg-slate-700 border-r border-slate-600">Lun</th>
              <th className="p-3 text-center text-sm font-bold bg-slate-700 border-r border-slate-600">Mar</th>
              <th className="p-3 text-center text-sm font-bold bg-slate-700 border-r border-slate-600">Mié</th>
              <th className="p-3 text-center text-sm font-bold bg-slate-700 border-r border-slate-600">Jue</th>
              <th className="p-3 text-center text-sm font-bold bg-slate-700 border-r border-slate-600">Vie</th>
              <th className="p-3 text-center text-sm font-bold bg-slate-700 border-r border-slate-800">Sáb</th>

              <th className="p-4 border-r border-slate-700 text-center">N° de Cuenta Bancaria</th>

              <th className="p-4 border-r border-slate-700 text-right text-emerald-300">Base ($)</th>
              <th className="p-4 border-r border-slate-700 text-right text-emerald-400 font-black">Final ($)</th>
              <th className="p-4 text-right text-blue-300">Final (Bs)</th>
            </tr>
          </thead>
          <tbody>
            {cargando ? (
              <tr><td colSpan="13" className="text-center p-8 text-gray-500 font-semibold bg-gray-50">Cargando datos...</td></tr>
            ) : empleados.length > 0 ? (
              empleados.map(emp => {
                const baseNum = Number(emp.salariobase || emp.salarioBase) || 0; 
                const pagoDolares = calcularPagoDolares(baseNum, emp.asistencia_semana);
                
                const pagoBolivares = pagoDolares * 40; 
                const tieneDescuento = pagoDolares < baseNum;

                const cuentaValida = emp.cuentabancaria && String(emp.cuentabancaria).length === 20;
                const esInactivoConFiltroTodos = filtroEstado === 'Todos' && emp.estado !== 'Activo';

                return (
                  <tr key={emp.empleadoid} className={`border-b transition hover:bg-slate-50 ${esInactivoConFiltroTodos ? 'opacity-60 bg-gray-50' : ''}`}>
                    <td className="p-4 font-bold text-slate-700 border-r border-slate-200">
                      {emp.apellido}, {emp.nombre}
                      <span className="block text-[10px] text-slate-400 font-normal mt-0.5">{emp.puesto}</span>
                    </td>
                    
                    <td className="p-4 border-r border-slate-200">
                      <div className="font-mono text-gray-700 font-bold">{emp.dni}</div>
                      <div className="text-[11px] text-gray-500 mt-1 flex items-center gap-1">
                        📞 {emp.numerotelf}
                      </div>
                    </td>

                    <td className="p-4 text-center border-r border-slate-200">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        emp.estado === 'Activo' ? 'bg-green-100 text-green-700' :
                        emp.estado === 'Vetado' ? 'bg-red-100 text-red-700' : 
                        emp.estado === 'Inactivo' ? 'bg-gray-200 text-gray-700' : 'bg-yellow-100 text-yellow-700'
                      }`}>
                        {emp.estado}
                      </span>
                    </td>
                    
                    <td className="p-3 text-center border-r border-slate-100 bg-gray-50">{getIconoAsistencia(emp.asistencia_semana, 1)}</td>
                    <td className="p-3 text-center border-r border-slate-100 bg-white">{getIconoAsistencia(emp.asistencia_semana, 2)}</td>
                    <td className="p-3 text-center border-r border-slate-100 bg-gray-50">{getIconoAsistencia(emp.asistencia_semana, 3)}</td>
                    <td className="p-3 text-center border-r border-slate-100 bg-white">{getIconoAsistencia(emp.asistencia_semana, 4)}</td>
                    <td className="p-3 text-center border-r border-slate-100 bg-gray-50">{getIconoAsistencia(emp.asistencia_semana, 5)}</td>
                    <td className="p-3 text-center border-r border-slate-200 bg-white">{getIconoAsistencia(emp.asistencia_semana, 6)}</td>

                    <td className="p-4 border-r border-slate-200 text-center">
                      {emp.cuentabancaria ? (
                        <span className={`font-mono text-xs font-bold px-3 py-1.5 rounded-md border ${cuentaValida ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                          {emp.cuentabancaria}
                        </span>
                      ) : (
                        <span className="text-[11px] text-gray-400 font-semibold bg-gray-100 px-3 py-1 rounded-md border border-gray-200">
                          No registrada
                        </span>
                      )}
                    </td>

                    <td className="p-4 text-right font-medium text-slate-500 border-r border-slate-200">
                      ${baseNum.toFixed(2)}
                    </td>
                    <td className="p-4 text-right border-r border-slate-200">
                      <span className={`font-black text-lg ${tieneDescuento ? 'text-red-600' : 'text-emerald-600'}`}>
                        ${pagoDolares.toFixed(2)}
                      </span>
                    </td>
                    <td className="p-4 text-right font-bold text-blue-700 bg-blue-50/30">
                      <span className="text-[10px] font-normal text-slate-400 block mb-0.5">Ref. Visual</span>
                      Bs. {pagoBolivares.toFixed(2)}
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr><td colSpan="13" className="text-center p-8 text-gray-400 font-semibold bg-gray-50">No hay registros bajo este filtro.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* CONTROLES DE PAGINACIÓN */}
      <div className="flex justify-between items-center mt-6 pt-4 border-t">
        <span className="text-sm font-semibold text-slate-600">
          Mostrando página <strong className="text-slate-900">{paginaActual}</strong> de <strong className="text-slate-900">{totalPaginas}</strong> (Total: {totalRegistros} trabajadores)
        </span>
        <div className="flex gap-2">
          <button 
            onClick={() => setPaginaActual(prev => Math.max(prev - 1, 1))}
            disabled={paginaActual === 1 || cargando}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg transition disabled:opacity-40 text-sm"
          >
            ← Anterior
          </button>
          <button 
            onClick={() => setPaginaActual(prev => Math.min(prev + 1, totalPaginas))}
            disabled={paginaActual === totalPaginas || cargando}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition disabled:opacity-40 text-sm"
          >
            Siguiente →
          </button>
        </div>
      </div>

    </div>
  );
}

export default ListaEmpleados;