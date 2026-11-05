const ALICI = 'info@ykotomasyon.com.tr,mgurotomasyon@gmail.com';
const TZ = 'Europe/Istanbul';

// Editörde bir kez çalıştırın. Özel bir Google Sheet oluşturur.
function ziyaretciKurulum() {
  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty('YK_STATS_SHEET')) {
    const book = SpreadsheetApp.create('YK Web Ziyaret İstatistikleri');
    book.getSheets()[0].setName('Ziyaretciler');
    book.getSheets()[0].appendRow(['Kimlik','Son etkinlik']);
    book.insertSheet('Gunluk').appendRow(['Tarih','Kimlik']);
    props.setProperty('YK_STATS_SHEET', book.getId());
  }
}

function doGet(e) {
  const p = (e && e.parameter) || {};
  if (!/^ykStats_[a-zA-Z0-9_]+$/.test(p.callback || '')) {
    return HtmlService.createHtmlOutput('YK Teknik Servis sistemi hazır.');
  }
  const lock = LockService.getScriptLock();
  let result = {ok:false};
  try {
    lock.waitLock(10000);
    const id = String(p.visitor || '');
    if (!/^[a-f0-9-]{20,64}$/.test(id)) throw new Error('Invalid id');
    const sheetId = PropertiesService.getScriptProperties().getProperty('YK_STATS_SHEET');
    if (!sheetId) throw new Error('Kurulum gerekli');
    const book = SpreadsheetApp.openById(sheetId);
    const visitors = book.getSheetByName('Ziyaretciler');
    const daily = book.getSheetByName('Gunluk');
    const now = Date.now();
    const day = Utilities.formatDate(new Date(now), TZ, 'yyyy-MM-dd');
    const vr = visitors.getDataRange().getValues().slice(1);
    const dr = daily.getDataRange().getValues().slice(1);
    const index = vr.findIndex(r => String(r[0]) === id);
    if (index < 0) { visitors.appendRow([id, now]); vr.push([id, now]); }
    else { visitors.getRange(index+2,2).setValue(now); vr[index][1] = now; }
    const today = dr.filter(r => String(r[0]) === day);
    if (!today.some(r => String(r[1]) === id)) {
      daily.appendRow([day,id]); today.push([day,id]);
    }
    result = {
      ok:true,
      today:today.length,
      total:vr.length,
      active:vr.filter(r => now - Number(r[1]) < 120000).length,
      day:day
    };
  } catch (err) {
    result = {ok:false};
  } finally {
    if (lock.hasLock()) lock.releaseLock();
  }
  return ContentService.createTextOutput(p.callback+'('+JSON.stringify(result)+');')
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}

function doPost(e) {
  try {
    const p = (e && e.parameter) || {};
    if (p._honey) return sonucSayfasi('Talep işlenemedi.');
    const fields = ['Ad Soyad','Firma','email','Telefon','Il Ilce','Cihaz Turu','Marka','Model','Seri Numarasi','Hata Kodu','Ariza Aciklamasi'];
    const required = ['Ad Soyad','email','Telefon','Cihaz Turu','Marka','Model','Ariza Aciklamasi'];
    if (required.some(k => !String(p[k] || '').trim()) || !p['Iletisim Onayi']) {
      return sonucSayfasi('Zorunlu alanları ve iletişim onayını kontrol edin.');
    }
    const email = String(p.email).trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return sonucSayfasi('E-posta adresini kontrol edin.');
    MailApp.sendEmail({
      to:ALICI, replyTo:email, name:'YK Otomasyon Teknik Servis',
      subject:'Web Sitesi — Yeni Teknik Servis Talebi',
      body:fields.map(k => k+': '+String(p[k] || '-').slice(0,5000)).join('\n\n')
    });
    return sonucSayfasi('Teknik servis talebiniz e-posta gönderimine alındı. Sizinle iletişime geçeceğiz.');
  } catch (err) {
    return sonucSayfasi('Talebiniz gönderilemedi. info@ykotomasyon.com.tr adresinden bize ulaşın.');
  }
}

function sonucSayfasi(message) {
  return HtmlService.createHtmlOutput('<!doctype html><html lang="tr"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>YK Otomasyon</title></head><body style="font:18px/1.6 Arial;padding:30px;color:#173750"><h2>YK Otomasyon</h2><p>'+message+'</p><a target="_top" href="https://www.ykotomasyon.com.tr/teknik-servis.html">Teknik servis sayfasına dön</a></body></html>');
}
