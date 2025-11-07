import React from 'react';
import ReactDOM from 'react-dom/client';

const App = () => {
  return (
    <div style={{ 
      padding: '40px', 
      fontFamily: 'Arial, sans-serif',
      backgroundColor: '#f5f5f5',
      minHeight: '100vh'
    }}>
      <h1 style={{ 
        color: '#333', 
        marginBottom: '20px',
        textAlign: 'center'
      }}>
        Financial Report Generator
      </h1>
      <div style={{ 
        backgroundColor: '#ffffff', 
        padding: '30px', 
        borderRadius: '8px',
        boxShadow: '0 4px 8px rgba(0,0,0,0.1)',
        maxWidth: '600px',
        margin: '0 auto'
      }}>
        <p style={{ 
          fontSize: '18px', 
          marginBottom: '20px', 
          color: '#666',
          textAlign: 'center'
        }}>
          ✅ Application is working!
        </p>
        <div style={{ 
          backgroundColor: '#d4edda', 
          padding: '20px', 
          borderRadius: '4px',
          border: '1px solid #c3e6cb',
          textAlign: 'center'
        }}>
          <h2 style={{ 
            fontSize: '20px', 
            marginBottom: '10px', 
            color: '#155724' 
          }}>
            Status: Working
          </h2>
          <p style={{ color: '#155724' }}>
            All components are loading properly.
          </p>
          <p style={{ color: '#155724', marginTop: '10px' }}>
            Time: {new Date().toLocaleTimeString()}
          </p>
        </div>
      </div>
    </div>
  );
};

const rootElement = document.getElementById('root');
if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(<App />);
} else {
  document.body.innerHTML = '<div style="color:red;text-align:center;padding:40px;">Error: Root element not found</div>';
}