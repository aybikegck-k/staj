// src/index.ts
// Bu dosya, Node.js HTTP sunucusunu kurar, veritabanı bağlantısını test eder ve gelen istekleri
// ilgili rota yöneticilerine (router) yönlendirir. Uygulamanın ana giriş noktasıdır.



import 'dotenv/config'; // .env dosyasındaki ortam değişkenlerini yükler (ESM uyumlu)
import http, { IncomingMessage, ServerResponse } from 'http'; // http modülünü ve tip tanımlarını içeri aktar
import url from 'url'; // url modülünü içeri aktar
import fs from 'fs/promises'; // fs.promises modülünü içeri aktar (async/await için)
import path from 'path'; // path modülünü içeri aktar
import pool from './config/db'; // Veritabanı bağlantı havuzu (daha önce oluşturduğumuz db.ts'den)

// Rota yöneticilerini (routers) içeri aktarma.
// Bu modüller, gelen istekleri belirli API rotalarına göre gruplar.
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
    } catch (err: unknown) { // Hata tipini 'unknown' olarak belirttik
        // Hata objesini 'Error' tipine dönüştürerek mesajına erişiyoruz.
        console.error('Veritabanına bağlanılamadı:', (err as Error).stack);
        // Hata durumunda uygulamayı sonlandır, çünkü veritabanı olmadan çalışamaz
        process.exit(1);
    }
})();

// HTTP Sunucusunu oluşturma
const server = http.createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const parsedUrl = url.parse(req.url || '', true); // req.url null olabileceği için boş string varsayımı
    let pathname: string = parsedUrl.pathname || '/'; // pathname null olabileceği için '/' varsayımı
    const method: string | undefined = req.method; // method undefined olabileceği için tipini belirttik
// Bu kısmı komple değiştirin
if (pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'text/plain' }); // İçerik tipini düzeltiyoruz
    res.end('API Sunucusu Çalışıyor.'); // Daha açıklayıcı bir mesaj
    return; // En önemlisi, buradan sonra kodun devam etmemesini sağlar
}
    // Güvenlik ve tarayıcılar arası iletişim için gerekli başlıkları ayarlar.
    res.setHeader('Access-Control-Allow-Origin', '*'); // Tüm kaynaklardan gelen isteklere izin ver (geliştirme için)
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS'); // İzin verilen HTTP metotları
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization'); // İzin verilen başlıklar

    // Tarayıcılar karmaşık isteklerden önce bu isteği gönderir.
    if (method === 'OPTIONS') {
        res.writeHead(204); // 204 No Content
        res.end();
        return;
    }

    // --- Rota Yönlendirme Mantığı ---
    // Gelen isteği sırasıyla rota yöneticilerine gönderir.
    // Eğer bir rota yöneticisi isteği işlerse, `true` döndürür ve işlem durur.

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

    // --- 404 (Bulunamadı) Hatası ---
    // Eğer hiçbir API rotası veya statik dosya bulunamazsa, 404 hatası döndürür.
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('404 Not Found: Aradiginiz sayfa veya kaynak bulunamadi.');
    return;
});

// Sunucuyu belirtilen portta başlatma
server.listen(PORT, () => {
    console.log(`Sunucu http://localhost:${PORT} adresinde calisiyor.`);
});
