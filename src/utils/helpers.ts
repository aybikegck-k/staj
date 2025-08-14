// src/utils/helpers.ts

// Rastgele kısa bir kod oluşturan fonksiyon
function generateShortCode(): string {
    const characters: string = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result: string = ''; //her seferinde rastgele seçilen karakterler buna eklenecek
    for (let i = 0; i < 6; i++) {
        // Karakterler listesinden rastgele bir karakter seç
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    } 
    return result;
}
// Bir URL'nin geçerli olup olmadığını basitçe kontrol eden fonksiyon
function isValidUrl(url: string): boolean {
    try {
        // 'new URL(string)' ile URL oluşturmaya çalışırız.
        // Eğer geçerli bir URL değilse hata fırlatır.
        new URL(url);
        return true;
    } catch (e: unknown) { 
        // Hata fırlatırsa geçersiz URL'dir.
        return false;
    }
}
export { //fonksiyonlar dış dünyaya açık baska dosyalar bunu import edebilir
    generateShortCode, 
    isValidUrl, 
};
