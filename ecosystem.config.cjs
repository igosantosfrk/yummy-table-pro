module.exports = {
  apps: [{
    name: 'menu-maestro',
    script: 'npm',
    args: 'run dev -- --host 0.0.0.0 --port 8082',
    cwd: '/root/.openclaw/workspace/yummy-table-pro',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'development'
    },
    error_file: '/tmp/menu-maestro-error.log',
    out_file: '/tmp/menu-maestro-out.log'
  }]
};
