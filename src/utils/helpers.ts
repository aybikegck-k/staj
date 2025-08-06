// src/utils/helpers.ts
//src/utils/: Yardımcı fonksiyonları (helpers.ts gibi) içeriyor.

// Rastgele kısa bir kod oluşturan fonksiyon
// TypeScript ile fonksiyonun string döndürdüğünü belirtiyoruz.
function generateShortCode(): string {
    // 6 karakter uzunluğunda rastgele bir string oluşturur
    // (a-z, A-Z, 0-9 karakterlerini kullanırız)
    const characters: string = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result: string = ''; //her seferinde rastgele seçilen karakterler buna eklenecek
    for (let i = 0; i < 6; i++) {
        // Karakterler listesinden rastgele bir karakter seç
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    } //sonuc olarak bir karakter seçilir ve result değişkenine eklenir
    return result;
}

// Bir URL'nin geçerli olup olmadığını basitçe kontrol eden fonksiyon
// TypeScript ile parametrenin (string) ve dönüş değerinin (boolean) tipini belirtiyoruz.
function isValidUrl(url: string): boolean {
    try {
        // 'new URL(string)' ile URL oluşturmaya çalışırız.
        // Eğer geçerli bir URL değilse hata fırlatır.
        new URL(url);
        return true;
    } catch (e: unknown) { // Hata tipini 'unknown' olarak belirttik, bu güvenli bir yaklaşımdır.
        // Hata fırlatırsa geçersiz URL'dir.
        return false;
    }
}

// Bu fonksiyonları başka dosyalarda kullanabilmek için dışa aktarıyoruz
// 'module.exports' yerine ES6 'export' sözdizimini kullanıyoruz.
export {
    generateShortCode, //özetle bu fonk 6 karakterlik rastgele kısa kod üretir
    isValidUrl, // bu fonk ise verilen string geçerli bir url mi diye kontrol eder
    // ve her çağırıldgında farklı kod üretir
};
