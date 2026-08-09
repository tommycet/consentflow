import { Routes, Route, Navigate } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import { Landing } from './pages/Landing';
import { Participant } from './pages/Participant';
import { Researcher } from './pages/Researcher';
import { Audit } from './pages/Audit';
import { Docs } from './pages/Docs';
import { Footer } from './components/Footer';
import { ToastContainer } from './components/Toast';
import { useToasts } from './hooks/useUtils';
import './index.css';

function App() {
  const { toasts, clearToast } = useToasts();

  return (
    <div className="min-h-screen bg-cf-bg text-cf-text font-body antialiased cf-bg-pattern">
      <Navbar />
      <main className="pt-20">
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/participant" element={<Participant />} />
          <Route path="/researcher" element={<Researcher />} />
          <Route path="/audit" element={<Audit />} />
          <Route path="/docs" element={<Docs />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <Footer />
      <ToastContainer toasts={toasts} onDismiss={clearToast} />
    </div>
  );
}

export default App;
