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

    // Bu kısım, API rotalarından ÖNCE ve senkron bir şekilde kontrol edilmelidir.

    // 'frontend' klasörüne giden yolu belirliyoruz.
    // process.cwd() komutu, Node.js sürecinin çalıştığı dizini (yani projenin kök dizinini) verir.
    // Bu, __dirname'in farklı ortamlarda veya derleme/çalıştırma araçlarıyla (ts-node-dev gibi)
    // farklı davranabilmesi durumunda daha güvenilir bir yoldur.
    const PUBLIC_DIR: string = path.join(process.cwd(), 'frontend');

    // Eğer tarayıcı sadece '/' (kök dizini) isterse, 'index.html'i varsay.
    const requestedPath: string = (pathname === '/') ? '/index.html' : pathname;
    const filePath: string = path.join(PUBLIC_DIR, requestedPath); // Dosyanın tam yolunu oluştur

    try {
        const stats = await fs.stat(filePath); // Dosyanın varlığını ve tipini kontrol et
        if (stats.isFile()) { // Eğer gerçekten bir dosya ise
            const data: Buffer = await fs.readFile(filePath); // fs.promises.readFile kullanıyoruz, Buffer döner

            // Dosya türüne göre Content-Type başlığını ayarla
            let contentType: string = 'text/html';
            if (filePath.endsWith('.css')) {
                contentType = 'text/css';
            } else if (filePath.endsWith('.js')) {
                contentType = 'application/javascript';
            } else if (filePath.endsWith('.png')) {
                contentType = 'image/png';
            } else if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) {
                contentType = 'image/jpeg';
            } else if (filePath.endsWith('.gif')) {
                contentType = 'image/gif';
            } else if (filePath.endsWith('.svg')) {
                contentType = 'image/svg+xml';
            } else if (filePath.endsWith('.ico')) {
                contentType = 'image/x-icon';
            } else if (filePath.endsWith('.json')) { // Eğer ileride bir JSON dosyası sunarsanız
                contentType = 'application/json';
            }
            // Diğer dosya türlerini buraya ekleyebilirsiniz

            res.writeHead(200, { 'Content-Type': contentType });
            res.end(data);
            return; // Statik dosya başarıyla gönderildi, DİĞER HİÇBİR KOD BLOĞUNA GİTME
        }
    } catch (err: unknown) { // Hata tipini 'unknown' olarak belirttik
        // Dosya bulunamadıysa (ENOENT hatası) veya başka bir hata varsa,
        // bu statik dosya isteği değildir, akışı API rotalarına bırak.
        const error = err as NodeJS.ErrnoException; // Hata objesini daha spesifik bir tipe dönüştürdük
        if (error.code !== 'ENOENT') { // ENOENT dışındaki hataları konsola yazdır
            console.error(`Statik dosya işleme hatası (${filePath}):`, error);
            // Ciddi bir hata ise 500 dönebiliriz, ancak şimdilik akışı API'ye bırakalım
        }
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
});

// Sunucuyu belirtilen portta başlatma
server.listen(PORT, () => {
    console.log(`Sunucu http://localhost:${PORT} adresinde calisiyor.`);
});
