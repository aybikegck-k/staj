// src/routes/authRoutes.ts
// Bu dosya, kullanıcı kayıt ve giriş işlemleri (authentication) ile ilgili API rotalarını yönetir.

import url from 'url'; // url modülünü içeri aktar
import { IncomingMessage, ServerResponse } from 'http'; // HTTP istek ve yanıt objeleri için tip tanımlamaları
import * as authController from '../controllers/authControllers'; // authController'daki fonksiyonları içeri aktar
import { AuthenticatedRequest } from '../middlewares/authMiddleware'; // AuthenticatedRequest tipini içeri aktar

// Gelen isteği kimlik doğrulama rotalarıyla eşleştiren ana fonksiyon.
// req: Gelen HTTP isteği objesi (AuthenticatedRequest tipinde)
// res: Gönderilecek HTTP yanıtı objesi (ServerResponse tipinde)
// Promise<boolean>: Rota eşleşirse ve işlenirse true, aksi takdirde false döner.
export const handleAuthRoutes = async (req: AuthenticatedRequest, res: ServerResponse): Promise<boolean> => {
    // req.url null olabileceği için boş string varsayımı yapıyoruz.
    const { pathname } = url.parse(req.url || '', true);
    const method: string | undefined = req.method; // method undefined olabileceği için tipini belirttik

    // POST /api/register: Yeni kullanıcı kayıt rotası
    if (method === 'POST' && pathname === '/api/register') {
        let body: string = ''; // Gelen istek gövdesini tutacak değişken
        req.on('data', (chunk: Buffer) => { // chunk Buffer tipinde olabilir
            body += chunk.toString(); // Buffer'ı string'e dönüştürerek body'ye ekle
        });
        req.on('end', async () => {
            // authController.registerUser fonksiyonunu çağırırken req, res ve body'yi iletiyoruz.
            // req objesi AuthenticatedRequest tipinde olduğu için, authController da bu tipi bekleyebilir.
            await authController.registerUser(req, res, body);
        });
        return true; // Rota eşleşti ve işlendi
    }

    // POST /api/login: Kullanıcı giriş rotası ve JWT token oluşturma
    if (method === 'POST' && pathname === '/api/login') {
        let body: string = ''; // Gelen istek gövdesini tutacak değişken
        req.on('data', (chunk: Buffer) => { // chunk Buffer tipinde olabilir
            body += chunk.toString(); // Buffer'ı string'e dönüştürerek body'ye ekle
        });
        req.on('end', async () => {
            // authController.loginUser fonksiyonunu çağırırken req, res ve body'yi iletiyoruz.
            await authController.loginUser(req, res, body);
        });
        return true; // Rota eşleşti ve işlendi
    }

    return false; // Hiçbir kimlik doğrulama rotası eşleşmedi
};
