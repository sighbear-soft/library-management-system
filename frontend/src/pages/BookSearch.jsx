import { useState } from 'react';
import './BookSearch.css';

function BookSearch() {
  const [searchTitle, setSearchTitle] = useState('');
  const [searchAuthor, setSearchAuthor] = useState('');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = async () => {
    setLoading(true);
    setSearched(true);
    
    try {
      const params = new URLSearchParams();
      if (searchTitle) params.append('title', searchTitle);
      if (searchAuthor) params.append('author', searchAuthor);
      if (searchKeyword) params.append('keyword', searchKeyword);
      
      // 修改这里：端口 3001，路径 /books/search
      const response = await fetch(`http://localhost:3001/books/search?${params}`);
      const result = await response.json();
      
      if (result.success) {
        setBooks(result.data);
      } else {
        setBooks([]);
        alert('搜索失败：' + result.error);
      }
    } catch (error) {
      console.error('搜索出错：', error);
      alert('无法连接到服务器，请确保后端已启动');
      setBooks([]);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setSearchTitle('');
    setSearchAuthor('');
    setSearchKeyword('');
    setBooks([]);
    setSearched(false);
  };

  return (
    <div className="book-search-container">
      <h1>图书检索系统</h1>
      
      <div className="search-form">
        <div className="search-row">
          <label>书名：</label>
          <input
            type="text"
            value={searchTitle}
            onChange={(e) => setSearchTitle(e.target.value)}
            placeholder="请输入书名"
          />
        </div>
        
        <div className="search-row">
          <label>作者：</label>
          <input
            type="text"
            value={searchAuthor}
            onChange={(e) => setSearchAuthor(e.target.value)}
            placeholder="请输入作者"
          />
        </div>
        
        <div className="search-row">
          <label>关键词：</label>
          <input
            type="text"
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            placeholder="请输入关键词（书名或作者）"
          />
        </div>
        
        <div className="search-buttons">
          <button onClick={handleSearch} disabled={loading}>
            {loading ? '搜索中...' : '搜索'}
          </button>
          <button onClick={handleReset}>重置</button>
        </div>
      </div>

      <div className="search-results">
        {searched && (
          <>
            <h2>搜索结果（共 {books.length} 条）</h2>
            {books.length === 0 ? (
              <p className="no-results">未找到相关图书</p>
            ) : (
              <div className="books-grid">
                {books.map((book) => (
                  <div key={book.id} className="book-card">
                    <h3>{book.title}</h3>
                    <p><strong>作者：</strong>{book.author}</p>
                    <p><strong>ISBN：</strong>{book.isbn}</p>
                    <p><strong>类型：</strong>{book.genre}</p>
                    <p><strong>语言：</strong>{book.language}</p>
                    <p><strong>书架位置：</strong>{book.shelfLocation || '未标注'}</p>
                    <p><strong>状态：</strong>
                      <span className={book.available && book.availableCopies > 0 ? 'available' : 'unavailable'}>
                        {book.available && book.availableCopies > 0 ? '可借阅' : '已借出'}
                      </span>
                    </p>
                    {book.description && <p><strong>简介：</strong>{book.description.substring(0, 100)}...</p>}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default BookSearch;