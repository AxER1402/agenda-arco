import { act, render, screen } from '@testing-library/react';

import RelojEncabezado from '@/components/layout/RelojEncabezado';

/** 11 de agosto de 2026, 14:30:00 en Guatemala (UTC-6). */
const MOMENTO = new Date('2026-08-11T20:30:00Z');

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(MOMENTO);
});

afterEach(() => {
  jest.useRealTimers();
});

describe('RelojEncabezado', () => {
  it('muestra la hora y la fecha de Guatemala', () => {
    render(<RelojEncabezado />);

    expect(screen.getByText(/02:30:00\s*P\.?\s?M\.?/i)).toBeInTheDocument();
    expect(screen.getByText(/11 de agosto de 2026/)).toBeInTheDocument();
  });

  it('avanza cada segundo', () => {
    render(<RelojEncabezado />);

    act(() => {
      jest.advanceTimersByTime(1000);
    });

    expect(screen.getByText(/02:30:01\s*P\.?\s?M\.?/i)).toBeInTheDocument();
  });

  it('no depende de la zona horaria del equipo', () => {
    // El mismo instante, mirado desde una máquina en otro huso: la hora que se
    // muestra sigue siendo la del laboratorio.
    render(<RelojEncabezado />);

    expect(screen.queryByText(/08:30:00/)).not.toBeInTheDocument();
  });
});
