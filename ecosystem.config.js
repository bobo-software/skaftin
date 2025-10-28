module.exports = {
  apps: [
    {
      name: 'backend',
      script: 'dist/Server.js',
      env: {
        NODE_ENV: 'production',
        PORT: 4005
      },
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '1G',
      error_file: '/app/logs/backend-error.log',
      out_file: '/app/logs/backend-out.log',
      log_file: '/app/logs/backend-combined.log',
      time: true
    },
    {
      name: 'frontend',
      cwd: 'src/frontend',
      script: 'npm',
      args: 'run preview -- --port 3005 --host 0.0.0.0',
      env: {
        NODE_ENV: 'production'
      },
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '512M',
      error_file: '/app/logs/frontend-error.log',
      out_file: '/app/logs/frontend-out.log',
      log_file: '/app/logs/frontend-combined.log',
      time: true
    }
  ]
};
