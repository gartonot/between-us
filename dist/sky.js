(() => {
  const canvas = document.querySelector('#constellations');
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  let w = 0, h = 0, stars = [], frame, x = 0, y = 0, targetX = 0, targetY = 0;
  const shapes = [
    [[.03,.31],[.09,.22],[.18,.25],[.23,.13],[.33,.17]],
    [[.65,.12],[.73,.05],[.83,.15],[.91,.09],[.97,.26]],
    [[.04,.76],[.13,.67],[.21,.78],[.34,.70],[.39,.87]],
    [[.70,.81],[.78,.69],[.89,.74],[.95,.91]]
  ];
  function resize(){
    w=innerWidth;h=innerHeight;const dpr=Math.min(devicePixelRatio||1,2);
    canvas.width=w*dpr;canvas.height=h*dpr;ctx.setTransform(dpr,0,0,dpr,0,0);
    stars=Array.from({length:Math.min(170,Math.floor(w*h/6500))},()=>({x:Math.random()*w,y:Math.random()*h,r:Math.random()*1.1+.3,phase:Math.random()*Math.PI*2,speed:Math.random()*.5+.25}));
    if(motion.matches)draw(0);
  }
  function draw(time){
    const t=motion.matches?0:time/1000;x+=(targetX-x)*.025;y+=(targetY-y)*.025;
    ctx.clearRect(0,0,w,h);
    for(const star of stars){const a=.32+(Math.sin(t*star.speed+star.phase)+1)*.24;ctx.beginPath();ctx.fillStyle=`rgba(210,220,255,${a})`;ctx.arc(star.x+x*.4,star.y+y*.4,star.r,0,Math.PI*2);ctx.fill();}
    shapes.forEach((points,index)=>{
      const alpha=.16+Math.sin(t*.35+index)*.055;
      for(let i=1;i<points.length;i++){
        const a=points[i-1],b=points[i];const reveal=motion.matches?1:Math.min(1,Math.max(0,(time-200-index*200-i*180)/1700));
        ctx.beginPath();ctx.strokeStyle=`rgba(169,184,243,${alpha})`;ctx.lineWidth=.8;ctx.moveTo(a[0]*w+x,a[1]*h+y);ctx.lineTo((a[0]+(b[0]-a[0])*reveal)*w+x,(a[1]+(b[1]-a[1])*reveal)*h+y);ctx.stroke();
      }
      points.forEach((point,i)=>{const px=point[0]*w+x,py=point[1]*h+y;const glow=ctx.createRadialGradient(px,py,0,px,py,12);glow.addColorStop(0,'rgba(189,205,255,.24)');glow.addColorStop(1,'rgba(189,205,255,0)');ctx.fillStyle=glow;ctx.fillRect(px-12,py-12,24,24);ctx.beginPath();ctx.fillStyle=`rgba(222,228,255,${.6+Math.sin(t*.7+i)*.2})`;ctx.arc(px,py,1.8,0,Math.PI*2);ctx.fill();});
    });
    if(!motion.matches&&!document.hidden)frame=requestAnimationFrame(draw);
  }
  addEventListener('resize',resize);
  addEventListener('pointermove',e=>{if(e.pointerType==='mouse'&&!motion.matches){targetX=(e.clientX/w-.5)*14;targetY=(e.clientY/h-.5)*14;}},{passive:true});
  function restart(){cancelAnimationFrame(frame);if(!document.hidden)draw(performance.now());}
  motion.addEventListener('change',restart);document.addEventListener('visibilitychange',restart);
  resize();restart();
})();
