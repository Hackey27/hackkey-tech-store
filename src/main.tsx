import React, { Suspense, lazy } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

const AdminPortal = lazy(() => import('./admin/AdminPortal'));
const isAdminRoute = window.location.pathname === '/admin' || window.location.pathname.startsWith('/admin/');

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {isAdminRoute ? (
      <Suspense fallback={<div className="min-h-screen bg-[#f7faf9] p-8 text-[#014040]">Loading admin portal…</div>}>
        <AdminPortal />
      </Suspense>
    ) : (
      <App />
    )}
  </React.StrictMode>
);
