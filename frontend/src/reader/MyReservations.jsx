// frontend/src/reader/MyReservations.jsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import ReaderLayout from '../components/ReaderLayout';

function MyReservations() {
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (userData) {
      try {
        setUser(JSON.parse(userData));
      } catch (e) {
        console.error('Failed to parse user data');
      }
    }
    fetchReservations();
  }, []);

  const fetchReservations = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }

    try {
      const response = await fetch('http://localhost:3001/api/reader/my-reservations', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        setReservations(data.reservations);
      }
    } catch (error) {
      setMessage('获取预约列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelReservation = async (reservationId, bookTitle) => {
    const token = localStorage.getItem('token');
    if (!confirm(`确定要取消《${bookTitle}》的预约吗？`)) return;

    try {
      const response = await fetch(`http://localhost:3001/api/reader/cancel-reservation/${reservationId}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        setMessage(`已取消《${bookTitle}》的预约`);
        fetchReservations();
      } else {
        setMessage(data.message || '取消失败');
      }
    } catch (error) {
      setMessage('取消失败');
    }
    setTimeout(() => setMessage(''), 3000);
  };

  const getStatusText = (reservation) => {
    if (reservation.status === 'PENDING') {
      return reservation.isExpired ? '已过期' : '等待确认';
    }
    if (reservation.status === 'EXPIRED') return '已过期';
    if (reservation.status === 'CANCELLED') return '已取消';
    return reservation.status;
  };

  const getStatusColor = (reservation) => {
    if (reservation.status === 'PENDING') {
      return reservation.isExpired ? 'bg-gray-500' : 'bg-yellow-500';
    }
    if (reservation.status === 'EXPIRED') return 'bg-gray-500';
    if (reservation.status === 'CANCELLED') return 'bg-red-500';
    return 'bg-blue-500';
  };

  const formatExpiresAt = (expiresAt) => {
    const date = new Date(expiresAt);
    return date.toLocaleString('zh-CN');
  };

  const getRemainingTime = (expiresAt) => {
    const now = new Date();
    const expire = new Date(expiresAt);
    if (now >= expire) return '已过期';
    
    const diffMs = expire - now;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffMinutes = diffMins % 60;
    
    if (diffHours > 0) {
      return `${diffHours}小时${diffMinutes}分钟`;
    }
    return `${diffMinutes}分钟`;
  };

  if (loading) {
    return (
      <ReaderLayout user={user}>
        <div className="flex items-center justify-center min-h-[60vh]">
          <svg className="animate-spin h-8 w-8 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        </div>
      </ReaderLayout>
    );
  }

  return (
    <ReaderLayout user={user}>
      <div className="bg-gradient-to-r from-green-500 to-teal-600 rounded-lg shadow-lg p-6 mb-8 text-white">
        <h2 className="text-2xl font-bold mb-2">我的预约</h2>
        <p className="opacity-90">查看和管理您的图书预约</p>
      </div>

      {message && (
        <div className={`p-4 mb-6 rounded-lg ${message.includes('成功') || message.includes('取消') ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
          {message}
        </div>
      )}

      {reservations.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
          暂无预约记录
          <button
            onClick={() => navigate('/search')}
            className="block mx-auto mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
          >
            去借书
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">书名</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">作者</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">预约时间</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">有效期至</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">剩余时间</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">状态</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {reservations.map((res) => (
                  <tr key={res.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{res.bookTitle}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{res.bookAuthor}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(res.createdAt).toLocaleString()}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatExpiresAt(res.expiresAt)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      {res.status === 'PENDING' && !res.isExpired ? (
                        <span className="text-orange-600">{getRemainingTime(res.expiresAt)}</span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-medium text-white rounded-full ${getStatusColor(res)}`}>
                        {getStatusText(res)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {res.status === 'PENDING' && !res.isExpired && (
                        <button
                          onClick={() => handleCancelReservation(res.id, res.bookTitle)}
                          className="px-3 py-1 bg-red-500 text-white text-xs rounded hover:bg-red-600 transition"
                        >
                          取消预约
                        </button>
                      )}
                      {res.isExpired && (
                        <span className="text-gray-400 text-xs">已失效</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 温馨提示 */}
      <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
        <h3 className="font-semibold text-blue-800 mb-2">📌 温馨提示</h3>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>• 预约成功后，请在2小时内到图书馆借出图书</li>
          <li>• 超过2小时未借出，预约将自动失效，库存释放</li>
          <li>• 如需取消预约，请在有效期内点击"取消预约"</li>
          <li>• 到馆后请告知馆员您的预约信息</li>
        </ul>
      </div>
    </ReaderLayout>
  );
}

export default MyReservations;