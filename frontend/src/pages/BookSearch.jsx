import { useState } from 'react';

function BookSearch() {
  const [searchTitle, setSearchTitle] = useState('');
  const [searchAuthor, setSearchAuthor] = useState('');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [message, setMessage] = useState('');

  const token = localStorage.getItem('token');

  // 搜索函数
  const handleSearch = async () => {
    setLoading(true);
    setSearched(true);
    setMessage('');

    try {
      const params = new URLSearchParams();
      if (searchTitle) params.append('title', searchTitle);
      if (searchAuthor) params.append('author', searchAuthor);
      if (searchKeyword) params.append('keyword', searchKeyword);

      const response = await fetch(`http://localhost:3001/books/search?${params}`);
      const result = await response.json();

      if (result.success) {
        setBooks(result.data);
      } else {
        setBooks([]);
      }
    } catch (error) {
      console.error('Search error:', error);
      setBooks([]);
    } finally {
      setLoading(false);
    }
  };

  // 借阅函数
  const handleBorrow = async (bookId) => {
    const token = localStorage.getItem('token');
    if (!token) {
      setMessage('Please login first');
      return;
    }

    setMessage('');
    try {
      const response = await fetch(`http://localhost:3001/api/reader/borrow/${bookId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (response.ok) {
        setMessage('借阅成功！截止日期：' + new Date(data.loan.dueDate).toLocaleDateString());
        handleSearch(); // 刷新搜索结果
      } else {
        setMessage(data.message || '借阅失败');
      }
    } catch (error) {
      setMessage('借阅失败：' + error.message);
    }
  };

  const handleReset = () => {
    setSearchTitle('');
    setSearchAuthor('');
    setSearchKeyword('');
    setBooks([]);
    setSearched(false);
    setMessage('');
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px' }}>
      <h1>Book Search</h1>

      {message && (
        <div style={{ padding: '10px', marginBottom: '20px', backgroundColor: message.includes('成功') ? '#d4edda' : '#f8d7da', color: message.includes('成功') ? '#155724' : '#721c24', borderRadius: '4px' }}>
          {message}
        </div>
      )}

      <div style={{ background: '#f5f5f5', padding: '20px', borderRadius: '8px', marginBottom: '30px' }}>
        <div style={{ marginBottom: '15px', display: 'flex', alignItems: 'center' }}>
          <label style={{ width: '80px', fontWeight: 'bold' }}>Title:</label>
          <input type="text" value={searchTitle} onChange={(e) => setSearchTitle(e.target.value)} placeholder="Enter book title" style={{ flex: 1, padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }} />
        </div>
        <div style={{ marginBottom: '15px', display: 'flex', alignItems: 'center' }}>
          <label style={{ width: '80px', fontWeight: 'bold' }}>Author:</label>
          <input type="text" value={searchAuthor} onChange={(e) => setSearchAuthor(e.target.value)} placeholder="Enter author name" style={{ flex: 1, padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }} />
        </div>
        <div style={{ marginBottom: '15px', display: 'flex', alignItems: 'center' }}>
          <label style={{ width: '80px', fontWeight: 'bold' }}>Keyword:</label>
          <input type="text" value={searchKeyword} onChange={(e) => setSearchKeyword(e.target.value)} placeholder="Enter keyword" style={{ flex: 1, padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }} />
        </div>
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
          <button onClick={handleSearch} disabled={loading} style={{ padding: '10px 24px', background: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
            {loading ? 'Searching...' : 'Search'}
          </button>
          <button onClick={handleReset} style={{ padding: '10px 24px', background: '#6c757d', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Reset</button>
        </div>
      </div>

      {searched && (
        <>
          <h2>Results ({books.length})</h2>
          {books.length === 0 ? (
            <p>No books found</p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
              {books.map((book) => (
                <div key={book.id} style={{ border: '1px solid #ddd', borderRadius: '8px', padding: '15px', background: 'white' }}>
                  <h3 style={{ marginTop: 0, color: '#007bff' }}>{book.title}</h3>
                  <p><strong>Author:</strong> {book.author}</p>
                  <p><strong>ISBN:</strong> {book.isbn}</p>
                  <p><strong>Genre:</strong> {book.genre}</p>
                  <p><strong>Location:</strong> {book.shelfLocation || 'N/A'}</p>
                  <p><strong>Status:</strong>
                    <span style={{ color: book.available && book.availableCopies > 0 ? '#28a745' : '#dc3545', fontWeight: 'bold' }}>
                      {book.available && book.availableCopies > 0 ? 'Available' : 'Borrowed'}
                    </span>
                  </p>
                  <p><strong>Stock:</strong> {book.availableCopies || 0} / {book.totalCopies || 1}</p>
                  {book.available && book.availableCopies > 0 && (
                    <button onClick={() => handleBorrow(book.id)} style={{ marginTop: '10px', padding: '6px 12px', background: '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                      Borrow
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default BookSearch;