import React, { useState, useEffect } from 'react';
import axios from 'axios';
import ExcelJS from 'exceljs/dist/exceljs.min.js';
import { saveAs } from 'file-saver';

function ListaEmpleados() {
  const [empleados, setEmpleados] = useState([]);
  const [filtroEstado, setFiltroEstado] = useState('Todos');
  const [cargando, setCargando] = useState(true);

  // Estados de paginación
  const [paginaActual, setPaginaActual] = useState(1);
  const [totalPaginas, setTotalPaginas] = useState(1);
  const [totalRegistros, setTotalRegistros] = useState(0);

  const rolUsuario = (localStorage.getItem('rol') || 'asistente').toLowerCase();
  const backendUrl = 'https://nomia-pro-production.up.railway.app';

  const [mostrarModalExcel, setMostrarModalExcel] = useState(false);
  const [numeroSemana, setNumeroSemana] = useState('');
  const [tasaBCV, setTasaBCV] = useState('');

  // --- LÓGICA DE HORARIOS Y ROLES (Viernes 6:30 PM HORA VENEZUELA) ---
  const now = new Date();
  const vetTime = new Date(now.getTime() - (4 * 60 * 60 * 1000));
  const esViernes = vetTime.getDay() === 5; 
  const hora = vetTime.getHours(); 
  const minutos = vetTime.getMinutes();

  const esDespues630PM = esViernes && (hora > 18 || (hora === 18 && minutos >= 30));
  const esHoraOficialAdmin = esDespues630PM;
  const supervisorBloqueado = esDespues630PM && rolUsuario === 'supervisor';

  useEffect(() => {
    cargarEmpleados(paginaActual, filtroEstado);
  }, [paginaActual, filtroEstado]);

  const cargarEmpleados = async (pagina, estado) => {
    setCargando(true);
    try {
      const token = localStorage.getItem('token');
      const respuesta = await axios.get(`${backendUrl}/empleados?page=${pagina}&limit=50&estado=${estado}`, {
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

  const obtenerTodosParaExcel = async () => {
    try {
      const token = localStorage.getItem('token');
      const respuesta = await axios.get(`${backendUrl}/empleados?limit=all&estado=${filtroEstado}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      return respuesta.data.empleados || [];
    } catch (error) {
      console.error('Error obteniendo datos para Excel:', error);
      return [];
    }
  };

  // FUNCIÓN PARA FORMATEAR CUENTA BANCARIA EN BLOQUES DE 4 DÍGITOS CON GUIONES (XXXX-XXXX-XXXX-XXXX-XXXX)
  const formatearCuentaBancaria = (cuenta) => {
    if (!cuenta) return "No registrada";
    const limpia = String(cuenta).replace(/\D/g, '');
    if (limpia.length !== 20) return limpia; 
    return limpia.match(/.{1,4}/g)?.join('-') || limpia;
  };

  const calcularTiempoTrabajando = (fechaString) => {
    if (!fechaString || fechaString === 'No registrada') return "No registrada";
    const inicio = new Date(fechaString);
    if (isNaN(inicio.getTime())) return "Fecha inválida";
    
    const hoy = new Date();
    let anios = hoy.getFullYear() - inicio.getFullYear();
    let meses = hoy.getMonth() - inicio.getMonth();
    
    if (meses < 0) {
      anios--;
      meses += 12;
    }
    
    if (anios === 0 && meses === 0) return "Menos de 1 mes";
    let texto = [];
    if (anios > 0) texto.push(`${anios} año${anios > 1 ? 's' : ''}`);
    if (meses > 0) texto.push(`${meses} mes${meses > 1 ? 'es' : ''}`);
    return texto.join(', ');
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
        if (Number(a.dia) === 7) return;
        if (a.estado === 'Ausente') ausencias += 1; 
      });
    }
    const salarioBaseNum = Number(salarioBase) || 0;
    const salarioDiario = salarioBaseNum / 6; 
    const total = salarioBaseNum - (ausencias * salarioDiario);
    return total < 0 ? 0 : total;
  };

  const obtenerFechas6Dias = () => {
    const current = new Date();
    const vetCurrent = new Date(current.getTime() - (4 * 60 * 60 * 1000));
    const currentDay = vetCurrent.getDay(); 
    const offsetToSaturday = currentDay === 6 ? 0 : currentDay + 1; 
    
    const pastSaturday = new Date(vetCurrent);
    pastSaturday.setDate(vetCurrent.getDate() - offsetToSaturday);
    
    const fechas = [];
    for(let i = 0; i < 7; i++) {
       if (i === 1) continue; 
       const tempDate = new Date(pastSaturday);
       tempDate.setDate(pastSaturday.getDate() + i);
       fechas.push(tempDate.getDate()); 
    }
    return fechas;
  };

  const registrarLogExportacion = async (tipo, detalles) => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${backendUrl}/auditoria/exportar`, {
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
    if (rolUsuario === 'master' || rolUsuario === 'supervisor') {
      generarArchivoExcelBasico();
    } else {
      if (esHoraOficialAdmin) {
        setMostrarModalExcel(true);
      } else {
        generarArchivoExcelBasico();
      }
    }
  };

  const generarArchivoExcelBasico = async () => {
    const todosLosEmpleados = await obtenerTodosParaExcel();
    if (todosLosEmpleados.length === 0) return alert("No hay datos para exportar.");

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Personal', { views: [{ showGridLines: false }] });

    sheet.mergeCells('A1:M1'); 
    const titleCell = sheet.getCell('A1');
    titleCell.value = `LISTADO DE PERSONAL - ESTADO: ${filtroEstado.toUpperCase()}`;
    titleCell.font = { bold: true, size: 11, name: 'Arial' };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF00' } }; 
    sheet.getRow(1).height = 25;

    const headers = ["#", "NOMBRES Y APELLIDOS", "DIRECCIÓN", "CÉDULA", "TELÉFONO", "PUESTO", "CUADRILLA", "ESTADO", "CUENTA BANCARIA", "SALARIO BASE ($)", "FECHA DE CONTRATACIÓN", "TIEMPO LABORADO", "N° SUSPENSIONES"];
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
        emp.direccion || "No registrada",
        emp.dni || "N/A",
        emp.numerotelf || "No registrado",
        (emp.puesto || '').toUpperCase(),
        (emp.cuadrilla || 'Sin Cuadrilla').toUpperCase(),
        emp.estado,
        formatearCuentaBancaria(emp.cuentabancaria),
        baseNum,
        emp.fechacontratacion || "No registrada", 
        calcularTiempoTrabajando(emp.fechacontratacion), 
        emp.suspensiones || 0 
      ];
      row.height = 20;

      row.eachCell((cell, colNumber) => {
        cell.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.font = { size: 9, name: 'Arial' };
        if (colNumber === 2 || colNumber === 3) cell.alignment = { horizontal: 'left', vertical: 'middle' };
        if (colNumber === 10) {
          cell.numFmt = '"$"#,##0.00';
          cell.alignment = { horizontal: 'right', vertical: 'middle' };
        }
      });
      currentRow++;
    });

    sheet.getColumn('A').width = 4;
    sheet.getColumn('B').width = 28;
    sheet.getColumn('C').width = 35; 
    sheet.getColumn('D').width = 13;
    sheet.getColumn('E').width = 15;
    sheet.getColumn('F').width = 15;
    sheet.getColumn('G').width = 16;
    sheet.getColumn('H').width = 12;
    sheet.getColumn('I').width = 26; 
    sheet.getColumn('J').width = 16; 
    sheet.getColumn('K').width = 22; 
    sheet.getColumn('L').width = 22; 
    sheet.getColumn('M').width = 18; 

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
    const fechasSemana = obtenerFechas6Dias();

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Nómina Oficial', { views: [{ showGridLines: false }] });

    const headers = [
      "#", "NOMBRES Y APELLIDOS", "CEDULA", "OCUPACION", 
      "SABADO", "LUNES", "MARTES", "MIERCOLES", "JUEVES", "VIERNES", 
      "TOTAL ASISTENCIAS", "% DE ASISTENCIAS", "SUELDO DIARIO $", 
      "SUELDO TOTAL $", "SUELDO TOTAL BS", "BANCO", "TELEFONO", 
      "CEDULA BANCARIA", "NUMERO DE CUENTA", "N° DE REFERENCIA"
    ];
    
    const colLetters = ['A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R','S','T'];

    const escribirTituloAmarillo = (filaNum) => {
      sheet.mergeCells(`A${filaNum}:T${filaNum}`); 
      const titleCell = sheet.getCell(`A${filaNum}`);
      titleCell.value = `ASISTENCIA DEL MES DE ${mesActual} ${anioActual} - SEMANA ${numeroSemana} (TASA BCV: ${tasa.toFixed(2)} Bs)`;
      titleCell.font = { bold: true, size: 11, name: 'Arial' };
      titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
      titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF00' } }; 
      sheet.getRow(filaNum).height = 25;
    };

    const escribirCabeceraTabla = (filaNum) => {
      sheet.getRow(filaNum).height = 28;
      sheet.getRow(filaNum + 1).height = 18;
      
      headers.forEach((header, i) => {
        const col = colLetters[i];
        const isDayColumn = (i >= 4 && i <= 9); 
        const cellRow2 = sheet.getCell(`${col}${filaNum}`);
        cellRow2.value = header;
        cellRow2.font = { bold: true, size: 8, name: 'Arial' }; 
        cellRow2.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }; 
        
        if (!isDayColumn) {
          sheet.mergeCells(`${col}${filaNum}:${col}${filaNum + 1}`);
          sheet.getCell(`${col}${filaNum}`).border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
        } else {
          cellRow2.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
          const cellRow3 = sheet.getCell(`${col}${filaNum + 1}`);
          cellRow3.value = fechasSemana[i - 4]; 
          cellRow3.font = { bold: true, size: 9, name: 'Arial' };
          cellRow3.alignment = { horizontal: 'center', vertical: 'middle' };
          cellRow3.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
        }
      });
    };

    const staff = todosLosEmpleados.filter(emp => !emp.cuadrilla || emp.cuadrilla === 'Sin Cuadrilla');
    const cuadrillas = todosLosEmpleados.filter(emp => emp.cuadrilla && emp.cuadrilla !== 'Sin Cuadrilla');

    const staffPorPuesto = {};
    staff.forEach(emp => {
      const puesto = emp.puesto || 'Sin Puesto';
      if (!staffPorPuesto[puesto]) staffPorPuesto[puesto] = [];
      staffPorPuesto[puesto].push(emp);
    });

    const cuadrillasMap = {};
    cuadrillas.forEach(emp => {
      if (!cuadrillasMap[emp.cuadrilla]) cuadrillasMap[emp.cuadrilla] = [];
      cuadrillasMap[emp.cuadrilla].push(emp);
    });

    Object.keys(cuadrillasMap).forEach(key => {
       cuadrillasMap[key].sort((a, b) => {
          if (a.puesto === 'Caporal' && b.puesto !== 'Caporal') return -1;
          if (b.puesto === 'Caporal' && a.puesto !== 'Caporal') return 1;
          return 0; 
       });
    });

    const gruposParaExportar = [];
    
    Object.keys(staffPorPuesto).sort().forEach(puesto => {
        gruposParaExportar.push({
            nombre: `GRUPO: ${puesto.toUpperCase()}`,
            empleados: staffPorPuesto[puesto]
        });
    });
    
    Object.keys(cuadrillasMap).sort((a, b) => {
        const numA = parseInt(a.replace(/\D/g, '')) || 0;
        const numB = parseInt(b.replace(/\D/g, '')) || 0;
        return numA - numB;
    }).forEach(cuad => {
        gruposParaExportar.push({
            nombre: cuad.toUpperCase(),
            empleados: cuadrillasMap[cuad]
        });
    });

    let currentRow = 1; 
    let indexGlobal = 1;

    gruposParaExportar.forEach((grupo, idxGrupo) => {
        escribirTituloAmarillo(currentRow);
        currentRow++;

        sheet.mergeCells(`A${currentRow}:T${currentRow}`);
        const cellTitle = sheet.getCell(`A${currentRow}`);
        cellTitle.value = grupo.nombre;
        cellTitle.font = { bold: true, size: 10, name: 'Arial', color: { argb: 'FFFFFF' } };
        cellTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '2C3E50' } };
        cellTitle.alignment = { horizontal: 'center', vertical: 'middle' };
        sheet.getRow(currentRow).height = 22;
        currentRow++;

        escribirCabeceraTabla(currentRow);
        currentRow += 2; 

        // Acumuladores de subtotales para este grupo
        let sumaTotalDolaresGrupo = 0;
        let sumaTotalBolivaresGrupo = 0;

        grupo.empleados.forEach((emp) => {
          const baseNum = Number(emp.salariobase || emp.salarioBase) || 0; 
          const salarioDiario = baseNum / 6; 

          let ausencias = 0;
          let diasTrabajados = 0;
          if (emp.asistencia_semana && Array.isArray(emp.asistencia_semana)) {
            emp.asistencia_semana.forEach(a => { 
              if (Number(a.dia) === 7) return; 
              if (a.estado === 'Ausente') ausencias += 1; 
              if (a.estado === 'Presente' || a.estado === 'Justificado') diasTrabajados += 1;
            });
          }

          const pagoDolares = baseNum - (ausencias * salarioDiario);
          const pagoFinal = pagoDolares < 0 ? 0 : pagoDolares;
          const pagoBolivares = pagoFinal * tasa; 
          const porcentajeAsistencia = (diasTrabajados / 6); 

          // Sumamos al acumulador del grupo
          sumaTotalDolaresGrupo += pagoFinal;
          sumaTotalBolivaresGrupo += pagoBolivares;
          
          const nombreCompleto = `${emp.nombre || ''} ${emp.apellido || ''}`.trim().toUpperCase();
          const puestoLimpio = (emp.puesto || '').toUpperCase();

          const rowValues = [
            indexGlobal++,
            nombreCompleto,
            emp.dni || "",
            puestoLimpio,
            getIconoAsistenciaExcel(emp.asistencia_semana, 6), 
            getIconoAsistenciaExcel(emp.asistencia_semana, 1), 
            getIconoAsistenciaExcel(emp.asistencia_semana, 2), 
            getIconoAsistenciaExcel(emp.asistencia_semana, 3), 
            getIconoAsistenciaExcel(emp.asistencia_semana, 4), 
            getIconoAsistenciaExcel(emp.asistencia_semana, 5), 
            diasTrabajados,
            porcentajeAsistencia, 
            salarioDiario,       
            pagoFinal,            
            pagoBolivares,        
            emp.cuentabancaria && String(emp.cuentabancaria).length >= 4 ? String(emp.cuentabancaria).substring(0, 4) : "",
            emp.numerotelf || "",
            emp.dni || "", 
            formatearCuentaBancaria(emp.cuentabancaria), 
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

        // =========================================================
        // FILA DE SUBTOTALES PARA EL GRUPO O CUADRILLA ACTUAL
        // =========================================================
        sheet.mergeCells(`A${currentRow}:M${currentRow}`);
        const subtotalLabelCell = sheet.getCell(`A${currentRow}`);
        subtotalLabelCell.value = `TOTAL ${grupo.nombre}:`;
        subtotalLabelCell.font = { bold: true, size: 9, name: 'Arial' };
        subtotalLabelCell.alignment = { horizontal: 'right', vertical: 'middle' };
        subtotalLabelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'EAEDED' } };

        // Celda de Subtotal en Dólares ($)
        const subtotalDolaresCell = sheet.getCell(`N${currentRow}`);
        subtotalDolaresCell.value = sumaTotalDolaresGrupo;
        subtotalDolaresCell.font = { bold: true, size: 9, name: 'Arial' };
        subtotalDolaresCell.numFmt = '#,##0.00';
        subtotalDolaresCell.alignment = { horizontal: 'center', vertical: 'middle' };
        subtotalDolaresCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'EAEDED' } };

        // Celda de Subtotal en Bolívares (Bs)
        const subtotalBolivaresCell = sheet.getCell(`O${currentRow}`);
        subtotalBolivaresCell.value = sumaTotalBolivaresGrupo;
        subtotalBolivaresCell.font = { bold: true, size: 9, name: 'Arial' };
        subtotalBolivaresCell.numFmt = '#,##0.00';
        subtotalBolivaresCell.alignment = { horizontal: 'center', vertical: 'middle' };
        subtotalBolivaresCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'EAEDED' } };

        // Dar bordes a toda la fila de subtotal hasta la columna T
        for (let colIdx = 1; colIdx <= 20; colIdx++) {
            const colLetter = colLetters[colIdx - 1];
            sheet.getCell(`${colLetter}${currentRow}`).border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
        }
        sheet.getRow(currentRow).height = 22;
        currentRow++;

        if (idxGrupo < gruposParaExportar.length - 1) {
            currentRow += 7; // Salto de 7 filas entre grupos
        }
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
    sheet.getColumn('S').width = 23;  
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
    <div className="bg-white rounded-xl shadow-lg p-3 sm:p-6 w-full animate-fade-in relative">
      
      {mostrarModalExcel && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in p-4">
          <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-2xl w-full max-w-sm border-t-8 border-green-500">
            <h3 className="text-xl sm:text-2xl font-black text-slate-800 mb-2">Corte de Nómina 📊</h3>
            <p className="text-xs sm:text-sm text-slate-500 font-medium mb-6">Ingresa los datos para calcular y generar el archivo oficial de pagos.</p>
            
            <label className="block text-xs font-bold text-slate-600 mb-1 uppercase">Número de Semana</label>
            <input 
              type="number" 
              value={numeroSemana} 
              onChange={e => setNumeroSemana(e.target.value)} 
              placeholder="Ej: 29" 
              className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-green-500 outline-none font-bold text-center mb-4 text-slate-700 bg-slate-50 text-sm"
            />

            <label className="block text-xs font-bold text-slate-600 mb-1 uppercase">Tasa BCV Actual (Bs.)</label>
            <input 
              type="number" 
              step="0.01"
              value={tasaBCV} 
              onChange={e => setTasaBCV(e.target.value)} 
              placeholder="Ej: 36.50" 
              className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-green-500 outline-none font-bold text-center mb-6 text-emerald-700 bg-emerald-50 text-sm"
            />
            
            <div className="flex justify-between gap-3">
              <button 
                onClick={() => { setMostrarModalExcel(false); setNumeroSemana(''); setTasaBCV(''); }} 
                className="w-full px-4 py-3 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition font-bold text-sm"
              >
                Cancelar
              </button>
              <button 
                onClick={generarArchivoExcelOficial} 
                className="w-full px-4 py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl transition shadow-lg text-sm"
              >
                Generar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Encabezado Responsivo */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-6 border-b pb-4 gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-800">📋 Lista, Asistencia y Nómina ({totalRegistros} total)</h2>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">Control visual de los trabajadores, su asistencia (6 días) y salarios.</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full lg:w-auto">
          {rolUsuario === 'master' && (
            <button 
              onClick={() => setMostrarModalExcel(true)} 
              className="bg-amber-600 text-white font-bold py-2.5 px-3 sm:px-4 rounded-lg shadow-md hover:bg-amber-700 transition flex items-center gap-2 text-xs sm:text-sm flex-1 lg:flex-none justify-center"
              title="Acceso exclusivo del Master para generar la nómina oficial libremente"
            >
              ⭐ Forzar Nómina Oficial
            </button>
          )}

          {!supervisorBloqueado && (
            <button 
              onClick={intentarExportar} 
              className="bg-green-600 text-white font-bold py-2.5 px-4 sm:px-5 rounded-lg shadow-md hover:bg-green-700 transition flex items-center gap-2 text-xs sm:text-sm flex-1 lg:flex-none justify-center"
            >
              📊 Exportar Archivo
            </button>
          )}
        </div>
      </div>

      {/* Filtros deslizables para móviles */}
      <div className="flex items-center gap-2 mb-6 overflow-x-auto whitespace-nowrap pb-2">
        <span className="text-xs sm:text-sm font-semibold text-gray-600">Filtrar por:</span>
        {['Todos', 'Activo', 'Vetado', 'Sancionado', 'Inactivo'].map(estado => (
          <button key={estado} onClick={() => { setFiltroEstado(estado); setPaginaActual(1); }}
            className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg font-medium text-xs sm:text-sm transition ${filtroEstado === estado ? 'bg-blue-600 text-white shadow' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
          >
            {estado}
          </button>
        ))}
      </div>

      {/* Tabla con scroll lateral adaptado */}
      <div className="overflow-x-auto border rounded-lg shadow-sm">
        <table className="w-full text-left border-collapse whitespace-nowrap text-xs sm:text-sm">
          <thead>
            <tr className="bg-slate-800 text-white">
              <th className="p-3 sm:p-4 border-r border-slate-700">Nombre Completo</th>
              <th className="p-3 sm:p-4 border-r border-slate-700">Dirección</th>
              <th className="p-3 sm:p-4 border-r border-slate-700">Cédula y Teléfono</th>
              <th className="p-3 sm:p-4 border-r border-slate-700 text-center">Estado</th>
              
              <th className="p-2 sm:p-3 text-center font-bold bg-slate-700 border-r border-slate-600">Sáb</th>
              <th className="p-2 sm:p-3 text-center font-bold bg-slate-700 border-r border-slate-600">Lun</th>
              <th className="p-2 sm:p-3 text-center font-bold bg-slate-700 border-r border-slate-600">Mar</th>
              <th className="p-2 sm:p-3 text-center font-bold bg-slate-700 border-r border-slate-600">Mié</th>
              <th className="p-2 sm:p-3 text-center font-bold bg-slate-700 border-r border-slate-600">Jue</th>
              <th className="p-2 sm:p-3 text-center font-bold bg-slate-700 border-r border-slate-800">Vie</th>

              <th className="p-3 sm:p-4 border-r border-slate-700 text-center text-yellow-300">Cuadrilla</th>

              <th className="p-3 sm:p-4 border-r border-slate-700 text-center">N° de Cuenta Bancaria</th>
              <th className="p-3 sm:p-4 border-r border-slate-700 text-right text-emerald-300">Base ($)</th>
              <th className="p-3 sm:p-4 border-r border-slate-700 text-right text-emerald-400 font-black">Final ($)</th>
              <th className="p-3 sm:p-4 text-right text-blue-300">Final (Bs)</th>
            </tr>
          </thead>
          <tbody>
            {cargando ? (
              <tr><td colSpan="15" className="text-center p-8 text-gray-500 font-semibold bg-gray-50">Cargando datos...</td></tr>
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
                    <td className="p-3 sm:p-4 font-bold text-slate-700 border-r border-slate-200">
                      {emp.apellido}, {emp.nombre}
                      <span className="block text-[10px] text-slate-400 font-normal mt-0.5">{emp.puesto}</span>
                    </td>

                    <td className="p-3 sm:p-4 border-r border-slate-200 text-slate-600 truncate max-w-[200px]" title={emp.direccion}>
                      {emp.direccion || 'No registrada'}
                    </td>
                    
                    <td className="p-3 sm:p-4 border-r border-slate-200">
                      <div className="font-mono text-gray-700 font-bold">{emp.dni}</div>
                      <div className="text-[11px] text-gray-500 mt-1 flex items-center gap-1">
                        📞 {emp.numerotelf}
                      </div>
                    </td>

                    <td className="p-3 sm:p-4 text-center border-r border-slate-200">
                      <span className={`px-2.5 py-1 rounded-full text-[9px] sm:text-[10px] font-bold uppercase tracking-wider ${
                        emp.estado === 'Activo' ? 'bg-green-100 text-green-700' :
                        emp.estado === 'Vetado' ? 'bg-red-100 text-red-700' : 
                        emp.estado === 'Inactivo' ? 'bg-gray-200 text-gray-700' : 'bg-yellow-100 text-yellow-700'
                      }`}>
                        {emp.estado}
                      </span>
                    </td>
                    
                    <td className="p-2 sm:p-3 text-center border-r border-slate-100 bg-gray-50">{getIconoAsistencia(emp.asistencia_semana, 6)}</td> 
                    <td className="p-2 sm:p-3 text-center border-r border-slate-100 bg-white">{getIconoAsistencia(emp.asistencia_semana, 1)}</td> 
                    <td className="p-2 sm:p-3 text-center border-r border-slate-100 bg-gray-50">{getIconoAsistencia(emp.asistencia_semana, 2)}</td> 
                    <td className="p-2 sm:p-3 text-center border-r border-slate-100 bg-white">{getIconoAsistencia(emp.asistencia_semana, 3)}</td> 
                    <td className="p-2 sm:p-3 text-center border-r border-slate-100 bg-gray-50">{getIconoAsistencia(emp.asistencia_semana, 4)}</td> 
                    <td className="p-2 sm:p-3 text-center border-r border-slate-200 bg-white">{getIconoAsistencia(emp.asistencia_semana, 5)}</td> 

                    <td className="p-3 sm:p-4 border-r border-slate-200 text-center font-bold text-slate-700 bg-yellow-50/30">
                      {emp.cuadrilla || 'Sin Cuadrilla'}
                    </td>

                    <td className="p-3 sm:p-4 border-r border-slate-200 text-center">
                      {emp.cuentabancaria ? (
                        <span className={`font-mono text-[11px] sm:text-xs font-bold px-2.5 py-1.5 rounded-md border ${cuentaValida ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                          {formatearCuentaBancaria(emp.cuentabancaria)}
                        </span>
                      ) : (
                        <span className="text-[10px] sm:text-[11px] text-gray-400 font-semibold bg-gray-100 px-2.5 py-1 rounded-md border border-gray-200">
                          No registrada
                        </span>
                      )}
                    </td>

                    <td className="p-3 sm:p-4 text-right font-medium text-slate-500 border-r border-slate-200">
                      ${baseNum.toFixed(2)}
                    </td>
                    <td className="p-3 sm:p-4 text-right border-r border-slate-200">
                      <span className={`font-black text-base sm:text-lg ${tieneDescuento ? 'text-red-600' : 'text-emerald-600'}`}>
                        ${pagoDolares.toFixed(2)}
                      </span>
                    </td>
                    <td className="p-3 sm:p-4 text-right font-bold text-blue-700 bg-blue-50/30">
                      <span className="text-[9px] font-normal text-slate-400 block mb-0.5">Ref. Visual</span>
                      Bs. {pagoBolivares.toFixed(2)}
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr><td colSpan="15" className="text-center p-8 text-gray-400 font-semibold bg-gray-50">No hay registros bajo este filtro.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Controles de Paginación */}
      <div className="flex flex-col sm:flex-row justify-between items-center mt-6 pt-4 border-t gap-3">
        <span className="text-xs sm:text-sm font-semibold text-slate-600 text-center sm:text-left">
          Página <strong className="text-slate-900">{paginaActual}</strong> de <strong className="text-slate-900">{totalPaginas}</strong> ({totalRegistros} total)
        </span>
        <div className="flex gap-2 w-full sm:w-auto">
          <button 
            onClick={() => setPaginaActual(prev => Math.max(prev - 1, 1))}
            disabled={paginaActual === 1 || cargando}
            className="flex-1 sm:flex-none px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg transition disabled:opacity-40 text-xs sm:text-sm"
          >
            ← Anterior
          </button>
          <button 
            onClick={() => setPaginaActual(prev => Math.min(prev + 1, totalPaginas))}
            disabled={paginaActual === totalPaginas || cargando}
            className="flex-1 sm:flex-none px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition disabled:opacity-40 text-xs sm:text-sm"
          >
            Siguiente →
          </button>
        </div>
      </div>

    </div>
  );
}

export default ListaEmpleados;
