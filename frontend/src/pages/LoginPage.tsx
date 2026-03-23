import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '../stores/StoresIndex';
import { signIn, signUp, redirectToThirdPartyLogin } from '../config/supertokens';
import {
  bootstrapAuth,
  resolvePostLoginRedirect,
  storeLoginRedirect,
} from '../services/AuthFlowService';
import skaftinLogo from '../assets/skaftinLogo.png';

// Google icon SVG component
const GoogleIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24">
    <path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <path
      fill="#FBBC05"
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
    />
    <path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
    />
  </svg>
);

// GitHub icon SVG component
const GitHubIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/>
  </svg>
);

// --- Particle background ---
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

// Orb blobs for depth
const BackgroundOrbs = () => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none">
    <motion.div
      className="absolute w-[500px] h-[500px] rounded-full opacity-20 dark:opacity-10"
      style={{
        background: 'radial-gradient(circle, var(--color-primary-400, #60a5fa) 0%, transparent 70%)',
        top: '-15%',
        left: '-10%',
      }}
      animate={{
        scale: [1, 1.12, 1],
        x: [0, 30, 0],
        y: [0, 20, 0],
      }}
      transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
    />
    <motion.div
      className="absolute w-[400px] h-[400px] rounded-full opacity-15 dark:opacity-10"
      style={{
        background: 'radial-gradient(circle, var(--color-primary-300, #93c5fd) 0%, transparent 70%)',
        bottom: '-10%',
        right: '-8%',
      }}
      animate={{
        scale: [1, 1.18, 1],
        x: [0, -25, 0],
        y: [0, -30, 0],
      }}
      transition={{ duration: 17, repeat: Infinity, ease: 'easeInOut', delay: 3 }}
    />
    <motion.div
      className="absolute w-[250px] h-[250px] rounded-full opacity-10 dark:opacity-8"
      style={{
        background: 'radial-gradient(circle, var(--color-primary-500, #3b82f6) 0%, transparent 70%)',
        top: '45%',
        right: '15%',
      }}
      animate={{
        scale: [1, 1.25, 1],
        x: [0, 15, 0],
        y: [0, 25, 0],
      }}
      transition={{ duration: 11, repeat: Infinity, ease: 'easeInOut', delay: 7 }}
    />
  </div>
);


const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.09 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' as const } },
};

const LoginPage = () => {
  const { setUser, setLoading, isLoading } = useAppStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [error, setError] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const redirect = params.get('redirect');
    storeLoginRedirect(redirect);
  }, [location.search]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!isLogin && formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    try {
      const response = isLogin
        ? await signIn({ formFields: [
            { id: 'email', value: formData.email },
            { id: 'password', value: formData.password }
          ]})
        : await signUp({ formFields: [
            { id: 'email', value: formData.email },
            { id: 'password', value: formData.password }
          ]});

      if (response.status === 'OK') {
        const bootstrap = await bootstrapAuth({ preloadOrganizations: true, force: true });
        setUser(bootstrap.user);
        const redirectTo = await resolvePostLoginRedirect((location.state as any)?.redirectTo);
        navigate(redirectTo);
      } else if (response.status === 'FIELD_ERROR') {
        const fieldError = response.formFields?.find((f: any) => f.error);
        setError(fieldError?.error || 'Invalid input');
      } else if (response.status === 'WRONG_CREDENTIALS_ERROR') {
        setError('Invalid email or password');
      } else if (response.status === 'SIGN_UP_NOT_ALLOWED') {
        setError('An account with this email already exists');
      } else {
        setError('An error occurred. Please try again.');
      }
    } catch (error) {
      setError('Network error. Please try again.');
      console.error('Auth error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 dark:from-dark-900 dark:to-dark-800 flex items-center justify-center p-4 overflow-hidden">
      {/* Animated background layers */}
      <BackgroundOrbs />
      <ParticleField />

      {/* Content */}
      <motion.div
        className="relative z-10 w-full max-w-md"
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
      >
        {/* Logo */}
        <motion.div className="text-center mb-8" variants={fadeUp}>
          <motion.img
            src={skaftinLogo}
            alt="Skaftin logo"
            className="w-16 h-16 mx-auto mb-4 rounded-2xl object-contain"
            initial={{ opacity: 0, scale: 0.6, rotate: -10 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            transition={{ duration: 0.7, ease: 'easeOut' as const }}
            whileHover={{ scale: 1.08, rotate: 3 }}
          />
          <motion.h1
            className="text-3xl font-bold text-dark-900 dark:text-white mb-2"
            variants={fadeUp}
          >
            Welcome to Skaftin
          </motion.h1>
          <AnimatePresence mode="wait">
            <motion.p
              key={isLogin ? 'signin' : 'signup'}
              className="text-dark-600 dark:text-dark-300"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
            >
              {isLogin ? 'Sign in to your account' : 'Create your account'}
            </motion.p>
          </AnimatePresence>
        </motion.div>

        {/* Form card */}
        <motion.div
          className="bg-white/80 dark:bg-dark-800/80 backdrop-blur-md rounded-2xl shadow-xl p-8 border border-white/40 dark:border-dark-700/40"
          variants={fadeUp}
        >
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Email */}
            <motion.div variants={fadeUp}>
              <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-2">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-dark-400" />
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  className="w-full pl-10 pr-4 py-3 border border-dark-200 dark:border-dark-700 rounded-lg bg-white dark:bg-dark-700 text-dark-900 dark:text-white placeholder-dark-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                  placeholder="Enter your email"
                  required
                />
              </div>
            </motion.div>

            {/* Password */}
            <motion.div variants={fadeUp}>
              <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-dark-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  className="w-full pl-10 pr-12 py-3 border border-dark-200 dark:border-dark-700 rounded-lg bg-white dark:bg-dark-700 text-dark-900 dark:text-white placeholder-dark-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                  placeholder="Enter your password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-dark-400 hover:text-dark-600 dark:hover:text-dark-300"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {isLogin && (
                <div className="flex justify-end mt-1">
                  <Link
                    to="/forgot-password"
                    className="text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 transition-colors"
                  >
                    Forgot Password?
                  </Link>
                </div>
              )}
            </motion.div>

            {/* Confirm Password (Register only) */}
            <AnimatePresence>
              {!isLogin && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3, ease: 'easeOut' as const }}
                  style={{ overflow: 'hidden' }}
                >
                  <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-2">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-dark-400" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      name="confirmPassword"
                      value={formData.confirmPassword}
                      onChange={handleInputChange}
                      className="w-full pl-10 pr-4 py-3 border border-dark-200 dark:border-dark-700 rounded-lg bg-white dark:bg-dark-700 text-dark-900 dark:text-white placeholder-dark-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                      placeholder="Confirm your password"
                      required
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Error Message */}
            <AnimatePresence>
              {error && (
                <motion.div
                  className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3"
                  initial={{ opacity: 0, scale: 0.95, y: -6 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -6 }}
                  transition={{ duration: 0.2 }}
                >
                  <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Submit Button */}
            <motion.div variants={fadeUp}>
              <motion.button
                type="submit"
                disabled={isLoading}
                className="w-full btn-primary text-lg py-3 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                whileHover={!isLoading ? { scale: 1.02 } : {}}
                whileTap={!isLoading ? { scale: 0.98 } : {}}
                transition={{ type: 'spring', stiffness: 400, damping: 20 }}
              >
                {isLoading ? (
                  <>
                    <motion.span
                      className="mr-2 inline-block"
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    >
                      ⏳
                    </motion.span>
                    {isLogin ? 'Signing in...' : 'Creating account...'}
                  </>
                ) : (
                  <>
                    <AnimatePresence mode="wait">
                      <motion.span
                        key={isLogin ? 'signin-label' : 'signup-label'}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 10 }}
                        transition={{ duration: 0.2 }}
                      >
                        {isLogin ? 'Sign In' : 'Create Account'}
                      </motion.span>
                    </AnimatePresence>
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </>
                )}
              </motion.button>
            </motion.div>
          </form>

          {/* Divider */}
          <motion.div className="relative my-6" variants={fadeUp}>
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-dark-200 dark:border-dark-700"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-white/80 dark:bg-dark-800/80 text-dark-500 dark:text-dark-400">
                Or continue with
              </span>
            </div>
          </motion.div>

          {/* OAuth Buttons */}
          <motion.div className="space-y-3" variants={fadeUp}>
            <motion.button
              type="button"
              onClick={async () => {
                try {
                  await redirectToThirdPartyLogin({ thirdPartyId: 'google' });
                } catch (err) {
                  console.error('Google login error:', err);
                  setError('Failed to initiate Google login');
                }
              }}
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-dark-200 dark:border-dark-700 rounded-lg bg-white dark:bg-dark-700 hover:bg-dark-50 dark:hover:bg-dark-600 text-dark-700 dark:text-dark-200 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              whileHover={!isLoading ? { scale: 1.015, y: -1 } : {}}
              whileTap={!isLoading ? { scale: 0.985 } : {}}
              transition={{ type: 'spring', stiffness: 400, damping: 20 }}
            >
              <GoogleIcon />
              Continue with Google
            </motion.button>

            <motion.button
              type="button"
              onClick={async () => {
                try {
                  await redirectToThirdPartyLogin({ thirdPartyId: 'github' });
                } catch (err) {
                  console.error('GitHub login error:', err);
                  setError('Failed to initiate GitHub login');
                }
              }}
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-dark-200 dark:border-dark-700 rounded-lg bg-dark-900 dark:bg-dark-900 hover:bg-dark-800 dark:hover:bg-dark-800 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              whileHover={!isLoading ? { scale: 1.015, y: -1 } : {}}
              whileTap={!isLoading ? { scale: 0.985 } : {}}
              transition={{ type: 'spring', stiffness: 400, damping: 20 }}
            >
              <GitHubIcon />
              Continue with GitHub
            </motion.button>
          </motion.div>

          {/* Toggle Login/Register */}
          <motion.div className="mt-6 text-center" variants={fadeUp}>
            <p className="text-dark-600 dark:text-dark-300">
              {isLogin ? "Don't have an account?" : "Already have an account?"}
            </p>
            <motion.button
              onClick={() => {
                setIsLogin(!isLogin);
                setError('');
                setFormData({ email: '', password: '', confirmPassword: '' });
              }}
              className="text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-medium transition-colors"
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.97 }}
            >
              {isLogin ? 'Create an account' : 'Sign in instead'}
            </motion.button>
          </motion.div>
        </motion.div>

        {/* Footer */}
        <motion.div className="text-center mt-8" variants={fadeUp}>
          <p className="text-dark-500 dark:text-dark-400 text-sm">
            By continuing, you agree to our Terms of Service and Privacy Policy
          </p>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default LoginPage;
