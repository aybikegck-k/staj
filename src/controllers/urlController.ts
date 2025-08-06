// src/controllers/urlController.ts
// Bu dosya, URL kısaltma ve yönlendirme ile ilgili tüm iş mantığını içerir.
// Index.ts dosyasının daha düzenli ve sadece yönlendirme odaklı kalmasını sağlar.

// Gerekli modülleri ES6 'import' sözdizimi ile içeri aktarıyoruz.
import { IncomingMessage, ServerResponse } from 'http'; // HTTP istek ve yanıt objeleri için tip tanımlaması eklendi
import { PoolClient } from 'pg'; // PostgreSQL bağlantı istemcisi için tip tanımlaması
import pool from '../config/db'; // Veritabanı bağlantı havuzumuzu içeri aktarıyoruz
import { generateShortCode, isValidUrl } from '../utils/helpers'; // Yardımcı fonksiyonlarımızı içeri aktarıyoruz
import { AuthenticatedRequest } from '../middlewares/authMiddleware'; // req objesi için özel tip tanımı

// Gelen istek body'sinin tipini tanımlıyoruz.
interface ShortenRequestBody {
    longUrl: string;
}

// Veritabanından dönen URL satırları için tip tanımlaması yapıyoruz.
// Bu, 'any' tipini kullanmaktan kaçınmamızı sağlar.
interface UrlRow {
    id?: number; // ID, sorgu sonucunda dönebilir
    original_url: string;
    short_code: string;
    click_count: number;
    created_at: Date;
    user_id?: number | null; // user_id, anonim linkler için null olabilir
    ip_address?: string; // IP adresi de dönebilir
}

// URL kısaltma işlemini yapacak ana fonksiyon
// Bu fonksiyon, index.ts'teki /api/shorten endpoint'i tarafından çağrılacak.
// req: Gelen HTTP isteği objesi (AuthenticatedRequest tipinde)
// res: HTTP yanıt objesi (ServerResponse tipinde)
// body: POST isteğinin body içeriği (originalUrl'yi içerir, string tipinde)
// PORT: Kısaltılmış URL'yi oluşturmak için gerekli olan sunucu portu (number tipinde)
export const shortenUrl = async (req: AuthenticatedRequest, res: ServerResponse, body: string, PORT: number): Promise<void> => {
    // authMiddleware veya başka bir middleware zaten bir yanıt göndermişse,
    // (örn. geçersiz token nedeniyle 403 hatası gibi), bu fonksiyonun daha fazla işlem yapmasını engelleriz.
    if (res.headersSent) {
        return;
    }

    // Gelen isteğin IP adresini alıyoruz.
    // 'x-forwarded-for' başlığı genellikle proxy veya load balancer arkasındayken gerçek istemci IP'sini sağlar.
    // Eğer bu başlık yoksa, req.socket.remoteAddress doğrudan bağlantının IP adresini verir (yerel testlerde genelde bu kullanılır).
    // Birden fazla IP adresi virgülle ayrılmış olarak gelebileceği için ilkini alıyoruz.
    const ipAddress: string = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.socket.remoteAddress || 'unknown';
    console.log(`Gelen istek IP: ${ipAddress}`);

    let client: PoolClient | undefined; // Veritabanı bağlantı nesnesi için bir yer tutucu
    try {
        // İsteğin body'sinden 'longUrl' değerini JSON olarak ayrıştırıyoruz.
        // ShortenRequestBody arayüzünü kullanarak tip güvenliği sağlıyoruz.
        const { longUrl }: ShortenRequestBody = JSON.parse(body);

        // Gelen 'longUrl' boşsa veya geçerli bir URL formatında değilse:
        if (!longUrl || !isValidUrl(longUrl)) {
            // 400 Bad Request (Hatalı İstek) yanıtı gönderilir.
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Geçersiz URL formatı.' }));
            return; // Fonksiyonu burada sonlandır.
        }

        let shortCode: string | undefined; // Oluşturulacak kısa kod (başlangıçta undefined olabilir)
        client = await pool.connect(); // Veritabanı havuzundan bir bağlantı al

        // Benzersiz bir kısa kod oluşturmak için döngü. Maksimum 5 deneme yapılır.
        for (let i = 0; i < 5; i++) {
            const codeCandidate: string = generateShortCode(); // Yeni bir rastgele kısa kod adayı oluştur
            const checkQuery: string = 'SELECT id FROM urls WHERE short_code = $1'; // Aday kodun veritabanında olup olmadığını kontrol etme sorgusu
            const checkResult = await client.query<UrlRow>(checkQuery, [codeCandidate]); // Sorguyu çalıştır, UrlRow tipinde sonuç bekliyoruz

            // Eğer veritabanında bu kısa kod yoksa (daha önce kullanılmamışsa):
            if (checkResult.rows.length === 0) {
                shortCode = codeCandidate; // Bu kodu kullanabiliriz
                break; // Döngüden çık
            }
            // Eğer 5 deneme sonunda hala benzersiz bir kod bulunamazsa, hata fırlat.
            if (i === 4) {
                throw new Error('Kısa kod oluşturulamadı, lütfen tekrar deneyin.');
            }
        }

        // Döngüden çıktıktan sonra hala bir shortCode belirlenmemişse, bu da bir hata durumudur.
        if (!shortCode) {
            throw new Error('Kısa kod oluşturulamadı, bilinmeyen bir hata oluştu.');
        }

        // Eğer kullanıcı giriş yapmışsa (req.user objesi varsa), userId'yi al, yoksa null ata (anonim kullanıcı).
        // req.user?.id ifadesi, req.user null veya undefined ise undefined döner, aksi takdirde id'yi alır.
        const userId: number | null = req.user?.id || null;

        // Yeni URL kaydını veritabanına ekle sorgusu
        const insertQuery: string = 'INSERT INTO urls(original_url, short_code, user_id, ip_address) VALUES($1, $2, $3, $4) RETURNING short_code';
        const result = await client.query<UrlRow>(insertQuery, [longUrl, shortCode, userId, ipAddress]);

        // Başarılı 201 Created (Oluşturuldu) yanıtı gönderilir.
        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            originalUrl: longUrl, // Orijinal uzun URL
            shortUrl: `http://localhost:${PORT}/${result.rows[0].short_code}`, // Kısaltılmış URL
            // Mesajı, kullanıcının giriş durumuna göre özelleştir.
            message: userId ? "URL başarıyla kısaltıldı." : "URL başarıyla kısaltıldı (anonim).",

        }));

    } catch (error: unknown) { // JSON ayrıştırma hatası veya genel işlem hatalarını yakala
        // Hata objesini 'Error' tipine dönüştürerek mesajına erişiyoruz.
        console.error('İstek işleme sırasında hata:', (error as Error).message);
        if (!res.headersSent) { // Eğer yanıt başlıkları zaten gönderilmediyse
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'İstek işlenirken bir sorun oluştu veya JSON formatı geçersiz.' }));
        }
    } finally {
        // Her durumda (başarılı veya hatalı) veritabanı bağlantısını havuza geri bırak.
        if (client) {
            client.release();
        }
    }
};

// URL yönlendirme işlemini yapacak fonksiyon
// Bu fonksiyon, index.ts'teki GET /:shortCode endpoint'i tarafından çağrılacak.
// req: Gelen HTTP isteği objesi (IncomingMessage tipinde)
// res: HTTP yanıt objesi (ServerResponse tipinde)
// shortCode: Yönlendirilecek kısa kod (string tipinde)
export const redirectUrl = async (req: IncomingMessage, res: ServerResponse, shortCode: string): Promise<void> => {
    let client: PoolClient | undefined; // Veritabanı bağlantı nesnesi
    try {
        client = await pool.connect(); // Veritabanı havuzundan bir bağlantı al
        const selectQuery: string = 'SELECT original_url FROM urls WHERE short_code = $1'; // Orijinal URL'yi bulma sorgusu
        const result = await client.query<UrlRow>(selectQuery, [shortCode]); // Sorguyu çalıştır, UrlRow tipinde sonuç bekliyoruz

        if (result.rows.length > 0) { // Eğer veritabanında bu kısa koda ait bir orijinal URL bulunursa:
            const longUrl: string = result.rows[0].original_url; // Orijinal URL'yi al
            // Bu kod bloğu, "tıklama sayısı"nı artırmak için gerekli.
            // Orijinal URL bulundu, şimdi tıklama sayısını artırıyoruz.
            await client.query(
                'UPDATE urls SET click_count = click_count + 1 WHERE short_code = $1',
                [shortCode]
            );
            console.log(`Kısa kod '${shortCode}' için tıklama sayısı artırıldı.`);

            res.writeHead(302, { 'Location': longUrl }); // 302 Found (Bulundu) yanıtı ile tarayıcıyı orijinal URL'ye yönlendir.
            res.end(); // Yanıtı sonlandır.
        } else {
            // Kısa kod veritabanında bulunamazsa:
            res.writeHead(404, { 'Content-Type': 'text/plain' }); // 404 Not Found (Bulunamadı) yanıtı gönder.
            res.end('Kisaltilmiş URL bulunamadi.'); // Kullanıcıya mesaj göster.
        }
    } catch (error: unknown) { // Veritabanı sorgusu sırasında oluşabilecek hataları yakala
        // Hata objesini 'Error' tipine dönüştürerek mesajına erişiyoruz.
        console.error('Veritabanı sorgusu sırasında hata:', (error as Error).message);
        if (!res.headersSent) { // Eğer yanıt başlıkları zaten gönderilmediyse
            res.writeHead(500, { 'Content-Type': 'application/json' }); // 500 Internal Server Error (Sunucu Hatası)
            res.end(JSON.stringify({ error: 'Sunucu hatasi: Yönlendirme başarisiz.' }));
        }
    } finally {
        // Her durumda (başarılı veya hatalı) veritabanı bağlantısını havuza geri bırak.
        if (client) {
            client.release();
        }
    }
};

// Kullanıcının kısaltılmış URL'lerini listeleme fonksiyonu
// Bu fonksiyon, index.ts'teki GET /api/urls endpoint'i tarafından çağrılacak.
// req: Gelen HTTP isteği objesi (AuthenticatedRequest tipinde)
// res: HTTP yanıt objesi (ServerResponse tipinde)
// PORT: Sunucunun port numarası (kısaltılmış URL oluşturmak için)
export const listUserUrls = async (req: AuthenticatedRequest, res: ServerResponse, PORT: number): Promise<void> => {
    // req.user objesinin varlığını ve id'sinin sayı tipinde olduğunu kontrol ediyoruz.
    // Bu, middleware'den gelen kullanıcı bilgisinin güvenilirliğini sağlar.
    if (!req.user || typeof req.user.id !== 'number') {
        console.error("listUserUrls: Kimlik doğrulaması başarısız veya kullanıcı ID'si eksik.");
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: "Kimlik doğrulaması gereklidir veya kullanıcı bilgisi eksik." }));
        return;
    }

    const userId: number = req.user.id; // Giriş yapmış kullanıcının ID'si

    let client: PoolClient | undefined;
    try {
        client = await pool.connect();

        const query: string = `
            SELECT original_url, short_code, click_count, created_at
            FROM urls
            WHERE user_id = $1
            ORDER BY created_at DESC;
        `;
        // Sorguyu çalıştırırken UrlRow tipinde sonuç bekliyoruz.
        const result = await client.query<UrlRow>(query, [userId]);

        // Veritabanından gelen satırları, frontend'e uygun bir formata dönüştürüyoruz.
        const urls = result.rows.map((row: UrlRow) => ({
            originalUrl: row.original_url,
            shortCode: row.short_code,
            shortUrl: `http://localhost:${PORT}/${row.short_code}`,
            clickCount: row.click_count,
            createdAt: row.created_at
        }));

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            message: "Kısaltılmış URL'ler başarıyla listelendi.",
            urls: urls
        }));

    } catch (error: unknown) { // Veritabanından kullanıcı URL'lerini çekerken oluşabilecek hataları yakala
        // Hata objesini 'Error' tipine dönüştürerek mesajına erişiyoruz.
        console.error('Veritabanından kullanıcı URL\'lerini çekerken hata:', (error as Error).message);
        if (!res.headersSent) { // Eğer yanıt başlıkları zaten gönderilmediyse
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Sunucu hatası: URL\'ler listelenemedi.' }));
        }
    } finally {
        // Her durumda (başarılı veya hatalı) veritabanı bağlantısını havuza geri bırak.
        if (client) {
            client.release();
        }
    }
};

// Bu fonksiyonları diğer modüllerin (örn. urlRoutes.ts) kullanabilmesi için dışa aktarıyoruz.
// 'export const' kullanarak named export sağlıyoruz.
