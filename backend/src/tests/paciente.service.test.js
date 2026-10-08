jest.mock('../models/paciente.model');
jest.mock('../services/auth.service');

const pacienteModel = require('../models/paciente.model');
const authService = require('../services/auth.service');
const pacienteService = require('../services/paciente.service');

beforeEach(() => {
  pacienteModel.buscarPorTelefono.mockResolvedValue([]);
  pacienteModel.buscarPorDpi.mockResolvedValue([]);
  pacienteModel.crear.mockImplementation(async (datos) => ({ id: 1, ...datos }));
  pacienteModel.buscarPorId.mockResolvedValue({ id: 1, nombre_completo: 'Ana López', activo: 1 });
  pacienteModel.actualizar.mockImplementation(async (id, cambios) => ({ id, ...cambios }));
});

describe('crear paciente', () => {
  it('guarda el teléfono normalizado', async () => {
    const { paciente } = await pacienteService.crear({
      nombreCompleto: 'Ana López',
      telefono: '5555-5555',
    });

    expect(paciente.telefono).toBe('55555555');
  });

  it('recorta los espacios del nombre y lo guarda en mayúsculas sin tildes', async () => {
    const { paciente } = await pacienteService.crear({
      nombreCompleto: '  Ana López  ',
      telefono: '55555555',
    });

    expect(paciente.nombre_completo ?? paciente.nombreCompleto).toBe('ANA LOPEZ');
  });

  it.each(['2323232', '232323233', 'abcdefgh', ''])(
    'rechaza el teléfono inválido %p',
    async (telefono) => {
      await expect(
        pacienteService.crear({ nombreCompleto: 'Ana López', telefono }),
      ).rejects.toMatchObject({ statusCode: 400 });

      expect(pacienteModel.crear).not.toHaveBeenCalled();
    },
  );

  it('avisa si otro paciente ya usa ese teléfono, pero no bloquea el registro', async () => {
    pacienteModel.buscarPorTelefono.mockResolvedValue([
      { id: 2, nombre_completo: 'Carlos Pérez' },
    ]);

    const { paciente, avisos } = await pacienteService.crear({
      nombreCompleto: 'Ana Pérez',
      telefono: '55555555',
    });

    // Los familiares comparten teléfono: es un aviso, no un error.
    expect(paciente).toBeDefined();
    expect(avisos[0]).toContain('Carlos Pérez');
  });

  describe('DPI', () => {
    const base = { nombreCompleto: 'Ana López', telefono: '55555555' };

    it('guarda los 13 dígitos sin separadores', async () => {
      const { paciente } = await pacienteService.crear({ ...base, dpi: '1111 11111 1111' });

      expect(paciente.dpi).toBe('1111111111111');
    });

    it.each([undefined, '', null])('lo deja vacío si no lo traen (%p)', async (dpi) => {
      const { paciente } = await pacienteService.crear({ ...base, dpi });

      expect(paciente.dpi).toBeNull();
    });

    it.each(['1111111111', '111111111111', '11111111111111'])(
      'rechaza %p porque no tiene 13 dígitos',
      async (dpi) => {
        await expect(pacienteService.crear({ ...base, dpi })).rejects.toMatchObject({
          statusCode: 400,
        });

        expect(pacienteModel.crear).not.toHaveBeenCalled();
      },
    );

    it('avisa si ese DPI ya está registrado, pero no bloquea', async () => {
      pacienteModel.buscarPorDpi.mockResolvedValue([{ id: 2, nombre_completo: 'Ana L. López' }]);

      const { paciente, avisos } = await pacienteService.crear({
        ...base,
        dpi: '1111111111111',
      });

      expect(paciente).toBeDefined();
      expect(avisos.join(' ')).toContain('Ana L. López');
    });
  });
});

describe('actualizar paciente', () => {
  it('olvida lo que sabía del WhatsApp al cambiar el número', async () => {
    await pacienteService.actualizar(1, { telefono: '23232323' });

    expect(pacienteModel.actualizar).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ telefono: '23232323', tieneWhatsapp: null }),
    );
  });

  it('no toca el dato de WhatsApp si solo cambia el nombre', async () => {
    await pacienteService.actualizar(1, { nombreCompleto: 'Ana María López' });

    expect(pacienteModel.actualizar.mock.calls[0][1]).not.toHaveProperty('tieneWhatsapp');
  });

  it('devuelve 404 si el paciente no existe', async () => {
    pacienteModel.buscarPorId.mockResolvedValue(null);

    await expect(pacienteService.actualizar(99, { nombreCompleto: 'X' })).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});

describe('búsqueda', () => {
  it('devuelve la paginación calculada', async () => {
    pacienteModel.buscar.mockResolvedValue({ pacientes: [], total: 45 });

    const { paginacion } = await pacienteService.buscar({ pagina: 2, porPagina: 20 });

    expect(paginacion).toEqual({ pagina: 2, porPagina: 20, total: 45, totalPaginas: 3 });
  });

  it('acota el tamaño de página para que nadie pida la tabla entera', async () => {
    pacienteModel.buscar.mockResolvedValue({ pacientes: [], total: 0 });

    await pacienteService.buscar({ porPagina: 5000 });

    expect(pacienteModel.buscar.mock.calls[0][0].limite).toBe(100);
  });

  it('pasa al modelo lo que se escribió y deja fuera a los inactivos', async () => {
    pacienteModel.buscar.mockResolvedValue({
      pacientes: [{ id: 1, nombre_completo: 'Ana López' }],
      total: 1,
    });

    const { pacientes } = await pacienteService.buscar({ termino: 'Ana' });

    expect(pacientes).toHaveLength(1);
    expect(pacienteModel.buscar).toHaveBeenCalledWith(
      expect.objectContaining({ termino: 'Ana', incluirInactivos: false }),
    );
  });

  it('incluye a los inactivos solo cuando se pide', async () => {
    pacienteModel.buscar.mockResolvedValue({ pacientes: [], total: 0 });

    await pacienteService.buscar({ termino: '5555', incluirInactivos: true });

    expect(pacienteModel.buscar.mock.calls[0][0].incluirInactivos).toBe(true);
  });

  it('vuelve a la primera página si la pedida no es válida', async () => {
    pacienteModel.buscar.mockResolvedValue({ pacientes: [], total: 0 });

    const { paginacion } = await pacienteService.buscar({ pagina: 'abc' });

    expect(paginacion.pagina).toBe(1);
    expect(pacienteModel.buscar.mock.calls[0][0].desplazamiento).toBe(0);
  });
});

describe('baja lógica', () => {
  it('desactiva en lugar de borrar, para conservar el historial', async () => {
    await pacienteService.desactivar(1);

    expect(pacienteModel.actualizar).toHaveBeenCalledWith(1, { activo: false });
  });
});

describe('borrado definitivo', () => {
  beforeEach(() => {
    authService.confirmarIdentidad.mockResolvedValue(true);
    pacienteModel.eliminarConHistorial.mockResolvedValue({ citas: 2, ordenes: 1 });
  });

  it('exige la contraseña de quien lo pide antes de tocar nada', async () => {
    authService.confirmarIdentidad.mockRejectedValue(
      Object.assign(new Error('La contraseña no es correcta.'), { statusCode: 401 }),
    );

    await expect(
      pacienteService.eliminar(1, { idUsuarioSolicitante: 9, contrasena: 'mala' }),
    ).rejects.toMatchObject({ statusCode: 401 });

    expect(pacienteModel.eliminarConHistorial).not.toHaveBeenCalled();
  });

  it('borra al paciente con su historial y dice cuánto se llevó por delante', async () => {
    const resultado = await pacienteService.eliminar(1, {
      idUsuarioSolicitante: 9,
      contrasena: 'buena',
    });

    expect(pacienteModel.eliminarConHistorial).toHaveBeenCalledWith(1);
    expect(resultado).toEqual({ id: 1, eliminado: true, citas: 2, ordenes: 1 });
  });

  it('devuelve 404 si el paciente no existe', async () => {
    pacienteModel.buscarPorId.mockResolvedValue(null);

    await expect(
      pacienteService.eliminar(99, { idUsuarioSolicitante: 9, contrasena: 'buena' }),
    ).rejects.toMatchObject({ statusCode: 404 });

    expect(pacienteModel.eliminarConHistorial).not.toHaveBeenCalled();
  });
});
