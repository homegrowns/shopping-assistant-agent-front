import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import MaintenanceScreen from './components/MaintenanceScreen.jsx';
import './styles.css';

// 점검 종료 후 isMaintenanceMode=false로 설정하면 기존 앱이 노출됩니다.
const isMaintenanceMode = true;

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {isMaintenanceMode ? <MaintenanceScreen /> : <App />}
  </StrictMode>,
);
