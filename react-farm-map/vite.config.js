import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// API giả lập GET/POST /api/zones (chỉ chạy khi `npm run dev`, dữ liệu lưu trong RAM).
// Khi nối backend thật: xóa plugin này và đặt VITE_API_URL trong file .env
function mockZonesApi() {
  const zones = JSON.parse(readFileSync(new URL('./mock/zones.json', import.meta.url), 'utf-8'));
  return {
    name: 'mock-zones-api',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/api/zones', (req, res) => {
        const send = (status, body) => {
          res.statusCode = status;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(body));
        };
        if (req.method === 'GET') return send(200, zones);
        if (req.method === 'POST') {
          let raw = '';
          req.on('data', (chunk) => (raw += chunk));
          req.on('end', () => {
            try {
              const zone = { id: Date.now(), ...JSON.parse(raw) };
              zones.push(zone);
              send(201, zone);
            } catch {
              send(400, { message: 'JSON không hợp lệ' });
            }
          });
          return;
        }
        send(405, { message: 'Method not allowed' });
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), mockZonesApi()],
});
