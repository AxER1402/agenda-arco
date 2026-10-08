/**
 * Los nombres de los pacientes se guardan en mayúsculas y sin tildes.
 */
jest.mock('../models/paciente.model');
jest.mock('../models/recordatorio.model');
jest.mock('../models/cita.model');
jest.mock('../models/configuracion.model');
jest.mock('../services/whatsapp.client');

const pacienteModel = require('../models/paciente.model');
const pacienteService = require('../services/paciente.service');
const { normalizarNombre, nombrePropio } = require('../utils/nombre');
const recordatorioService = require('../services/recordatorio.service');

describe('normalizarNombre', () => {
  it.each([
    ['María José López', 'MARIA JOSE LOPEZ'],
    ['josé ángel', 'JOSE ANGEL'],
    ['ANDRÉS RAMÍREZ', 'ANDRES RAMIREZ'],
    ['Ramón Güemes', 'RAMON GUEMES'],
    // La Ñ es una letra, no una tilde: se conserva.
    ['Ana Peña Muñoz', 'ANA PEÑA MUÑOZ'],
    ['  ana    lópez  ', 'ANA LOPEZ'],
    ['JUAN PEREZ', 'JUAN PEREZ'],
  ])('«%s» → «%s»', (entrada, esperado) => {
    expect(normalizarNombre(entrada)).toBe(esperado);
  });

  it('lo que no es texto queda vacío', () => {
    expect(normalizarNombre(undefined)).toBe('');
  });
});

describe('al guardar un paciente', () => {
  beforeEach(() => {
    pacienteModel.buscarPorTelefono.mockResolvedValue([]);
    pacienteModel.buscarPorDpi?.mockResolvedValue?.([]);
    pacienteModel.crear.mockImplementation(async (datos) => ({ id: 1, ...datos }));
    pacienteModel.buscarPorId.mockResolvedValue({ id: 1, nombre_completo: 'X', activo: 1 });
    pacienteModel.actualizar.mockImplementation(async (id, cambios) => ({ id, ...cambios }));
  });

  it('lo registra en mayúsculas y sin tildes', async () => {
    await pacienteService.crear({ nombreCompleto: 'María Peña', telefono: '55512345' });

    expect(pacienteModel.crear).toHaveBeenCalledWith(
      expect.objectContaining({ nombreCompleto: 'MARIA PEÑA' }),
    );
  });

  it('también al corregirlo', async () => {
    await pacienteService.actualizar(1, { nombreCompleto: 'José Ángel' });

    expect(pacienteModel.actualizar).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ nombreCompleto: 'JOSE ANGEL' }),
    );
  });
});

describe('nombrePropio, para el recordatorio', () => {
  it.each([
    ['MARIA JOSE LOPEZ', 'Maria Jose Lopez'],
    ['MARIA DE LOS ANGELES PEÑA', 'Maria de los Angeles Peña'],
    ['DE LEON PEREZ', 'De Leon Perez'],
    ['JUAN PEREZ-MOLINA', 'Juan Perez-Molina'],
    ['  ana   muñoz ', 'Ana Muñoz'],
  ])('«%s» → «%s»', (entrada, esperado) => {
    expect(nombrePropio(entrada)).toBe(esperado);
  });

  it('el recordatorio trata al paciente con mayúscula inicial', () => {
    const mensaje = recordatorioService.generarMensaje(
      { paciente_nombre: 'MARIA JOSE PEÑA', fecha: '2026-10-20', hora: '07:00:00', examenes: [] },
      'El Arco Laboratorios',
      'Estimado(a) {paciente}:',
    );

    expect(mensaje).toBe('Estimado(a) Maria Jose Peña:');
  });
});
