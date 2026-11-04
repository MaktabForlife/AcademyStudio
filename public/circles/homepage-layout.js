(function(){
 'use strict';
 // Owner-approved desktop arrangement, exported from the local layout editor.
 const id='20261030-responsive-123619';
 const desktop={
  "arabic-adventures": {
    "x": -0.1367657754815409,
    "y": -0.024759615384615383
  },
  "mothers": {
    "x": -0.0008464586677367576,
    "y": 0.07042067307692308
  },
  "academy": {
    "x": 0.03839160313001605,
    "y": -0.05751802884615385
  },
  "hifz": {
    "x": 0.060709896669341894,
    "y": 0.009254807692307692
  }
};
 const compactDesktop={
  "mothers": {
    "x": -0.006948824132757173,
    "y": 0.02304697254801554
  },
  "circle": {
    "x": -0.026592925565326633,
    "y": 0.08
  },
  "tafseer": {
    "x": -0.1051694016959799,
    "y": -0.012202489513040307
  },
  "arabic-adventures": {
    "x": -0.0958209236589514,
    "y": -0.04302630332917124
  },
  "academy": {
    "x": 0.01495410313001605,
    "y": -0.04360000951367163
  },
  "hifz": {
    "x": 0.024096163943211242,
    "y": -0.032356764439736806
  }
};
 // Fit the smaller-window import vertically so surrounding cards leave the central wording clear.
 let profile='full';
 const selectors={circle:'.hub-academy-centre',hifz:'[data-home-area="hifz"]',tafseer:'[data-home-area="tafseer"]',academy:'[data-home-area="academy"]',mothers:'[data-home-area="mothers"]','arabic-adventures':'[data-home-area="arabic-adventures"]'};
 let hub=null,observer=null;
 function apply(){
  if(!hub)return;
  const active=matchMedia('(min-width:821px)').matches,frame=hub.closest('.circle-hub-frame');
  profile=active&&frame&&frame.clientWidth<1245.5?'compact':'full';
  hub.classList.toggle('home-layout-compact',active&&profile==='compact');
  if(frame){frame.style.setProperty('--home-composition-scale',String(active?Math.min(1,frame.clientWidth/1246):1));frame.style.setProperty('--home-composition-height','650px');}
  const r={width:hub.offsetWidth,height:hub.offsetHeight};
  hub.classList.toggle('home-layout-arranged',active);
  for(const [key,selector]of Object.entries(selectors)){
   const el=hub.querySelector(selector),p=active?(profile==='compact'?compactDesktop:desktop)[key]:null;if(!el)continue;
   el.style.setProperty('--home-layout-x',p?p.x*r.width+'px':'0px');
   el.style.setProperty('--home-layout-y',p?p.y*r.height+'px':'0px');
  }
 }
 function refresh(){
  const next=document.querySelector('.single-circle-home #animated-hub');
  if(next!==hub){observer?.disconnect();hub=next;if(hub){observer=new ResizeObserver(apply);observer.observe(hub);const frame=hub.closest('.circle-hub-frame');if(frame)observer.observe(frame);}}
  apply();
 }
 window.addEventListener('resize',apply);
 window.AcademyHomepageLayout={id,get desktop(){return profile==='compact'?compactDesktop:desktop;},get profile(){return profile;},refresh};refresh();
})();
