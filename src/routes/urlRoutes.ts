// src/routes/urlRoutes.ts
// Bu dosya, URL kısaltma, listeleme ve yönlendirme ile ilgili tüm API rotalarını yönetir.

import url from 'url'; 
import { IncomingMessage, ServerResponse } from 'http'; 
import * as urlController from '../controllers/urlController'; // urlController'daki fonksiyonları içeri aktar
import { authenticateToken, AuthenticatedRequest } from '../middlewares/authMiddleware'; // authMiddleware'daki fonksiyonları ve tipi içeri aktar

// Promise<boolean>: Rota eşleşirse ve işlenirse true, aksi takdirde false döner.
export const handleUrlRoutes = async (req: AuthenticatedRequest, res: ServerResponse, PORT: number): Promise<boolean> => {
    // req.url null olabileceği için boş string varsayımı yapıyoruz.
    const parsedUrl = url.parse(req.url || '', true);
    // pathname null olabileceği için boş string ('/') varsayımı yapıyoruz.
    const pathname: string = parsedUrl.pathname || '/';
    const method: string | undefined = req.method; // method undefined olabileceği için tipini belirttik

    // POST /api/shorten: URL kısaltma işlemi için rota
    if (method === 'POST' && pathname === '/api/shorten') {
        let body: string = ''; 
        req.on('data', (chunk: Buffer) => { // chunk Buffer tipinde olabilir
            body += chunk.toString(); 
        });
        req.on('end', async () => {        
            await authenticateToken(req, res, async () => {
                // authenticateToken'dan sonra req objesi AuthenticatedRequest tipinde olacaktır.
                await urlController.shortenUrl(req, res, body, PORT);
            });
        });
        return true; 
    }
    // GET /api/urls: Giriş yapmış kullanıcının linklerini listeleme rotası
    if (method === 'GET' && pathname === '/api/urls') {
        // Bu rotaya sadece geçerli bir JWT token'ı olan kullanıcılar erişebilir.
        await authenticateToken(req, res, async () => {
            await urlController.listUserUrls(req, res, PORT);
        });
        return true; 
    }
    // GET /:shortCode: Kısaltılmış linkin orijinal adrese yönlendirme rotası
    const shortCodeMatch = pathname.match(/^\/([a-zA-Z0-9]{6})$/);
    if (method === 'GET' && shortCodeMatch) {
        const shortCode: string = shortCodeMatch[1]; // Yakalanan kısa kodu al
        await urlController.redirectUrl(req, res, shortCode);
        return true; 
    }
    return false; 
};
