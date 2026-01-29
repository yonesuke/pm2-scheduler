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
  ],
};
