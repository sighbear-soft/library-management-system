import { useState, useEffect } from 'react';
<<<<<<< HEAD
import { Routes, Route, useNavigate } from 'react-router-dom';
import BookSearch from './pages/BookSearch';
import HomePage from './pages/HomePage';
import MyHistory from './reader/MyHistory';
import MyReservations from './reader/MyReservations';
import UnifiedLogin from './pages/UnifiedLogin';
import Register from './pages/Register';
import AdminDashboard from './pages/AdminDashboard';
import SystemLogs from './adminLogs/SystemLogs';
import LibrarianApp from './librarian/LibrarianApp';
import Announcements from './pages/Announcements';
import AdminAnnouncements from './pages/AdminAnnouncements';
import UserManagement from './pages/UserManagement';
import Messages from './pages/Messages';
import SystemConfig from './pages/SystemConfig';
import AdminBackupPage from './pages/AdminBackupPage';
import AdminBlocklist from './pages/AdminBlocklist';

function App() {
  const navigate = useNavigate();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('search');

  useEffect(() => {
    const token = localStorage.getItem('token') || localStorage.getItem('librarianToken');
=======
import BookSearch from './pages/BookSearch';
import MyHistory from './reader/MyHistory';
import Login from './pages/Login';
import Register from './pages/Register';

function App() {
 const [isLoggedIn, setIsLoggedIn] = useState(false);
 const [loading, setLoading] = useState(true);
const [activeTab, setActiveTab] = useState('search');

  useEffect(() => {
    const token = localStorage.getItem('token');
>>>>>>> af9ecfbeebfa89b807d4957f9b88257908c13b6b
    if (token) {
      setIsLoggedIn(true);
    }
    setLoading(false);
  }, []);

  const handleLogin = () => {
    setIsLoggedIn(true);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
<<<<<<< HEAD
    localStorage.removeItem('librarianToken');
    localStorage.removeItem('librarianInfo');
    setIsLoggedIn(false);
    setActiveTab('search');
    navigate('/login');
  };

  if (loading) return <div>Loading...</div>;

  return (
    <Routes>
      <Route path="/register" element={<Register />} />
      <Route path="/login" element={<UnifiedLogin />} />
      <Route path="/librarian-login" element={<LibrarianApp />} />
      <Route path="/admin-dashboard" element={<AdminDashboard />} />
      <Route path="/admin-logs" element={<SystemLogs />} />
      <Route path="/admin/users" element={<UserManagement />} />
      <Route path="/announcements" element={<Announcements />} />
      <Route path="/admin/announcements" element={<AdminAnnouncements />} />
      <Route path="/history" element={<MyHistory />} />
      <Route path="/my-reservations" element={<MyReservations />} />
      <Route path="/messages" element={<Messages />} />
      <Route path="/search" element={<BookSearch />} />
      <Route path="/" element={
        isLoggedIn ? (
          <HomePage />
        ) : (
          <UnifiedLogin />
        )
      } />
      <Route path="/admin/config" element={<SystemConfig />} />
      <Route path="/admin/backups" element={<AdminBackupPage />} />
      <Route path="/admin/blocklist" element={<AdminBlocklist />} />
    </Routes>
=======
    setIsLoggedIn(false);
    setActiveTab('search');
  };

 if (loading) return <div>Loading...</div>;

  const path = window.location.pathname;

  if (path === '/register') {
    return <Register />;
  }

  if (!isLoggedIn) {
    return <Login onLogin={handleLogin} />;
  }
  
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 20px', background: '#3b82f6', color: 'white' }}>
        <h2>Library System</h2>
        <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
          <button onClick={() => setActiveTab('search')} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontSize: '16px', borderBottom: activeTab === 'search' ? '2px solid white' : 'none', padding: '5px 0' }}>
            Search Books
          </button>
          <button onClick={() => setActiveTab('history')} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontSize: '16px', borderBottom: activeTab === 'history' ? '2px solid white' : 'none', padding: '5px 0' }}>
            My History
          </button>
          <button onClick={handleLogout} style={{ padding: '5px 10px', background: '#ef4444', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}>Logout</button>
        </div>
      </div>
      
      <div style={{ padding: '20px' }}>
        {activeTab === 'search' ? <BookSearch /> : <MyHistory />}
      </div>
    </div>
>>>>>>> af9ecfbeebfa89b807d4957f9b88257908c13b6b
  );
}

export default App;