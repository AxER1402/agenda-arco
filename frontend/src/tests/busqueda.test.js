import { coincideCita, coincideExamen } from '@/lib/busqueda';

const CITA = {
  paciente_nombre: 'María José López',
  paciente_telefono: '55512345',
  numero_orden: 'IGSS-2026-881',
  notas: 'Viene en ayunas',
  examenes: [{ nombre: 'Glucosa', codigo: 'QUI-001' }],
};

describe('coincideCita', () => {
  it.each([
    ['', true],
    ['maria', true],
    ['LÓPEZ', true],
    ['5551-2345', true],
    ['12345', true],
    ['glucosa', true],
    ['qui-001', true],
    ['igss-2026', true],
    ['ayunas', true],
    ['maria glucosa', true],
    ['pedro', false],
    ['maria orina', false],
    ['99999', false],
  ])('"%s" → %s', (termino, esperado) => {
    expect(coincideCita(CITA, termino)).toBe(esperado);
  });
});

describe('coincideExamen', () => {
  const EXAMEN = { codigo: 'QUI-001', nombre: 'Glucosa pre y post' };

  it.each([
    ['', true],
    ['qui', true],
    ['qui-001', true],
    ['GLUCOSA', true],
    ['glucosa post', true],
    ['hem', false],
  ])('"%s" → %s', (termino, esperado) => {
    expect(coincideExamen(EXAMEN, termino)).toBe(esperado);
  });
});
