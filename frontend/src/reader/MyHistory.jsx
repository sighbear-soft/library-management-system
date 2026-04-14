import { useState, useEffect } from 'react';

function MyHistory() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [renewMessage, setRenewMessage] = useState('');

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Please login first');
        setLoading(false);
        return;
      }

      // 改为调用你的后端接口
      const response = await fetch('http://localhost:3001/api/reader/my-borrows', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch borrow history');
      }

      const data = await response.json();
      setHistory(data.loans || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // 续借函数
  const handleRenew = async (loanId) => {
    const token = localStorage.getItem('token');
    if (!token) {
      setRenewMessage('请先登录');
      return;
    }

    setRenewMessage('');
    try {
      const response = await fetch('http://localhost:3001/api/reader/renew', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ loanIds: [loanId] })
      });

      const data = await response.json();
      const result = data.results[0];

      if (result.success) {
        setRenewMessage(`续借成功！新截止日期：${new Date(result.newDueDate).toLocaleDateString()}`);
        fetchHistory(); // 刷新列表
      } else {
        setRenewMessage(`续借失败：${result.message}`);
      }
    } catch (error) {
      setRenewMessage('续借失败：' + error.message);
    }

    // 3秒后清除消息
    setTimeout(() => setRenewMessage(''), 3000);
  };

  const getStatusText = (loan) => {
    const dueDate = new Date(loan.dueDate);
    const today = new Date();
    if (loan.returnDate) return '已归还';
    if (dueDate < today) return '逾期';
    return '借阅中';
  };

  const getStatusColor = (loan) => {
    const dueDate = new Date(loan.dueDate);
    const today = new Date();
    if (loan.returnDate) return '#10b981';
    if (dueDate < today) return '#ef4444';
    return '#3b82f6';
  };

  // 判断是否可以续借（未归还、未逾期、续借次数<2）
  const canRenew = (loan) => {
    if (loan.returnDate) return false;
    const dueDate = new Date(loan.dueDate);
    const today = new Date();
    if (dueDate < today) return false;
    return (loan.renewCount || 0) < 2;
  };

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '40px' }}>加载中...</div>;
  }

  if (error) {
    return <div style={{ textAlign: 'center', padding: '40px', color: 'red' }}>{error}</div>;
  }

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px' }}>
      <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '20px', borderBottom: '2px solid #3b82f6', paddingBottom: '10px' }}>
        我的借阅
      </h2>

      {renewMessage && (
        <div style={{
          padding: '10px',
          marginBottom: '20px',
          backgroundColor: renewMessage.includes('成功') ? '#d4edda' : '#f8d7da',
          color: renewMessage.includes('成功') ? '#155724' : '#721c24',
          borderRadius: '4px'
        }}>
          {renewMessage}
        </div>
      )}

      {history.length === 0 ? (
        <p style={{ textAlign: 'center', color: '#6b7280', padding: '40px' }}>暂无借阅记录</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: 'white', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <thead style={{ backgroundColor: '#f3f4f6' }}>
              <tr>
                <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>书名</th>
                <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>作者</th>
                <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>借书日期</th>
                <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>应还日期</th>
                <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>续借次数</th>
                <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>状态</th>
                <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {history.map((loan) => (
                <tr key={loan.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                  <td style={{ padding: '12px' }}>{loan.book?.title || '未知'}</td>
                  <td style={{ padding: '12px' }}>{loan.book?.author || '未知'}</td>
                  <td style={{ padding: '12px' }}>{new Date(loan.checkoutDate).toLocaleDateString()}</td>
                  <td style={{ padding: '12px' }}>{new Date(loan.dueDate).toLocaleDateString()}</td>
                  <td style={{ padding: '12px' }}>{loan.renewCount || 0}/2</td>
                  <td style={{ padding: '12px' }}>
                    <span style={{
                      backgroundColor: getStatusColor(loan),
                      color: 'white',
                      padding: '2px 8px',
                      borderRadius: '12px',
                      fontSize: '12px'
                    }}>
                      {getStatusText(loan)}
                    </span>
                  </td>
                  <td style={{ padding: '12px' }}>
                    {canRenew(loan) && (
                      <button
                        onClick={() => handleRenew(loan.id)}
                        style={{
                          padding: '6px 12px',
                          backgroundColor: '#28a745',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer'
                        }}
                      >
                        续借
                      </button>
                    )}
                    {!canRenew(loan) && loan.returnDate === null && (
                      <span style={{ color: '#dc3545', fontSize: '12px' }}>
                        {(loan.renewCount || 0) >= 2 ? '已达续借上限' : '逾期不可续借'}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default MyHistory;