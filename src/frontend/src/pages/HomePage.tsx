import { useState } from 'react';
import { 
  Database, 
  Cloud, 
  Zap, 
  Shield, 
  Code, 
  Rocket,
  Github,
  Twitter,
  ArrowRight,
  Play,
  Star,
  Users,
} from 'lucide-react';
import { useAppStore } from '../stores/StoresIndex';

interface HomePageProps {
  onGetStarted?: () => void;
}

const HomePage = ({ onGetStarted }: HomePageProps) => {
  const { theme, setTheme } = useAppStore();
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);

  const features = [
    {
      icon: <Database className="w-8 h-8" />,
      title: "Database Management",
      description: "PostgreSQL with schema-per-project isolation. Full CRUD operations, migrations, and TypeScript generation.",
      color: "from-blue-500 to-cyan-500"
    },
    {
      icon: <Cloud className="w-8 h-8" />,
      title: "File Storage",
      description: "MinIO S3-compatible storage with bucket-per-project. Upload, download, and manage files seamlessly.",
      color: "from-purple-500 to-pink-500"
    },
    {
      icon: <Zap className="w-8 h-8" />,
      title: "Real-time Events",
      description: "Socket.io powered real-time updates. Live data synchronization across all connected clients.",
      color: "from-yellow-500 to-orange-500"
    },
    {
      icon: <Shield className="w-8 h-8" />,
      title: "Secure & Isolated",
      description: "JWT authentication with project-level isolation. Each project gets its own schema and storage.",
      color: "from-green-500 to-emerald-500"
    },
    {
      icon: <Code className="w-8 h-8" />,
      title: "MCP Integration",
      description: "AI-powered development with Model Context Protocol. 26+ tools for database and storage operations.",
      color: "from-indigo-500 to-purple-500"
    },
    {
      icon: <Rocket className="w-8 h-8" />,
      title: "Self-Hosted",
      description: "Deploy anywhere with Docker. Full control over your data and infrastructure. No vendor lock-in.",
      color: "from-red-500 to-rose-500"
    }
  ];

  const stats = [
    { label: "Projects Created", value: "1,000+", icon: <Rocket className="w-5 h-5" /> },
    { label: "Files Stored", value: "10M+", icon: <Cloud className="w-5 h-5" /> },
    { label: "Database Queries", value: "100M+", icon: <Database className="w-5 h-5" /> },
    { label: "Active Users", value: "5,000+", icon: <Users className="w-5 h-5" /> }
  ];

  return (
    <div className="min-h-screen">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-white/80 dark:bg-dark-900/80 backdrop-blur-md border-b border-dark-200 dark:border-dark-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-primary-600 rounded-lg flex items-center justify-center">
                <Database className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold text-dark-900 dark:text-white">Skaftin</span>
            </div>
            
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
                className="p-2 rounded-lg bg-dark-100 dark:bg-dark-800 hover:bg-dark-200 dark:hover:bg-dark-700 transition-colors"
              >
                {theme === 'light' ? '🌙' : '☀️'}
              </button>
              <button className="btn-primary">
                Get Started
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-20 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center">
            <div className="inline-flex items-center px-4 py-2 rounded-full bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 text-sm font-medium mb-8">
              <Star className="w-4 h-4 mr-2" />
              Supabase/Appwrite Alternative
            </div>
            
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-dark-900 dark:text-white mb-6">
              Build Apps with
              <span className="text-gradient block mt-2">Skaftin Platform</span>
            </h1>
            
            <p className="text-xl text-dark-600 dark:text-dark-300 max-w-3xl mx-auto mb-8 text-balance">
              Self-hosted backend-as-a-service with PostgreSQL, MinIO storage, real-time events, 
              and AI-powered development tools. Deploy anywhere, own your data.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12">
              <button 
                onClick={onGetStarted}
                className="btn-primary text-lg px-8 py-4"
              >
                Start Building
                <ArrowRight className="w-5 h-5 ml-2" />
              </button>
              <button 
                className="btn-secondary text-lg px-8 py-4"
                onClick={() => setIsVideoPlaying(!isVideoPlaying)}
              >
                <Play className="w-5 h-5 mr-2" />
                Watch Demo
              </button>
            </div>
            
            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 max-w-4xl mx-auto">
              {stats.map((stat, index) => (
                <div key={index} className="text-center">
                  <div className="flex items-center justify-center w-12 h-12 bg-primary-100 dark:bg-primary-900/20 rounded-lg mx-auto mb-3">
                    {stat.icon}
                  </div>
                  <div className="text-2xl font-bold text-dark-900 dark:text-white">{stat.value}</div>
                  <div className="text-sm text-dark-600 dark:text-dark-400">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-dark-50 dark:bg-dark-800/50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-dark-900 dark:text-white mb-4">
              Everything you need to build modern apps
            </h2>
            <p className="text-xl text-dark-600 dark:text-dark-300 max-w-2xl mx-auto">
              From database management to file storage, real-time events to AI integration - 
              Skaftin provides all the tools you need.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <div key={index} className="card hover:shadow-xl transition-all duration-300 group">
                <div className={`w-16 h-16 bg-gradient-to-br ${feature.color} rounded-xl flex items-center justify-center text-white mb-6 group-hover:scale-110 transition-transform duration-300`}>
                  {feature.icon}
                </div>
                <h3 className="text-xl font-semibold text-dark-900 dark:text-white mb-3">
                  {feature.title}
                </h3>
                <p className="text-dark-600 dark:text-dark-300 leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl font-bold text-dark-900 dark:text-white mb-6">
            Ready to build something amazing?
          </h2>
          <p className="text-xl text-dark-600 dark:text-dark-300 mb-8">
            Join thousands of developers building with Skaftin Platform.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button className="btn-primary text-lg px-8 py-4">
              Get Started Free
              <ArrowRight className="w-5 h-5 ml-2" />
            </button>
            <button className="btn-secondary text-lg px-8 py-4">
              <Github className="w-5 h-5 mr-2" />
              View on GitHub
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-dark-900 text-white py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-primary-600 rounded-lg flex items-center justify-center">
                  <Database className="w-5 h-5 text-white" />
                </div>
                <span className="text-xl font-bold">Skaftin</span>
              </div>
              <p className="text-dark-400 mb-4">
                Self-hosted backend-as-a-service for modern applications.
              </p>
              <div className="flex space-x-4">
                <a href="#" className="text-dark-400 hover:text-white transition-colors">
                  <Twitter className="w-5 h-5" />
                </a>
                <a href="#" className="text-dark-400 hover:text-white transition-colors">
                  <Github className="w-5 h-5" />
                </a>
              </div>
            </div>
            
            <div>
              <h3 className="font-semibold mb-4">Product</h3>
              <ul className="space-y-2 text-dark-400">
                <li><a href="#" className="hover:text-white transition-colors">Features</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Pricing</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Documentation</a></li>
              </ul>
            </div>
            
            <div>
              <h3 className="font-semibold mb-4">Community</h3>
              <ul className="space-y-2 text-dark-400">
                <li><a href="#" className="hover:text-white transition-colors">Discord</a></li>
                <li><a href="#" className="hover:text-white transition-colors">GitHub</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Blog</a></li>
              </ul>
            </div>
            
            <div>
              <h3 className="font-semibold mb-4">Company</h3>
              <ul className="space-y-2 text-dark-400">
                <li><a href="#" className="hover:text-white transition-colors">About</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Contact</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Privacy</a></li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-dark-800 mt-8 pt-8 text-center text-dark-400">
            <p>&copy; 2025 Skaftin Platform. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default HomePage;
