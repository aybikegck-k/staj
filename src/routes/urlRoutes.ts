// src/routes/urlRoutes.ts
// Bu dosya, URL kısaltma, listeleme ve yönlendirme ile ilgili tüm API rotalarını yönetir.

import url from 'url'; // url modülünü içeri aktar
import { IncomingMessage, ServerResponse } from 'http'; // HTTP istek ve yanıt objeleri için tip tanımlamaları
import * as urlController from '../controllers/urlController'; // urlController'daki fonksiyonları içeri aktar
import { authenticateToken, AuthenticatedRequest } from '../middlewares/authMiddleware'; // authMiddleware'daki fonksiyonları ve tipi içeri aktar

// Gelen isteği URL ile ilgili rotalarla eşleştiren ana fonksiyon.
// req: Gelen HTTP isteği objesi (AuthenticatedRequest tipinde)
// res: Gönderilecek HTTP yanıtı objesi (ServerResponse tipinde)
// PORT: Sunucunun port numarası (kısaltılmış URL oluşturmak için)
// Promise<boolean>: Rota eşleşirse ve işlenirse true, aksi takdirde false döner.
export const handleUrlRoutes = async (req: AuthenticatedRequest, res: ServerResponse, PORT: number): Promise<boolean> => {
    // req.url null olabileceği için boş string varsayımı yapıyoruz.
    const parsedUrl = url.parse(req.url || '', true);
    // pathname null olabileceği için boş string ('/') varsayımı yapıyoruz.
    const pathname: string = parsedUrl.pathname || '/';
    const method: string | undefined = req.method; // method undefined olabileceği için tipini belirttik

    // POST /api/shorten: URL kısaltma işlemi için rota
    if (method === 'POST' && pathname === '/api/shorten') {
        let body: string = ''; // Gelen istek gövdesini tutacak değişken
        req.on('data', (chunk: Buffer) => { // chunk Buffer tipinde olabilir
            body += chunk.toString(); // Buffer'ı string'e dönüştürerek body'ye ekle
        });
        req.on('end', async () => {
            // İsteğe bağlı olarak JWT token doğrulamasını yap
            // authenticateToken middleware'i req objesine user bilgisini ekler veya null bırakır.
            await authenticateToken(req, res, async () => {
                // authenticateToken'dan sonra req objesi AuthenticatedRequest tipinde olacaktır.
                await urlController.shortenUrl(req, res, body, PORT);
            });
        });
        return true; // Rota eşleşti ve işlendi
    }

    // GET /api/urls: Giriş yapmış kullanıcının linklerini listeleme rotası
    if (method === 'GET' && pathname === '/api/urls') {
        // Bu rotaya sadece geçerli bir JWT token'ı olan kullanıcılar erişebilir.
        // authenticateToken middleware'i, token yoksa req.user = null yapar
        // ve urlController.listUserUrls içinde kimlik kontrolü yapılır.
        await authenticateToken(req, res, async () => {
            await urlController.listUserUrls(req, res, PORT);
        });
        return true; // Rota eşleşti ve işlendi
    }

    // GET /:shortCode: Kısaltılmış linkin orijinal adrese yönlendirme rotası
    // Regex ile 6 karakterli alfanümerik kodları yakalar (helpers.ts'deki generateShortCode ile uyumlu)
    const shortCodeMatch = pathname.match(/^\/([a-zA-Z0-9]{6})$/);
    if (method === 'GET' && shortCodeMatch) {
        const shortCode: string = shortCodeMatch[1]; // Yakalanan kısa kodu al
        await urlController.redirectUrl(req, res, shortCode);
        return true; // Rota eşleşti ve işlendi
    }

    return false; // Hiçbir URL rotası eşleşmedi
};
