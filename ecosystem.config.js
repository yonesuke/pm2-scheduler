module.exports = {
  apps: [
    {
      name: 'n8n',
      script: 'n8n',
      args: 'start',
      autorestart: true,
      watch: false,
    },
  ],
};
