/**
 * 591 物件頁「一鍵抓資料」書籤小工具的原始碼（2026-08-21）
 *
 * 這支程式**不在我們的伺服器上執行**。它是一串文字，使用者把它存成瀏覽器書籤，
 * 在自己已登入、自己正在看的 591 物件頁按一下才會跑。
 *
 * 為什麼一定要這樣：
 *   ① 591 詳情頁是 Vue 動態渲染的。伺服器端抓只會拿到 `${price}` 這種未替換的樣板，
 *      實測確認過。只有在真實瀏覽器裡才有值。
 *   ② 這是「使用者自己看的那一頁、自己按的按鈕」，不是伺服器排程批次爬取。
 *
 * 抓什麼、不抓什麼的界線寫在 listing-grab.ts 檔頭，改這支之前先讀那裡。
 * 一句話：抓事實，不抓別人寫的文案、拍的照片、留的聯絡方式。
 */

export const GRAB591_SOURCE = String.raw`
(function(){
  try{
    if(!/591\.com\.tw$/.test(location.hostname.replace(/^www\./,''))){
      alert('請在 591 的「物件詳情頁」按這個書籤');return;
    }

    /* 591 自己發布給機器讀的結構化資料（Google 也是讀這個），比刮版面穩定太多 */
    var ld=null;
    document.querySelectorAll('script[type="application/ld+json"]').forEach(function(s){
      try{
        var j=JSON.parse(s.textContent);
        var g=j['@graph']||[j];
        g.forEach(function(n){
          var t=[].concat(n['@type']||[]).join(',');
          if(/Residence|Product|Apartment|House/i.test(t)) ld=ld||n;
        });
      }catch(e){}
    });

    var T=function(s){return (s||'').replace(/\s+/g,' ').trim();};

    /* 規格列：「型態 ： 別墅」 */
    var spec={};
    document.querySelectorAll('.detail-house-item').forEach(function(e){
      var t=T(e.innerText); var m=t.split(/\s*[:：]\s*/);
      if(m.length>=2 && m[0] && m[0].length<=6) spec[m[0]]=m.slice(1).join('：');
    });
    /* 上方數字區：坪數／格局／屋齡／樓層，標籤與值成對 */
    document.querySelectorAll('[class*="info-"],[class*="detail-"]').forEach(function(e){
      var t=T(e.innerText);
      var m=t.match(/^(屋齡|樓層|格局|權狀坪數|建物坪數|坪數)\s*[:：]?\s*(.+)$/);
      if(m && m[2].length<24 && !spec[m[1]]) spec[m[1]]=m[2];
    });

    var no=null, m2=location.pathname.match(/(\d{6,})/); if(m2) no=m2[1];
    if(!no && ld && ld.sku) no=String(ld.sku).replace(/\D/g,'')||null;

    var addr = ld && ld.address ? ld.address.streetAddress : null;
    var dist = ld && ld.address ? ld.address.addressLocality : null;
    var ping = ld && ld.floorSize ? ld.floorSize.value : null;
    var rooms= ld ? ld.numberOfRooms : null;
    var wan  = ld && ld.offers && ld.offers.price ? Math.round(ld.offers.price/10000) : null;

    /* 社區名：591 的描述句「位於OOO」是最穩的來源。
       ⚠️ 標題不要用 —— 那是別家仲介的行銷文案（「獨家★…★」），正是不該帶給客戶的東西。 */
    var comm=null;
    if(ld && ld.description){
      var mc=ld.description.match(/位於([^，,。]{2,20})/);
      if(mc) comm=mc[1].trim();
    }
    if(!comm && spec['社區']) comm=T(spec['社區']);

    var age=null;
    if(spec['屋齡']){ var ma=String(spec['屋齡']).match(/(\d+(\.\d+)?)/); if(ma) age=ma[1]; }

    var L=[];
    L.push('【591物件】'+(comm||addr||('591 物件 '+(no||''))));
    if(no)   L.push('編號: '+no);
    if(comm) L.push('社區: '+comm);
    if(addr) L.push('地址: '+addr);
    if(dist) L.push('行政區: '+dist);
    if(wan)  L.push('總價: '+wan);
    if(ping) L.push('坪數: '+ping);
    if(rooms)L.push('房數: '+rooms);
    if(spec['型態']) L.push('型態: '+T(spec['型態']));
    if(spec['車位']) L.push('車位: '+T(spec['車位']));
    if(age)  L.push('屋齡: '+age);
    if(spec['樓層']) L.push('樓層: '+T(spec['樓層']));
    L.push('網址: '+location.href.split('?')[0]);

    var out=L.join('\n');

    function done(){
      var d=document.createElement('div');
      d.textContent='✅ 已複製 '+(comm||addr||'這間')+'　→ 去買方頁貼上';
      d.setAttribute('style','position:fixed;z-index:999999;left:50%;top:24px;transform:translateX(-50%);'+
        'background:#1e5bc6;color:#fff;padding:12px 20px;border-radius:10px;font:700 15px/1.5 system-ui;'+
        'box-shadow:0 6px 24px rgba(0,0,0,.25)');
      document.body.appendChild(d);
      setTimeout(function(){d.remove();},2600);
    }
    if(navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(out).then(done,function(){window.prompt('複製這段：',out);});
    }else{
      window.prompt('複製這段：',out);
    }
  }catch(err){
    alert('抓不到資料：'+err.message+'\n\n請確認是在 591「物件詳情頁」，而不是搜尋結果列表。');
  }
})();
`.trim();

/** 壓成一行的 bookmarklet（javascript: 開頭，可直接拖成書籤） */
export function grab591Bookmarklet(): string {
  const min = GRAB591_SOURCE.replace(/\/\*[\s\S]*?\*\//g, "") // 去註解
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .join("");
  return "javascript:" + encodeURIComponent(min);
}
