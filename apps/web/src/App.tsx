import { Routes, Route } from 'react-router-dom';
import { Sidebar } from './components/Sidebar';
import { ThemeProvider } from './ThemeContext';
import { DashboardPage } from './pages/DashboardPage';
import { MeetingsPage } from './pages/MeetingsPage';
import { MeetingDetailPage } from './pages/MeetingDetailPage';
import { PeoplePage } from './pages/PeoplePage';
import { SettingsPage } from './pages/SettingsPage';
import { TemplatesPage } from './pages/TemplatesPage';
import { MeetingTypesPage } from './pages/MeetingTypesPage';

/**
 * Root application layout.
 * Renders a fixed 240 px sidebar on the left and the active route's page on the right.
 */
export function App() {
  return (
    <ThemeProvider>
      <div className="flex min-h-screen bg-dd-base">
        <Sidebar />
        <main className="flex-1 flex flex-col min-w-0">
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/meetings" element={<MeetingsPage />} />
            <Route path="/meetings/:id" element={<MeetingDetailPage />} />
            <Route path="/people" element={<PeoplePage />} />
            <Route path="/templates" element={<TemplatesPage />} />
            <Route path="/meeting-types" element={<MeetingTypesPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </main>
      </div>
    </ThemeProvider>
  );
}
