import { Routes, Route, Navigate } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import { Landing } from './pages/Landing';
import { Participant } from './pages/Participant';
import { Researcher } from './pages/Researcher';
import { Audit } from './pages/Audit';
import { ToastContainer } from './components/Toast';
import { useToasts } from './hooks/useUtils';
import './index.css';

function App() {
  const { toasts, clearToast } = useToasts();

  return (
    <div className="min-h-screen bg-gray-950 text-white font-sans antialiased">
      <Navbar />
      <main className="pt-20 pb-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/participant" element={<Participant />} />
            <Route path="/researcher" element={<Researcher />} />
            <Route path="/audit" element={<Audit />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </main>
      <ToastContainer toasts={toasts} onDismiss={clearToast} />
    </div>
  );
}

export default App;