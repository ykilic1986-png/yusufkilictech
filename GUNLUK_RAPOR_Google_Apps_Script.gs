/**
 * YK OTOMASYON - Google Apps Script daily report
 * Set PROPERTY_ID to GA4 numeric Property ID (not G- Measurement ID).
 * Apps Script Project Settings > Show appsscript.json; enable Analytics Data API in Cloud project.
 * Run setupDailyReport() once and approve access. Timezone: Europe/Istanbul.
 */
const PROPERTY_ID = 'GA4_PROPERTY_ID';
const RECIPIENT = 'info@ykotomasyon.com.tr';
function setupDailyReport() {
  ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction()==='sendDailyReport').forEach(ScriptApp.deleteTrigger);
  ScriptApp.newTrigger('sendDailyReport').timeBased().everyDays(1).atHour(23).nearMinute(55).inTimezone('Europe/Istanbul').create();
}
function gaReport(body) {
  const url='https://analyticsdata.googleapis.com/v1beta/properties/'+PROPERTY_ID+':runReport';
  const res=UrlFetchApp.fetch(url,{method:'post',contentType:'application/json',
    headers:{Authorization:'Bearer '+ScriptApp.getOAuthToken()},
    payload:JSON.stringify(body),muteHttpExceptions:true});
  if(res.getResponseCode()!==200)throw new Error('GA4 API: '+res.getContentText());
  return JSON.parse(res.getContentText());
}
function metric(result,index) {return Number(result.rows?.[0]?.metricValues?.[index]?.value||0);}
function eventCount(name) {
  return metric(gaReport({dateRanges:[{startDate:'today',endDate:'today'}],
    dimensions:[{name:'eventName'}],metrics:[{name:'eventCount'}],
    dimensionFilter:{filter:{fieldName:'eventName',stringFilter:{value:name}}}}),0);
}
function sendDailyReport(){
  if(PROPERTY_ID==='GA4_PROPERTY_ID')throw new Error('GA4 property ID girilmedi');
  const today=Utilities.formatDate(new Date(),'Europe/Istanbul','dd.MM.yyyy');
  const summary=gaReport({dateRanges:[{startDate:'today',endDate:'today'}],
    metrics:[{name:'activeUsers'},{name:'screenPageViews'}]});
  const visits=metric(summary,0), views=metric(summary,1);
  const plays=eventCount('video_play'), completes=eventCount('video_complete'),cloud=eventCount('turko_cloud_open'),forms=eventCount('contact_form_submit');
  const subject='YK Otomasyon - Günlük Web Sitesi Raporu - '+today;
  const body=`Tarih: ${today}\nAktif ziyaretçi: ${visits}\nSayfa görüntüleme: ${views}\nVideo oynatma: ${plays}\nVideo tamamlanma: ${completes}\nTURKO Cloud Connect açılışı: ${cloud}\nİletişim formu gönderim denemesi: ${forms}\n\nNot: GA4 verileri gecikmeli işlenebilir. Bu rapor günün 23:55 civarında çalışır, gün sonu kesin rakamı değildir.`;
  MailApp.sendEmail(RECIPIENT,subject,body);
}
