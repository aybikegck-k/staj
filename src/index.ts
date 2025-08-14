// src/index.ts
// Bu dosya, Node.js HTTP sunucusunu kurar, veritabanı bağlantısını test eder ve gelen istekleri
// ilgili rota yöneticilerine (router) yönlendirir. Uygulamanın ana giriş noktasıdır.

import 'dotenv/config';
import http, { IncomingMessage, ServerResponse } from 'http'; 
import url from 'url'; 
import fs from 'fs/promises'; 
import path from 'path'; 
import pool from './config/db'; 
// Rota yöneticilerini (routers) içeri aktarma.
import * as authRouter from './routes/authRoutes';
import * as urlRouter from './routes/urlRoutes';
// AuthenticatedRequest tipini authMiddleware dosyasından içeri aktarıyoruz.
import { AuthenticatedRequest } from './middlewares/authMiddleware';
const PORT: number = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000; // Sunucunun çalışacağı port numarası
// Veritabanına bağlantıyı uygulama başlamadan önce test etme
(async () => {
    try {
        await pool.connect();
        console.log('PostgreSQL veritabanına başarıyla bağlandı.');
    } catch (err: unknown) { 
        console.error('Veritabanına bağlanılamadı:', (err as Error).stack);
        process.exit(1);
    }
})();
// HTTP Sunucusunu oluşturma
const server = http.createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const parsedUrl = url.parse(req.url || '', true); 
    let pathname: string = parsedUrl.pathname || '/'; 
    const method: string | undefined = req.method; 
if (pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'text/plain' }); 
    res.end('API Sunucusu Çalışıyor.'); 
    return; // En önemlisi, buradan sonra kodun devam etmemesini sağlar
}
    // Güvenlik ve tarayıcılar arası iletişim için gerekli başlıkları ayarlar.
    res.setHeader('Access-Control-Allow-Origin', '*'); // herkes erişebilir ama yalnızca get post options metodlarına
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS'); 
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization'); 

    // Tarayıcılar karmaşık isteklerden önce bu isteği gönderir.
    if (method === 'OPTIONS') {
        res.writeHead(204); 
        res.end();
        return;
    }
   
    // 1. Kimlik doğrulama rotalarını kontrol et (/api/register, /api/login)
    // authRouter.handleAuthRoutes fonksiyonunun AuthenticatedRequest tipinde bir req beklediğini varsayıyoruz.
    if (await authRouter.handleAuthRoutes(req as AuthenticatedRequest, res)) {
        return;
    }

    // 2. URL yönetimi rotalarını kontrol et (/api/shorten, /api/urls, /:shortCode)
    // urlRouter.handleUrlRoutes fonksiyonunun AuthenticatedRequest tipinde bir req beklediğini varsayıyoruz.
    if (await urlRouter.handleUrlRoutes(req as AuthenticatedRequest, res, PORT)) {
        return;
    }
    // Eğer hiçbir API rotası veya statik dosya bulunamazsa, 404 hatası döndürür.
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('404 Not Found: Aradiginiz sayfa veya kaynak bulunamadi.');
    return;
});

// Sunucuyu belirtilen portta başlatma
server.listen(PORT, () => {
    console.log(`Sunucu http://localhost:${PORT} adresinde calisiyor.`);
});
