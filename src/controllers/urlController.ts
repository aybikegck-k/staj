// src/controllers/urlController.ts
// Bu dosya, URL kısaltma ve yönlendirme ile ilgili tüm iş mantığını içerir.
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
export const shortenUrl = async (req: AuthenticatedRequest, res: ServerResponse, body: string, PORT: number): Promise<void> => {
    if (res.headersSent) { //daha önce bir yanıt gönderilip gönderilmediğini kontrol eder aynı isteğe birden fazla yanıt  göndermesini engeller
        return;
    }
    // Gelen isteğin IP adresini alıyoruz.
    const ipAddress: string = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.socket.remoteAddress || 'unknown';
    console.log(`Gelen istek IP: ${ipAddress}`); 
    let client: PoolClient | undefined; // Veritabanı bağlantı nesnesi için bir yer tutucu
    try {
        const { longUrl }: ShortenRequestBody = JSON.parse(body);
        if (!longUrl || !isValidUrl(longUrl)) {
            // 400 Bad Request (Hatalı İstek)
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Geçersiz URL formatı.' }));
            return; 
        }
        let shortCode: string | undefined; // Oluşturulacak kısa kod (başlangıçta undefined olabilir)
        client = await pool.connect(); // Veritabanı havuzundan bir bağlantı al
        // Benzersiz bir kısa kod oluşturmak için döngü. Maksimum 5 deneme yapılır.
        for (let i = 0; i < 5; i++) {
            const codeCandidate: string = generateShortCode(); 
            const checkQuery: string = 'SELECT id FROM urls WHERE short_code = $1'; // Aday kodun veritabanında olup olmadığını kontrol etme sorgusu
            const checkResult = await client.query<UrlRow>(checkQuery, [codeCandidate]); // Sorguyu çalıştır, UrlRow tipinde sonuç bekliyoruz
            //ile tip güvenliği sağlıyorum. UrlRow tipi sayesinde dönen verinin yapısını önceden tanımlıyorum

            // Eğer veritabanında bu kısa kod yoksa (daha önce kullanılmamışsa):
            if (checkResult.rows.length === 0) {
                shortCode = codeCandidate; 
                break; 
            }
            // Eğer 5 deneme sonunda hala benzersiz bir kod bulunamazsa, hata fırlat.
            if (i === 4) {
                throw new Error('Kısa kod oluşturulamadı, lütfen tekrar deneyin.');
            }
        }
        if (!shortCode) {
            throw new Error('Kısa kod oluşturulamadı, bilinmeyen bir hata oluştu.');
        }
        // Eğer kullanıcı giriş yapmışsa (req.user objesi varsa), userId'yi al, yoksa null ata (anonim kullanıcı).
        const userId: number | null = req.user?.id || null;
        // Yeni URL kaydını veritabanına ekle sorgusu
        const insertQuery: string = 'INSERT INTO urls(original_url, short_code, user_id, ip_address) VALUES($1, $2, $3, $4) RETURNING short_code';
        const result = await client.query<UrlRow>(insertQuery, [longUrl, shortCode, userId, ipAddress]);
        // Başarılı 201 Created (Oluşturuldu) yanıtı gönderilir.
        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            originalUrl: longUrl, 
            shortUrl: `http://localhost:${PORT}/${result.rows[0].short_code}`, 
            message: userId ? "URL başarıyla kısaltıldı." : "URL başarıyla kısaltıldı (anonim).",
        }));
    } catch (error: unknown) { 
        // Hata objesini 'Error' tipine dönüştürerek mesajına erişiyoruz.
        console.error('İstek işleme sırasında hata:', (error as Error).message);
        if (!res.headersSent) { // Eğer yanıt başlıkları zaten gönderilmediyse
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'İstek işlenirken bir sorun oluştu veya JSON formatı geçersiz.' }));
        }
    } finally {
        if (client) {
            client.release();
        }
    }
};
// URL yönlendirme işlemini yapacak fonksiyon
export const redirectUrl = async (req: IncomingMessage, res: ServerResponse, shortCode: string): Promise<void> => {
    let client: PoolClient | undefined; // Veritabanı bağlantı nesnesi
    try {
        client = await pool.connect(); // Veritabanı havuzundan bir bağlantı al
        const selectQuery: string = 'SELECT original_url FROM urls WHERE short_code = $1'; // Orijinal URL'yi bulma sorgusu
        const result = await client.query<UrlRow>(selectQuery, [shortCode]); // Sorguyu çalıştır, UrlRow tipinde sonuç bekliyoruz
        if (result.rows.length > 0) { // Eğer veritabanında bu kısa koda ait bir orijinal URL bulunursa:
            const longUrl: string = result.rows[0].original_url; // Orijinal URL'yi al

            // Bu kod bloğu, "tıklama sayısı"nı artırmak için gerekli.
            await client.query(
                'UPDATE urls SET click_count = click_count + 1 WHERE short_code = $1',
                [shortCode]
            );
            console.log(`Kisa kod '${shortCode}' için tiklama sayisi artirildi.`);
            res.writeHead(302, { 'Location': longUrl }); // 302 Found (Bulundu) yanıtı ile tarayıcıyı orijinal URL'ye yönlendir.
            res.end(); 
        } else {
            // Kısa kod veritabanında bulunamazsa:
            res.writeHead(404, { 'Content-Type': 'text/plain' }); // 404 Not Found 
            res.end('Kisaltilmiş URL bulunamadi.'); 
        }
    } catch (error: unknown) { 
        console.error('Veritabanı sorgusu sırasında hata:', (error as Error).message);
        if (!res.headersSent) { // Eğer yanıt başlıkları zaten gönderilmediyse
            res.writeHead(500, { 'Content-Type': 'application/json' }); // 500 (Sunucu Hatası)
            res.end(JSON.stringify({ error: 'Sunucu hatasi: Yönlendirme başarisiz.' }));
        }
    } finally {
        if (client) {
            client.release();
        }
    }
};
// Kullanıcının kısaltılmış URL'lerini listeleme fonksiyonu
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
    } catch (error: unknown) { 
        console.error('Veritabanından kullanıcı URL\'lerini çekerken hata:', (error as Error).message);
        if (!res.headersSent) { 
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Sunucu hatası: URL\'ler listelenemedi.' }));
        }
    } finally {
        if (client) {
            client.release();
        }
    }
};
