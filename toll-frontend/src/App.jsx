import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import Otp from './pages/Otp';
import AppShell from './pages/AppShell';
import Home from './pages/app/Home';
import Vehicles from './pages/app/Vehicles';
import Topup from './pages/app/Topup';
import FakePhone from './pages/app/FakePhone';
import Passes from './pages/app/Passes';
import History from './pages/app/History';
import Notifications from './pages/app/Notifications';
import AdminShell from './pages/admin/AdminShell';
import Dashboard from './pages/admin/Dashboard';
import AdminTransactions from './pages/admin/Transactions';
import Reports from './pages/admin/Reports';
import Audit from './pages/admin/Audit';
import Tariffs from './pages/admin/Tariffs';
import Gates from './pages/admin/Gates';
import Violations from './pages/admin/Violations';
import AdminUsers from './pages/admin/Users';
import Simulator from './pages/Simulator';
import SimulatorCamera from './pages/SimulatorCamera';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/otp" element={<Otp />} />
        <Route path="/app" element={<AppShell />}>
          <Route index element={<Home />} />
          <Route path="vehicles" element={<Vehicles />} />
          <Route path="topup" element={<Topup />} />
          <Route path="fake-phone" element={<FakePhone />} />
          <Route path="passes" element={<Passes />} />
          <Route path="history" element={<History />} />
          <Route path="notifications" element={<Notifications />} />
        </Route>
        <Route path="/admin" element={<AdminShell />}>
          <Route index element={<Dashboard />} />
          <Route path="transactions" element={<AdminTransactions />} />
          <Route path="reports" element={<Reports />} />
          <Route path="audit" element={<Audit />} />
          <Route path="tariffs" element={<Tariffs />} />
          <Route path="gates" element={<Gates />} />
          <Route path="violations" element={<Violations />} />
          <Route path="users" element={<AdminUsers />} />
        </Route>
        <Route path="/simulator" element={<Simulator />} />
        <Route path="/simulator/camera" element={<SimulatorCamera />} />
      </Routes>
    </BrowserRouter>
  );
}