document.addEventListener('DOMContentLoaded', () => {
	const consultarBtn = document.getElementById('consultar-btn');
	let datosCompletos = [];
	let configNiveles = {};

	const NOMBRES_AREAS_CSV = [
		'LECTURA CRÍTICA', 'MATEMÁTICAS', 'CIENCIAS NATURALES', 'SOCIALES Y CIUDADANAS', 'INGLÉS'
	];
	const MAPEO_AREAS_JSON = {
		'lectura crítica': 'Lenguaje',
		'matemáticas': 'matematicas',
		'ciencias naturales': 'ciencias_naturales',
		'sociales y ciudadanas': 'sociales_ciudadanas',
		'inglés': 'ingles'
	};

	function obtenerCiclo(grado) {
		if (grado >= 1 && grado <= 3) return 'Ciclo-I';
		if (grado >= 4 && grado <= 5) return 'Ciclo-II';
		if (grado >= 6 && grado <= 7) return 'Ciclo-III';
		if (grado >= 8 && grado <= 9) return 'Ciclo-IV';
		if (grado >= 10 && grado <= 11) return 'Ciclo-V';
		return 'N/A';
	}

	function getNivelInfo(area, nota) {
		// ¡CORRECCIÓN! Usamos el nombre del área en minúsculas para que coincida con el mapeo
		const nombreJson = MAPEO_AREAS_JSON[area.toLowerCase()] || 'puntaje_global';
		const niveles = configNiveles[nombreJson];
		const notaNum = parseFloat(nota);
		if (!niveles || isNaN(notaNum)) return { nivel: "N/A", color: '#cccccc' };
		for (const nivel of niveles) {
			if (notaNum <= nivel.max) return nivel;
		}
		return { nivel: "N/A", color: '#cccccc' };
	}

	async function cargarDatos() {
		try {
			const responseNiveles = await fetch('niveles.json');
			if (!responseNiveles.ok) throw new Error('No se pudo cargar niveles.json');
			configNiveles = await responseNiveles.json();
			console.log("Configuración de niveles cargada.");

			const archivos = ['PERIODICAS NORMAL DEL DISTRITO 2025.csv'];
			let datosTransformados = [];

			for (const archivo of archivos) {
				try {
					const response = await fetch(archivo);
					if (response.ok) {
						const csvText = await response.text();
						const csvSinComas = csvText.replace(/,/g, '.');

						// ¡LA CORRECCIÓN MÁS IMPORTANTE ESTÁ AQUÍ!
						const data = Papa.parse(csvSinComas, {
							header: true,
							delimiter: ";",
							dynamicTyping: true,
							skipEmptyLines: true,
							// Esta línea limpia los nombres de las columnas: quita espacios y los pone en minúsculas
							transformHeader: header => header.trim().toLowerCase()
						}).data;

						data.forEach(fila => {
							// Ahora todas las claves de 'fila' están en minúsculas (ej: fila.grado, fila.estudiante)
							if (fila.grado) {
								NOMBRES_AREAS_CSV.forEach(area => {
									const areaEnMinusculas = area.toLowerCase();
									if (fila[areaEnMinusculas] !== undefined) {
										datosTransformados.push({
											calendario: fila.calendario,
											prueba: fila.prueba,
											grado: fila.grado,
											grupo: fila.grupo,
											ciclo: obtenerCiclo(fila.grado),
											estudiante: fila.estudiante, // Usamos la clave en minúsculas
											area: area, // Mantenemos el nombre original para las etiquetas
											nota: parseFloat(fila[areaEnMinusculas]) || 0
										});
									}
								});
							}
						});
						console.log(`Archivo "${archivo}" procesado.`);
					}
				} catch (error) {
					console.warn(`No se pudo procesar el archivo "${archivo}".`, error);
				}
			}
			datosCompletos = datosTransformados;
			console.log(`Procesamiento finalizado. Total de registros: ${datosCompletos.length}`);
			poblarFiltros();
		} catch (error) {
			console.error("Error crítico al cargar datos:", error);
		}
	}

	function poblarFiltros() {
		if (datosCompletos.length === 0) return;
		const pruebas = [...new Set(datosCompletos.map(d => d.prueba))].sort();
		const pruebaSelect = document.getElementById('prueba');
		pruebas.forEach(p => pruebaSelect.add(new Option(p, p)));

		const calendarios = [...new Set(datosCompletos.map(d => d.calendario))].sort()
		const calendarioSelect = document.getElementById('calendario');
		calendarios.forEach(c => calendarioSelect.add(new Option(c, c)));


		const grados = [...new Set(datosCompletos.map(d => d.grado))].sort((a, b) => a - b);
		const gradoSelect = document.getElementById('grado');
		grados.forEach(g => gradoSelect.add(new Option(`Grado ${g}`, g)));

		const areas = [...new Set(datosCompletos.map(d => d.area))].sort();
		const areaSelect = document.getElementById('area');
		areas.forEach(a => areaSelect.add(new Option(a, a)));
	}

	consultarBtn.addEventListener('click', () => {
		document.getElementById('graficos-container').innerHTML = '';
		document.getElementById('tabla-estudiantes-body').innerHTML = '';

		const calendario = document.getElementById('calendario').value;
		const prueba = document.getElementById('prueba').value;
		const ciclo = document.getElementById('ciclo').value;
		const grado = document.getElementById('grado').value;
		const area = document.getElementById('area').value;

		const datosFiltrados = datosCompletos.filter(item =>
			(item.calendario === Number(calendario)) &&
			(prueba === 'todos' || item.prueba === prueba) &&
			(ciclo === 'todos' || item.ciclo === ciclo) &&
			(grado === 'todos' || item.grado.toString() === grado) &&
			(area === 'todas' || item.area === area)
		);

		if (datosFiltrados.length === 0) {
			document.getElementById('graficos-container').innerHTML = '<p>No se encontraron resultados para esta consulta.</p>';
			return;
		}

		generarGraficoRevision('Promedio General por Área', datosFiltrados, 'area');
		if (grado === 'todos') {
			generarGraficoPromedioPor('Promedio General por Grado', datosFiltrados, 'grado');
		} else {
			generarGraficoPromedioPor(`Promedio por Grupo - Grado ${grado}`, datosFiltrados, 'grupo');
		}
		mostrarTablaEstudiantes(datosFiltrados);
	});

	function generarGraficoRevision(titulo, datos) {
		// Paso 1: Agrupar datos por área y prueba
		const grupos = {};

		datos.forEach(dato => {
			const area = dato.area;
			const prueba = dato.prueba;

			if (!area || !prueba) return;

			// Crear estructura: grupos[area][prueba]
			if (!grupos[area]) grupos[area] = {};
			if (!grupos[area][prueba]) grupos[area][prueba] = { suma: 0, contador: 0 };

			if (!isNaN(dato.nota)) {
				grupos[area][prueba].suma += dato.nota;
				grupos[area][prueba].contador++;
			}
		});

		// Paso 2: Obtener todas las áreas y pruebas únicas ordenadas
		const areas = Object.keys(grupos).sort();
		const pruebasSet = new Set();
		Object.values(grupos).forEach(areaPruebas => {
			Object.keys(areaPruebas).forEach(prueba => pruebasSet.add(prueba));
		});
		const pruebas = Array.from(pruebasSet).sort();

		// Paso 3: Crear series para ApexCharts (una serie por cada prueba)
		const series = pruebas.map(prueba => {
			return {
				name: prueba,
				data: areas.map(area => {
					if (grupos[area] && grupos[area][prueba]) {
						const grupo = grupos[area][prueba];
						const promedio = grupo.contador > 0 ? (grupo.suma / grupo.contador) : 0;
						return parseFloat(promedio.toFixed(2));
					}
					return 0;
				})
			};
		});

		// Paso 4: Crear el contenedor del gráfico
		const container = document.getElementById('graficos-container');
		const chartContainer = document.createElement('div');
		chartContainer.className = 'grafico-wrapper';
		chartContainer.style.marginBottom = '30px';

		const tituloEl = document.createElement('h3');
		tituloEl.innerText = titulo;
		tituloEl.style.textAlign = 'center';
		tituloEl.style.marginBottom = '20px';

		const chartDiv = document.createElement('div');
		chartDiv.id = 'chart-' + Date.now(); // ID único

		chartContainer.appendChild(tituloEl);
		chartContainer.appendChild(chartDiv);
		container.appendChild(chartContainer);

		// Paso 5: Configurar opciones de ApexCharts
		const options = {
			series: series,
			chart: {
				type: 'bar',
				height: 400,
				toolbar: {
					show: true
				}
			},
			plotOptions: {
				bar: {
					horizontal: false,
					columnWidth: '70%',
					borderRadius: 4,
					dataLabels: {
						position: 'top'
					}
				}
			},
			dataLabels: {
				enabled: true,
				offsetY: -20,
				style: {
					fontSize: '11px',
					colors: ["#304758"]
				},
				formatter: function (val) {
					return val.toFixed(2);
				}
			},
			stroke: {
				show: true,
				width: 2,
				colors: ['transparent']
			},
			xaxis: {
				categories: areas,
				title: {
					text: 'Áreas',
					style: {
						fontSize: '14px',
						fontWeight: 600
					}
				}
			},
			yaxis: {
				title: {
					text: 'Promedio de Notas',
					style: {
						fontSize: '14px',
						fontWeight: 600
					}
				},
				min: 0,
				max: 5,
				tickAmount: 5
			},
			fill: {
				opacity: 1
			},
			legend: {
				position: 'top',
				horizontalAlign: 'center',
				fontSize: '13px',
				markers: {
					width: 12,
					height: 12,
					radius: 2
				}
			},
			tooltip: {
				y: {
					formatter: function (val) {
						return val.toFixed(2) + " pts";
					}
				}
			},
			colors: ['#008FFB', '#00E396', '#FEB019', '#FF4560', '#775DD0', '#546E7A', '#26a69a', '#D4526E']
		};

		// Paso 6: Renderizar el gráfico
		const chart = new ApexCharts(chartDiv, options);
		chart.render();

		return chart;
	}

	function generarGraficoPromedioPor(titulo, datos, agruparPor) {
		const grupos = {};
		datos.forEach(dato => {
			const clave = dato[agruparPor];
			if (!clave) return;
			if (!grupos[clave]) grupos[clave] = { suma: 0, contador: 0 };
			if (!isNaN(dato.nota)) {
				grupos[clave].suma += dato.nota;
				grupos[clave].contador++;
			}
		});
		const labels = Object.keys(grupos).sort((a, b) => { return Number(a.grado) - Number(b.grado) });
		const promedios = labels.map(clave => (grupos[clave].contador > 0 ? (grupos[clave].suma / grupos[clave].contador) : 0));
		const coloresBarras = promedios.map((prom, index) => {
			const areaParaColor = (agruparPor === 'area') ? labels[index] : 'puntaje_global';
			return getNivelInfo(areaParaColor, prom).color;
		});
		if (labels.length > 0) {
			generarElementoGrafico(titulo, labels, promedios, coloresBarras);
		}
	}

	function generarElementoGrafico(titulo, labels, data, colores) {
		const container = document.getElementById('graficos-container');
		const canvasContainer = document.createElement('div');
		canvasContainer.className = 'grafico-wrapper';
		const tituloEl = document.createElement('h4');
		tituloEl.innerText = titulo;
		const canvas = document.createElement('canvas');
		canvasContainer.appendChild(tituloEl);
		canvasContainer.appendChild(canvas);
		container.appendChild(canvasContainer);
		new Chart(canvas, {
			type: 'bar',
			data: {
				labels: labels,
				datasets: [{
					label: 'Promedio de Notas',
					data: data.map(d => d.toFixed(2)),
					backgroundColor: colores,
					borderColor: '#ffffff',
					borderWidth: 1,
					borderRadius: 4
				}]
			},
			options: { scales: { y: { beginAtZero: true, suggestedMax: 5.0 } }, plugins: { legend: { display: false } } }
		});
	}

	function mostrarTablaEstudiantes(datos) {
		const tbody = document.getElementById('tabla-estudiantes-body');
		const estudiantes = {};
		datos.forEach(dato => {
			const nombreEstudiante = dato.estudiante ? dato.estudiante.trim() : 'Sin Nombre';
			if (!estudiantes[nombreEstudiante]) {
				estudiantes[nombreEstudiante] = { grupo: dato.grupo };
			}
			estudiantes[nombreEstudiante][dato.area] = dato.nota;
		});

		for (const nombreEstudiante in estudiantes) {
			const datosEstudiante = estudiantes[nombreEstudiante];
			const tr = document.createElement('tr');
			tr.innerHTML = `<td>${nombreEstudiante}</td><td>${datosEstudiante.grupo || 'N/A'}</td>`;
			NOMBRES_AREAS_CSV.forEach(area => {
				const nota = datosEstudiante[area] || 0;
				const nivel = getNivelInfo(area, nota);
				const td = document.createElement('td');
				td.className = 'celda-nota';
				td.innerText = nota.toFixed(2).replace('.', ',');
				td.style.backgroundColor = nivel.color;
				td.style.color = 'white';
				tr.appendChild(td);
			});
			tbody.appendChild(tr);
		}
	}

	cargarDatos();
});
