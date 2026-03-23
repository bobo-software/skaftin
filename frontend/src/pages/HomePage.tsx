import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
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
import { AppButton } from '@/components/ComponentsIndex';
import skaftinLogo from '../assets/skaftinLogo.png';

interface Particle {
  id: number;
  x: number;
  y: number;
  size: number;
  duration: number;
  delay: number;
  driftX: number;
  driftY: number;
  opacity: number;
}

const ParticleField = () => {
  const particles: Particle[] = useMemo(() => {
    return Array.from({ length: 55 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 3.5 + 1.5,
      duration: Math.random() * 18 + 12,
      delay: Math.random() * -20,
      driftX: (Math.random() - 0.5) * 140,
      driftY: (Math.random() - 0.5) * 140,
      opacity: Math.random() * 0.45 + 0.1,
    }));
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute rounded-full bg-primary-400 dark:bg-primary-500"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size,
            opacity: p.opacity,
          }}
          animate={{
            x: [0, p.driftX, p.driftX * 0.4, 0],
            y: [0, p.driftY * 0.6, p.driftY, 0],
            opacity: [p.opacity, p.opacity * 1.6, p.opacity * 0.4, p.opacity],
            scale: [1, 1.4, 0.8, 1],
          }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  );
};

const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: 'easeOut' as const },
  },
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.12, delayChildren: 0.08 },
  },
};

const HomePage = () => {
  const navigate = useNavigate();
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

  return (
    <div className="min-h-screen ring">
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <ParticleField />
        <motion.div
          className="absolute -top-24 -left-16 h-72 w-72 rounded-full bg-primary-400/20 blur-3xl"
          animate={{ x: [0, 20, -10, 0], y: [0, 16, -12, 0], scale: [1, 1.08, 0.95, 1] }}
          transition={{ duration: 13, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute top-32 right-0 h-80 w-80 rounded-full bg-cyan-400/20 blur-3xl"
          animate={{ x: [0, -28, 14, 0], y: [0, 12, -16, 0], scale: [1, 0.94, 1.07, 1] }}
          transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

      {/* Navigation */}
      <motion.nav
        className="fixed top-0 w-full z-50 bg-white/80 dark:bg-dark-900/80 backdrop-blur-md border-b border-dark-200 dark:border-dark-700"
        initial={{ y: -24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.45, ease: 'easeOut' }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-2">
              <motion.img
                src={skaftinLogo}
                alt="Skaftin logo"
                className="w-8 h-8 rounded-lg object-contain"
                whileHover={{ rotate: -6, scale: 1.08 }}
                transition={{ type: 'spring', stiffness: 300, damping: 16 }}
              />
              <span className="text-xl font-bold text-dark-900 dark:text-white">Skaftin</span>
            </div>

            <div className="flex items-center space-x-4">
              <button
                onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
                className="p-2 rounded-lg bg-dark-100 dark:bg-dark-800 hover:bg-dark-200 dark:hover:bg-dark-700 transition-colors"
              >
                {theme === 'light' ? '🌙' : '☀️'}
              </button>
              <button
                onClick={() => navigate('/login')}
                className="btn-primary"
              >
                Get Started
              </button>
            </div>
          </div>
        </div>
      </motion.nav>

      {/* Hero Section */}
      <section className="pt-20 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <motion.div
            className="text-center"
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
          >
            <motion.h1 variants={fadeUp} className="text-5xl sm:text-6xl lg:text-7xl font-bold text-dark-900 dark:text-white mb-6">
              Build Apps with
              <motion.span
                className="text-gradient block mt-2"
                animate={{ backgroundPositionX: ['0%', '100%', '0%'] }}
                transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
                style={{ backgroundSize: '200% 100%' }}
              >
                Skaftin Platform
              </motion.span>
            </motion.h1>

            <motion.p variants={fadeUp} className="text-xl text-dark-600 dark:text-dark-300 max-w-3xl mx-auto mb-8 text-balance">
              Self-hosted backend-as-a-service with PostgreSQL, MinIO storage, real-time events,
              and AI-powered development tools. Deploy anywhere, own your data.
            </motion.p>

            <motion.div variants={fadeUp} className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12">
              <AppButton
                onClick={() => navigate('/login')}
                variant="primary"
                size="lg"
              >
                Start Building
                <ArrowRight className="w-5 h-5 ml-2" />
              </AppButton>

              <AppButton
                onClick={() => setIsVideoPlaying(!isVideoPlaying)}
                variant="secondary"
                size="lg"
              >
                <Play className="w-5 h-5 mr-2" />
                Watch Demo
              </AppButton>
            </motion.div>

            {/* Stats */}
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-dark-50 dark:bg-dark-800/50">
        <div className="max-w-7xl mx-auto">
          <motion.div
            className="text-center mb-16"
            initial={{ opacity: 0, y: 28 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.55, ease: 'easeOut' }}
          >
            <h2 className="text-4xl font-bold text-dark-900 dark:text-white mb-4">
              Everything you need to build modern apps
            </h2>
            <p className="text-xl text-dark-600 dark:text-dark-300 max-w-2xl mx-auto">
              From database management to file storage, real-time events to AI integration -
              Skaftin provides all the tools you need.
            </p>
          </motion.div>

          <motion.div
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.15 }}
          >
            {features.map((feature, index) => (
              <motion.div
                key={index}
                variants={fadeUp}
                whileHover={{ y: -8, transition: { duration: 0.2 } }}
                className="card hover:shadow-xl transition-all duration-300 group"
              >
                <motion.div
                  whileHover={{ scale: 1.08, rotate: -2 }}
                  transition={{ type: 'spring', stiffness: 260, damping: 16 }}
                  className={`w-16 h-16 bg-gradient-to-br ${feature.color} rounded-xl flex items-center justify-center text-white mb-6 group-hover:scale-110 transition-transform duration-300`}
                >
                  {feature.icon}
                </motion.div>
                <h3 className="text-xl font-semibold text-dark-900 dark:text-white mb-3">
                  {feature.title}
                </h3>
                <p className="text-dark-600 dark:text-dark-300 leading-relaxed">
                  {feature.description}
                </p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <motion.div
          className="max-w-4xl mx-auto text-center"
          initial={{ opacity: 0, y: 28 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.55, ease: 'easeOut' }}
        >
          <h2 className="text-4xl font-bold text-dark-900 dark:text-white mb-6">
            Ready to build something amazing?
          </h2>
          <motion.div
            className="flex flex-col sm:flex-row gap-4 justify-center"
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.5 }}
          >
            <AppButton onClick={() => navigate('/login')}
              variant="primary"
              size="lg"
            >
              Get Started Free
              <ArrowRight className="w-5 h-5 ml-2" />
            </AppButton>
            <AppButton onClick={() => window.open('https://github.com/sklftn/sklftn', '_blank')}
              variant="secondary"
              size="lg"
            >
              <Github className="w-5 h-5 mr-2" />
              View on GitHub
            </AppButton>
          </motion.div>
        </motion.div>
      </section>

      {/* Footer */}
      <motion.footer
        className="bg-dark-900 text-white py-12 px-4 sm:px-6 lg:px-8"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      >
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <img src={skaftinLogo} alt="Skaftin logo" className="w-8 h-8 rounded-lg object-contain" />
                <span className="text-xl font-bold">Skaftin</span>
              </div>
              <p className="text-dark-400 mb-4">
                Self-hosted backend-as-a-service for modern applications.
              </p>
              <motion.div className="flex space-x-4" variants={staggerContainer} initial="hidden" whileInView="visible" viewport={{ once: true }}>
                <motion.a href="#" variants={fadeUp} className="text-dark-400 hover:text-white transition-colors">
                  <Twitter className="w-5 h-5" />
                </motion.a>
                <motion.a href="#" variants={fadeUp} className="text-dark-400 hover:text-white transition-colors">
                  <Github className="w-5 h-5" />
                </motion.a>
              </motion.div>
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
      </motion.footer>
    </div>
  );
};

export default HomePage;
