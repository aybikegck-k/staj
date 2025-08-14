// src/routes/authRoutes.ts
// Bu dosya, kullanıcı kayıt ve giriş işlemleri (authentication) ile ilgili API rotalarını yönetir.

import url from 'url'; // url modülünü içeri aktar
import { IncomingMessage, ServerResponse } from 'http'; 
import * as authController from '../controllers/authControllers'; 
import { AuthenticatedRequest } from '../middlewares/authMiddleware'; 
// Gelen isteği kimlik doğrulama rotalarıyla eşleştiren ana fonksiyon.
export const handleAuthRoutes = async (req: AuthenticatedRequest, res: ServerResponse): Promise<boolean> => {
    // req.url null olabileceği için boş string varsayımı yapıyoruz.
    const { pathname } = url.parse(req.url || '', true);
    const method: string | undefined = req.method; 
    // POST /api/register: Yeni kullanıcı kayıt rotası
    if (method === 'POST' && pathname === '/api/register') {
        let body: string = ''; 
        req.on('data', (chunk: Buffer) => { 
            body += chunk.toString(); 
        });
        req.on('end', async () => {
            // authController.registerUser fonksiyonunu çağırırken req, res ve body'yi iletiyoruz.
            await authController.registerUser(req, res, body);
        });
        return true; 
    }
    // POST /api/login: Kullanıcı giriş rotası ve JWT token oluşturma
    if (method === 'POST' && pathname === '/api/login') {
        let body: string = ''; 
        req.on('data', (chunk: Buffer) => { 
            body += chunk.toString(); 
        });
        req.on('end', async () => {
            await authController.loginUser(req, res, body);
        });
        return true; 
    }
    return false; 
};
