module.exports = {
  apps: [{
    name: 'exabyte-web',
    cwd: __dirname,
    script: 'server.js',
    instances: 1,
    exec_mode: 'fork',
    autorestart: true,
    max_memory_restart: '500M',
    env: {
      NODE_ENV: 'production',
      PORT: process.env.PORT || 60010
    }
  }]
};
