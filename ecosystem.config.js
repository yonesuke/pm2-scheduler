require('dotenv').config();

module.exports = {
  apps: [
    {
      name: 'n8n',
      script: 'n8n',
      args: 'start',
      autorestart: true,
      watch: false,
    },
    {
      name: 'radiko-recorder',
      script: 'uv',
      args: 'run record.py programs.json',
      cwd: __dirname + '/jobs/radiko-recorder',
      cron_restart: '0 * * * *', // 毎時0分
      autorestart: false,
      watch: false,
    },
    {
      name: 'podcast-server',
      script: 'node',
      args: 'server.js',
      cwd: __dirname + '/jobs/podcast-server',
      autorestart: true,
      watch: false,
      env: {
        PORT: 3456,
        HOST: process.env.PODCAST_HOST || 'http://localhost:3456',
      },
    },
    {
      name: 'arxiv-qfin',
      script: 'node',
      args: 'fetch.js',
      cwd: __dirname + '/jobs/arxiv-qfin',
      cron_restart: '0 9 * * *', // 毎日9時
      autorestart: false,
      watch: false,
    },
    {
      name: 'claude-code-ui',
      script: 'claude-code-ui',
      args: '--port 9000',
      autorestart: true,
      watch: false,
      env: {
        HOST: '0.0.0.0',
      },
    },
  ],
};
