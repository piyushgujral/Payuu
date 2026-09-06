/* PAYUU LIVE - SINGLE MEDIA ENGAGEMENT OVERLAY */
(function () {
    'use strict';
    if (window.__PAYUU_ENGAGEMENT_RUNTIME__) return;
    window.__PAYUU_ENGAGEMENT_RUNTIME__ = true;
    const TYPES={like:{icon:'❤️',title:'LIKE THE STREAM',message:'Smash that Like button!'},subscribe:{icon:'🔔',title:'SUBSCRIBE',message:'Subscribe to Payuu Live and join the community!'},share:{icon:'📣',title:'SHARE THE STREAM',message:'Share the stream and help the community grow!'}};
    const queue=[]; const seen=new Set(); let busy=false; let activeTimer=null; let listenerStarted=false; let browserChannel=null; let videoFrame=null;
    function removeStrayText(){try{const w=document.createTreeWalker(document.body||document,NodeFilter.SHOW_TEXT),r=[];let n;while(n=w.nextNode()){if(n.nodeValue&&n.nodeValue.includes('window.payuuEngagementShow'))r.push(n)}r.forEach(n=>n.parentNode&&n.parentNode.removeChild(n))}catch(_){} }
    function isolateEngagementFromNormalOverlay(){try{if(!window.firebaseDB||typeof window.firebaseDB.listenOverlay!=='function'||window.firebaseDB.__payuuEngagementIsolated)return;const original=window.firebaseDB.listenOverlay;window.firebaseDB.listenOverlay=function(callback){return original.call(window.firebaseDB,(data,key)=>{if(data&&data.eventType==='engagement')return;callback(data,key)});};window.firebaseDB.__payuuEngagementIsolated=true}catch(_){} }
    function createUI(){if(document.getElementById('payuu-engagement-media'))return;const s=document.createElement('style');s.id='payuu-engagement-media-style';s.textContent=`#payuu-engagement-media{position:fixed!important;inset:0!important;display:flex!important;align-items:center;justify-content:center;z-index:99999!important;pointer-events:none;opacity:0;visibility:hidden;transition:opacity .35s ease,visibility .35s ease}.payuu-engagement-media-inner{position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;max-width:90vw;max-height:90vh;text-align:center}.payuu-engagement-media-asset{display:block;max-width:90vw;max-height:72vh;object-fit:contain;filter:drop-shadow(0 0 25px rgba(255,215,0,.55));border-radius:18px}video.payuu-engagement-media-asset{background:transparent}.payuu-engagement-chroma{display:block;max-width:90vw;max-height:72vh;width:auto;height:auto;object-fit:contain;filter:drop-shadow(0 0 25px rgba(255,215,0,.55));border-radius:18px} .payuu-engagement-source-video{position:absolute!important;width:1px!important;height:1px!important;opacity:0!important;pointer-events:none!important;left:-99999px!important} .payuu-engagement-media-title{margin-top:12px;padding:8px 18px;border-radius:999px;background:rgba(7,25,47,.88);border:1px solid #FFD700;color:#FFD700;font:900 1.5rem/1.1 Orbitron,Arial,sans-serif;text-shadow:0 0 12px rgba(255,215,0,.45)}.payuu-engagement-media-message{margin-top:6px;color:#fff;font:700 .9rem Poppins,Arial,sans-serif;text-shadow:0 2px 8px #000}#payuu-engagement-media.active{opacity:1!important;visibility:visible!important}@media(max-width:600px){.payuu-engagement-media-asset,.payuu-engagement-chroma{max-width:94vw;max-height:65vh}.payuu-engagement-media-title{font-size:1.1rem}.payuu-engagement-media-message{font-size:.75rem}}`;document.head.appendChild(s);const b=document.createElement('div');b.id='payuu-engagement-media';b.innerHTML=`<div class="payuu-engagement-media-inner"><div id="payuu-engagement-media-slot"></div><div id="payuu-engagement-media-title" class="payuu-engagement-media-title"></div><div id="payuu-engagement-media-message" class="payuu-engagement-media-message"></div><audio id="payuu-engagement-media-audio" preload="auto"></audio></div>`;document.body.appendChild(b)}
    function parseEvent(data){const msg=String(data?.msg||'');const match=msg.match(/^\[\[PAYUU_ENGAGEMENT:(like|subscribe|share)\]\]\s*/i);if(!match&&data?.eventType!=='engagement')return null;const type=String(data?.engagementType||match?.[1]||'like').toLowerCase();return{type,message:match?msg.slice(match[0].length).trim():String(data?.message||''),mediaUrl:data?.engagementMediaUrl||'',mediaType:data?.engagementMediaType||'',soundUrl:data?.engagementSoundUrl||'',duration:Math.max(1,Math.min(30,Number(data?.engagementDuration||6))),volume:Math.max(0,Math.min(1,Number(data?.engagementVolume??1)))}}
    function clearMedia(){if(videoFrame){cancelAnimationFrame(videoFrame);videoFrame=null}const s=document.getElementById('payuu-engagement-media-slot'),a=document.getElementById('payuu-engagement-media-audio');if(s)s.innerHTML='';if(a){a.pause();a.removeAttribute('src');a.load()}}
    function startGreenScreenVideo(url,slot){
      const v=document.createElement('video');v.className='payuu-engagement-source-video';v.src=url;v.crossOrigin='anonymous';v.autoplay=true;v.playsInline=true;v.muted=true;v.controls=false;v.preload='auto';
      const c=document.createElement('canvas');c.className='payuu-engagement-chroma';c.setAttribute('aria-label','Payuu engagement animation');slot.appendChild(v);slot.appendChild(c);
      const ctx=c.getContext('2d',{willReadFrequently:true});
      let started=false;
      const draw=()=>{
        if(!document.body.contains(v)||v.ended){videoFrame=null;return}
        if(v.videoWidth&&v.videoHeight){
          if(!started){c.width=v.videoWidth;c.height=v.videoHeight;started=true}
          ctx.drawImage(v,0,0,c.width,c.height);
          try{
            const image=ctx.getImageData(0,0,c.width,c.height),p=image.data;
            for(let i=0;i<p.length;i+=4){
              const r=p[i],g=p[i+1],b=p[i+2];
              const max=Math.max(r,g,b),min=Math.min(r,g,b);
              const greenStrong=g>r*1.16&&g>b*1.10&&g>70;
              const greenScreen=greenStrong&&(g-r>22||g-b>18);
              if(greenScreen){const strength=Math.min(1,Math.max(0,(g-Math.max(r,b)-12)/95));p[i+3]=Math.round(p[i+3]*(1-strength));}
              else if(max-min<18&&g>75&&g>r*1.04&&g>b*1.02)p[i+3]=0;
            }
            ctx.putImageData(image,0,0);
          }catch(err){console.warn('Payuu green-screen canvas error:',err);c.style.display='none';v.className='payuu-engagement-media-asset';v.style.position='relative';v.style.width='auto';v.style.height='auto';v.style.opacity='1';v.style.left='auto';}
        }
        videoFrame=requestAnimationFrame(draw);
      };
      const begin=()=>{v.play().catch(()=>{});draw()};
      v.addEventListener('loadedmetadata',begin,{once:true});
      v.addEventListener('error',()=>{console.warn('Payuu engagement video could not load.');}, {once:true});
      begin();
    }
    function render(item){const e=parseEvent(item.data);if(!e)return false;if(item.key&&seen.has(item.key))return true;if(item.key)seen.add(item.key);if(busy){queue.push(item);return true}createUI();const b=document.getElementById('payuu-engagement-media'),s=document.getElementById('payuu-engagement-media-slot'),t=document.getElementById('payuu-engagement-media-title'),m=document.getElementById('payuu-engagement-media-message'),a=document.getElementById('payuu-engagement-media-audio');if(!b||!s){queue.push(item);return true}busy=true;clearMedia();const c=TYPES[e.type]||TYPES.like;t.textContent=c.title;m.textContent=e.message||c.message;if(e.mediaUrl){const type=(e.mediaType||'').toLowerCase();if(type==='video/mp4'||/\.mp4(?:\?|$)/i.test(e.mediaUrl)){startGreenScreenVideo(e.mediaUrl,s)}else{const i=document.createElement('img');i.className='payuu-engagement-media-asset';i.src=e.mediaUrl;i.alt=c.title;s.appendChild(i)}}else{const f=document.createElement('div');f.className='payuu-engagement-media-title';f.style.fontSize='4rem';f.textContent=c.icon;s.appendChild(f)}if(e.soundUrl){a.src=e.soundUrl;a.volume=e.volume;a.currentTime=0;a.play().catch(()=>{})}b.classList.remove('active');void b.offsetWidth;b.classList.add('active');try{if(typeof confetti==='function')confetti({particleCount:90,spread:90,origin:{y:.55}})}catch(_){}clearTimeout(activeTimer);activeTimer=setTimeout(()=>{b.classList.remove('active');setTimeout(()=>{clearMedia();busy=false;const n=queue.shift();if(n)render(n)},350)},e.duration*1000);return true}
    function receive(data,source){if(data&&data.eventType==='engagement')render({data,key:source+'-'+(data.id||Date.now())})}
    function listenBrowser(){try{if('BroadcastChannel' in window){browserChannel=new BroadcastChannel('payuu-engagement-v1');browserChannel.onmessage=e=>receive(e.data,'bc')}}catch(_){}try{window.addEventListener('storage',e=>{if(e.key==='payuu-engagement-event'&&e.newValue){try{receive(JSON.parse(e.newValue),'storage')}catch(_){} }});}catch(_){} }
    function listenQueue(){if(listenerStarted)return;if(!window.firebase||typeof firebase.database!=='function')return;listenerStarted=true;const ref=firebase.database().ref('engagementBroadcast');ref.on('child_added',snap=>receive(snap.val(),'firebase'));ref.limitToLast(1).on('value',snap=>{const data=snap.val();if(data)Object.keys(data).forEach(k=>receive(data[k],'value'))});listenBrowser();}
    window.payuuEngagementShow=function(data,key){return parseEvent(data)?render({data,key}):false};
    isolateEngagementFromNormalOverlay();
    document.addEventListener('DOMContentLoaded',()=>{removeStrayText();isolateEngagementFromNormalOverlay();createUI();listenQueue();listenBrowser();const p=queue.splice(0);p.forEach(render)});
    function waitForFirebase(){if(window.firebase&&typeof firebase.database==='function'){isolateEngagementFromNormalOverlay();listenQueue();listenBrowser();return}setTimeout(waitForFirebase,300)}
    waitForFirebase();setTimeout(removeStrayText,100);
})();
