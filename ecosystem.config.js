// PM2: pm2 start ecosystem.config.js
// FORK rejimi, bitta nusxa — login urinishlari cheklovi (src/lib/rateLimit.ts) xotirada.
// -H 127.0.0.1 MAJBURIY: aks holda port Nginx'ni chetlab tashqariga ochiladi.
module.exports = {
  apps: [
    {
      name: "hisob",
      cwd: __dirname,
      script: "/root/.nvm/versions/node/v22.23.1/bin/npm",
      args: "start -- -H 127.0.0.1 -p 3216",
      interpreter: "/root/.nvm/versions/node/v22.23.1/bin/node",
      exec_mode: "fork",
      instances: 1,
      max_memory_restart: "400M",
      env: {
        NODE_ENV: "production",
        PATH: "/root/.nvm/versions/node/v22.23.1/bin:" + process.env.PATH,
      },
    },
    // 4-bosqich: Telegram bot (aiogram) shu yerga ikkinchi jarayon bo'lib qo'shiladi.
  ],
};
