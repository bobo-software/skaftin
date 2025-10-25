import { useEffect } from 'react';
import { useAppStore } from './store/useAppStore';
import HomePage from './pages/HomePage';
import './index.css';

function App() {
  const { theme, setTheme } = useAppStore();

  useEffect(() => {
    // Initialize theme
    const savedTheme = localStorage.getItem('skaftin-theme') as 'light' | 'dark' | null;
    if (savedTheme) {
      setTheme(savedTheme);
    } else {
      // Default to light theme
      setTheme('light');
    }
  }, [setTheme]);

  useEffect(() => {
    // Apply theme to document
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  return (
    <div className="min-h-screen bg-white dark:bg-dark-900 transition-colors duration-300">
      <HomePage />
    </div>
  );
}

export default App;