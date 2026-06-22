import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { SeatsPage } from './pages/Seats';
import { StudentsPage } from './pages/Students';
import { StudentDetailPage } from './pages/StudentDetail';
import { PaymentsPage } from './pages/Payments';
import { AttendancePage } from './pages/Attendance';
import { PointsPage } from './pages/Points';
import { SchedulePage } from './pages/Schedule';
import { KioskPage } from './pages/Kiosk';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/kiosk" element={<KioskPage />} />
        <Route element={<Layout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/seats" element={<SeatsPage />} />
          <Route path="/students" element={<StudentsPage />} />
          <Route path="/students/:id" element={<StudentDetailPage />} />
          <Route path="/payments" element={<PaymentsPage />} />
          <Route path="/attendance" element={<AttendancePage />} />
          <Route path="/points" element={<PointsPage />} />
          <Route path="/schedule" element={<SchedulePage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
