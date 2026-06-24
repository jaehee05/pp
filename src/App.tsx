import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AdminLayout } from './components/AdminLayout';
import { OpsLayout } from './components/OpsLayout';
import { Dashboard } from './pages/admin/Dashboard';
import { MembersAdmin } from './pages/admin/Members';
import { SimpleStub } from './pages/admin/Stub';
import { PlansPage } from './pages/admin/Plans';
import { MessagesTemplates } from './pages/admin/MessagesTemplates';
import { MessagesHistory } from './pages/admin/MessagesHistory';
import { MessagesBalance } from './pages/admin/MessagesBalance';
import { PpurioSettingsPage } from './pages/admin/PpurioSettings';
import { BulkImportPage } from './pages/admin/BulkImport';
import { SeatsPage } from './pages/Seats';
import { OpsRegister } from './pages/ops/Register';
import { OpsMember } from './pages/ops/Member';
import { OpsStub } from './pages/ops/Stub';
import { KioskPage } from './pages/Kiosk';
import { LoginPage } from './pages/Login';
import { AccountPage } from './pages/admin/Account';
import { RequireAuth } from './components/AuthGate';
import { useRealtimeStores } from './lib/realtime';

export default function App() {
  useRealtimeStores();
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/kiosk" element={<KioskPage />} />
        <Route index element={<Navigate to="/admin/dashboard" replace />} />

        <Route path="/admin" element={<RequireAuth><AdminLayout /></RequireAuth>}>
          <Route index element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="members" element={<MembersAdmin />} />
          <Route path="sales/daily" element={<SimpleStub title="일별 매출" />} />
          <Route path="sales/payments" element={<SimpleStub title="결제 내역" />} />
          <Route path="sales/refunds" element={<SimpleStub title="환불 내역" />} />
          <Route path="store/info" element={<SimpleStub title="매장 정보" />} />
          <Route path="store/managers" element={<SimpleStub title="매니저 관리" />} />
          <Route path="store/hours" element={<SimpleStub title="운영 시간" />} />
          <Route path="account" element={<AccountPage />} />
          <Route path="seat-plans" element={<PlansPage category="seat" />} />
          <Route path="messages/templates" element={<MessagesTemplates />} />
          <Route path="messages/history" element={<MessagesHistory />} />
          <Route path="messages/balance" element={<MessagesBalance />} />
          <Route path="messages/ppurio" element={<PpurioSettingsPage />} />
          <Route path="bulk-import" element={<BulkImportPage />} />
          <Route path="layouts/seats" element={<SeatsPage />} />
        </Route>

        <Route path="/ops" element={<RequireAuth><OpsLayout /></RequireAuth>}>
          <Route index element={<Navigate to="/ops/layout" replace />} />
          <Route path="layout" element={<SeatsPage editable={false} />} />
          <Route path="notices" element={<OpsStub title="전달사항" />} />
          <Route path="reservations" element={<OpsStub title="예약문의" />} />
          <Route path="register" element={<OpsRegister />} />
          <Route path="member/:id" element={<OpsMember />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
