import { Navigate, Route, Routes } from 'react-router-dom';

import AppLayout from '@/components/layout/AppLayout';
import RutaProtegida from '@/components/RutaProtegida';
import AgendaPage from '@/pages/AgendaPage';
import CitasPage from '@/pages/CitasPage';
import ConfiguracionPage from '@/pages/ConfiguracionPage';
import DashboardPage from '@/pages/DashboardPage';
import EstadoSistemaPage from '@/pages/EstadoSistemaPage';
import ExamenesPage from '@/pages/ExamenesPage';
import LoginPage from '@/pages/LoginPage';
import PacientesPage from '@/pages/PacientesPage';
import UsuariosPage from '@/pages/UsuariosPage';

const ROLES = { ADMINISTRADOR: 'ADMINISTRADOR' };

/**
 * Enrutado de la SPA.
 * Todo lo que cuelga de RutaProtegida exige sesión iniciada; el backend vuelve
 * a comprobar token y rol en cada petición.
 */
function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/estado" element={<EstadoSistemaPage />} />

      <Route element={<RutaProtegida />}>
        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/pacientes" element={<PacientesPage />} />
          <Route path="/citas" element={<CitasPage />} />
          <Route path="/agenda" element={<AgendaPage />} />
          <Route path="/examenes" element={<ExamenesPage />} />

          <Route element={<RutaProtegida rolesPermitidos={[ROLES.ADMINISTRADOR]} />}>
            <Route path="/usuarios" element={<UsuariosPage />} />
            <Route path="/configuracion" element={<ConfiguracionPage />} />
          </Route>
        </Route>
      </Route>

      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default App;
