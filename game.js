(function(){
  const COLS=10, ROWS=20, CELL=24;
  const canvas=document.getElementById('board');
  const ctx=canvas.getContext('2d');
  const nextCanvas=document.getElementById('next-canvas');
  const nctx=nextCanvas.getContext('2d');
  const holdCanvas=document.getElementById('hold-canvas');
  const hctx=holdCanvas.getContext('2d');
  const cabinet=document.getElementById('cabinet');
  const sprintPanel=document.getElementById('sprint-panel');

  const COLORS={
    I:'#2de2e6', O:'#f9c80e', T:'#ff2e97',
    S:'#3ef2a4', Z:'#ff4d5e', J:'#4d79ff', L:'#ff8c42'
  };
  const SHAPES={
    I:[[0,1],[1,1],[2,1],[3,1]],
    O:[[1,0],[2,0],[1,1],[2,1]],
    T:[[1,0],[0,1],[1,1],[2,1]],
    S:[[1,0],[2,0],[0,1],[1,1]],
    Z:[[0,0],[1,0],[1,1],[2,1]],
    J:[[0,0],[0,1],[1,1],[2,1]],
    L:[[2,0],[0,1],[1,1],[2,1]]
  };
  const KEYS=Object.keys(SHAPES);

  let grid, current, holdPiece, canHold, score, level, lines;
  let dropInterval, lastTime, gameOver, paused, animId, soundOn=true;
  let bag=[], queue=[];
  let clearing=null, dropAnim=null, inputLocked=false;
  let mode='marathon';          // 'marathon' | 'sprint'
  let combo=-1;
  let lastAction=null;          // 'move' | 'rotate' | null  (tracks last input before lock, for T-spin)
  let popups=[];                // floating score/label text
  let sprintStart=0, sprintElapsed=0, sprintRunning=false, pauseStartedAt=0;

  // ---------- persistent storage (falls back to memory if unavailable) ----------
  const memoryStore={};
  function storageGet(key){
    try{ return localStorage.getItem(key); }
    catch(e){ return memoryStore[key]!==undefined ? memoryStore[key] : null; }
  }
  function storageSet(key,val){
    try{ localStorage.setItem(key,val); }
    catch(e){ memoryStore[key]=val; }
  }
  function getHigh(m){ const v=storageGet('retroStack_high_'+m); return v?parseInt(v,10):0; }
  function setHigh(m,val){ storageSet('retroStack_high_'+m, String(val)); }
  function getBestSprint(){ const v=storageGet('retroStack_sprint_best'); return v?parseFloat(v):null; }
  function setBestSprint(ms){ storageSet('retroStack_sprint_best', String(ms)); }

  // ---------- audio ----------
  let audioCtx=null;
  function ensureAudio(){
    if(!audioCtx){
      try{ audioCtx=new (window.AudioContext||window.webkitAudioContext)(); }catch(e){ soundOn=false; }
    }
  }
  function beep(freq,dur,type,vol){
    if(!soundOn) return;
    ensureAudio();
    if(!audioCtx) return;
    const osc=audioCtx.createOscillator();
    const gain=audioCtx.createGain();
    osc.type=type||'square';
    osc.frequency.value=freq;
    gain.gain.value = vol!==undefined ? vol : 0.05;
    osc.connect(gain); gain.connect(audioCtx.destination);
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime+dur);
    osc.stop(audioCtx.currentTime+dur);
  }
  const sfx={
    move:()=>beep(180,0.04,'square',0.03),
    rotate:()=>beep(320,0.05,'square',0.035),
    lock:()=>beep(120,0.09,'triangle',0.06),
    clear:(n)=>beep(500+n*80,0.18,'sawtooth',0.06),
    hold:()=>beep(260,0.06,'sine',0.04),
    tspin:()=>{ beep(700,0.07,'square',0.05); setTimeout(()=>beep(900,0.09,'square',0.05),60); },
    combo:(n)=>beep(400+n*40,0.06,'square',0.04),
    over:()=>{ beep(200,0.15,'sawtooth',0.05); setTimeout(()=>beep(140,0.3,'sawtooth',0.05),150); },
    finish:()=>{ beep(500,0.1,'square',0.05); setTimeout(()=>beep(700,0.1,'square',0.05),110); setTimeout(()=>beep(1000,0.2,'square',0.05),220); }
  };

  // ---------- 7-bag randomizer ----------
  function refillBag(){
    const b=[...KEYS];
    for(let i=b.length-1;i>0;i--){
      const j=Math.floor(Math.random()*(i+1));
      [b[i],b[j]]=[b[j],b[i]];
    }
    bag.push(...b);
  }
  function nextFromBag(){ if(bag.length===0) refillBag(); return bag.shift(); }
  function makePiece(type){ return { type, cells: SHAPES[type].map(([x,y])=>[x,y]), x:3, y:-1, color:COLORS[type] }; }
  function fillQueue(){ while(queue.length<3) queue.push(makePiece(nextFromBag())); }

  function newGrid(){ return Array.from({length:ROWS},()=>Array(COLS).fill(null)); }

  function rotate(piece){
    if(piece.type==='O') return piece.cells;
    const cx=1, cy=1;
    return piece.cells.map(([x,y])=>[ cx-(y-cy), cy+(x-cx) ]);
  }

  function collides(cells,px,py){
    for(const [cx,cy] of cells){
      const x=px+cx, y=py+cy;
      if(x<0||x>=COLS||y>=ROWS) return true;
      if(y>=0 && grid[y][x]) return true;
    }
    return false;
  }

  function merge(piece){
    for(const [cx,cy] of piece.cells){
      const x=piece.x+cx, y=piece.y+cy;
      if(y>=0) grid[y][x]=piece.color;
    }
  }

  function findFullRows(){
    const rows=[];
    for(let y=0;y<ROWS;y++) if(grid[y].every(c=>c)) rows.push(y);
    return rows;
  }

  // ---------- T-spin detection (3-corner rule) ----------
  function isFilledOrWall(x,y){
    if(x<0||x>=COLS||y>=ROWS) return true;
    if(y<0) return false;
    return !!grid[y][x];
  }
  function checkTSpin(piece){
    if(piece.type!=='T' || lastAction!=='rotate') return false;
    // pivot is local (1,1) for every T rotation state in this rotate() implementation
    const px=piece.x+1, py=piece.y+1;
    const corners=[[px-1,py-1],[px+1,py-1],[px-1,py+1],[px+1,py+1]];
    let filled=0;
    for(const [x,y] of corners) if(isFilledOrWall(x,y)) filled++;
    return filled>=3;
  }

  function addPopup(text,color){
    popups.push({text,color,startTime:performance.now(),duration:900});
  }

  function finishClear(rows, tspin){
    rows.sort((a,b)=>a-b);
    for(const y of rows){ grid.splice(y,1); grid.unshift(Array(COLS).fill(null)); }
    const cleared=rows.length;

    // combo
    if(cleared>0) combo++; else combo=-1;

    let points=0;
    let label=null;
    if(tspin){
      const tsTable=[100,800,1200,1600];
      points += tsTable[cleared]*level;
      label = cleared===0?'T-SPIN':
              cleared===1?'T-SPIN SINGLE':
              cleared===2?'T-SPIN DOUBLE':'T-SPIN TRIPLE';
      sfx.tspin();
    } else if(cleared>0){
      const table=[0,100,300,500,800];
      points += table[cleared]*level;
      label = cleared===4?'RETRO TETRIS':null;
      sfx.clear(cleared);
    }
    if(combo>0){
      points += 50*combo*level;
    }
    score += points;

    if(label) addPopup(label, tspin?'#ff2e97':'#f9c80e');
    else if(cleared>0 && combo<=0) {} // plain clear, no extra label
    if(combo>0) addPopup('COMBO x'+combo, '#2de2e6');

    lines+=cleared;
    if(cleared>0){
      level=1+Math.floor(lines/10);
      dropInterval=Math.max(120, 800-(level-1)*70);
    }

    const highKey=getHigh(mode);
    if(score>highKey) setHigh(mode,score);

    updateStats();

    if(mode==='sprint' && lines>=40){
      finishSprint();
    }
  }

  function finishSprint(){
    sprintRunning=false;
    gameOver=true;
    sfx.finish();
    const best=getBestSprint();
    const isNewBest = best===null || sprintElapsed<best;
    if(isNewBest) setBestSprint(sprintElapsed);
    showResult(
      'SELESAI!',
      'Waktu: '+formatTime(sprintElapsed)+(isNewBest?'  (REKOR BARU!)':'\nTerbaik: '+formatTime(best))
    );
    cancelAnimationFrame(animId);
  }

  function spawn(){
    fillQueue();
    current=queue.shift();
    fillQueue();
    current.x=3; current.y=-1;
    canHold=true;
    lastAction=null;
    drawNext();
    if(collides(current.cells,current.x,current.y)) triggerGameOver();
  }

  function doHold(){
    if(gameOver||paused||!canHold||inputLocked) return;
    sfx.hold();
    const type=current.type;
    if(holdPiece){
      current=makePiece(holdPiece);
      current.x=3; current.y=-1;
      if(collides(current.cells,current.x,current.y)){ triggerGameOver(); return; }
    } else {
      spawn();
    }
    holdPiece=type;
    canHold=false;
    lastAction=null;
    drawHold();
    draw();
  }

  function startClearSequence(rows,tspin){
    clearing={rows,tspin,startTime:performance.now(),duration:220};
    inputLocked=true;
  }

  function lockPiece(){
    const tspin=checkTSpin(current);
    merge(current);
    sfx.lock();
    const rows=findFullRows();
    if(rows.length>0){
      startClearSequence(rows,tspin);
    } else {
      if(tspin){ finishClear([],true); }
      else { combo=-1; updateStats(); }
      spawn();
    }
  }

  function tryMove(dx,dy,silent){
    if(gameOver||paused||inputLocked) return false;
    const nx=current.x+dx, ny=current.y+dy;
    if(!collides(current.cells,nx,ny)){
      current.x=nx; current.y=ny;
      if(dx!==0) lastAction='move';
      if(!silent && dx!==0) sfx.move();
      draw();
      return true;
    }
    if(dy>0){ lockPiece(); draw(); }
    return false;
  }

  function tryRotate(){
    if(gameOver||paused||inputLocked) return;
    const rotated=rotate(current);
    const kicks=[0,-1,1,-2,2];
    for(const k of kicks){
      if(!collides(rotated,current.x+k,current.y)){
        current.cells=rotated;
        current.x+=k;
        lastAction='rotate';
        sfx.rotate();
        draw();
        return;
      }
    }
  }

  function ghostY(){
    let gy=current.y;
    while(!collides(current.cells,current.x,gy+1)) gy++;
    return gy;
  }

  function hardDrop(){
    if(gameOver||paused||inputLocked) return;
    const target=ghostY();
    if(target===current.y){ lockPiece(); return; }
    const dist=target-current.y;
    score+=dist*2;
    updateStats();
    const duration=Math.min(220,Math.max(70,dist*11));
    dropAnim={fromY:current.y,toY:target,startTime:performance.now(),duration};
    inputLocked=true;
    if(dist>0){ lastAction='move'; }
    draw();
  }

  function easeOutQuad(t){ return 1-(1-t)*(1-t); }

  // ---------- drawing ----------
  function drawCell(c,x,y,cell,color,alpha){
    c.globalAlpha = alpha!==undefined ? alpha : 1;
    c.fillStyle=color;
    c.fillRect(x*cell,y*cell,cell-2,cell-2);
    c.strokeStyle='rgba(255,255,255,0.25)';
    c.lineWidth=1;
    c.strokeRect(x*cell+0.5,y*cell+0.5,cell-3,cell-3);
    c.fillStyle='rgba(255,255,255,0.18)';
    c.fillRect(x*cell,y*cell,cell-2,3);
    c.globalAlpha=1;
  }
  function drawGhostCell(c,x,y,cell){
    c.strokeStyle='rgba(255,255,255,0.35)';
    c.lineWidth=1.5;
    c.strokeRect(x*cell+2,y*cell+2,cell-6,cell-6);
  }

  function draw(){
    ctx.fillStyle='#070510';
    ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.strokeStyle='rgba(140,129,179,0.06)';
    for(let x=0;x<=COLS;x++){ ctx.beginPath(); ctx.moveTo(x*CELL,0); ctx.lineTo(x*CELL,ROWS*CELL); ctx.stroke(); }
    for(let y=0;y<=ROWS;y++){ ctx.beginPath(); ctx.moveTo(0,y*CELL); ctx.lineTo(COLS*CELL,y*CELL); ctx.stroke(); }

    let flashRows=null, flashAlpha=0;
    if(clearing){
      const t=Math.min(1,(performance.now()-clearing.startTime)/clearing.duration);
      flashRows=new Set(clearing.rows);
      flashAlpha=0.6+0.4*Math.sin(t*Math.PI*6);
      if(t>=1){
        finishClear(clearing.rows, clearing.tspin);
        clearing=null;
        inputLocked=false;
        if(!gameOver) spawn();
      }
    }

    for(let y=0;y<ROWS;y++){
      for(let x=0;x<COLS;x++){
        if(grid[y][x]){
          if(flashRows && flashRows.has(y)){
            ctx.fillStyle=`rgba(255,255,255,${flashAlpha})`;
            ctx.fillRect(x*CELL,y*CELL,CELL-2,CELL-2);
          } else {
            drawCell(ctx,x,y,CELL,grid[y][x]);
          }
        }
      }
    }

    if(current && !gameOver && !clearing){
      let renderY=current.y;
      if(dropAnim){
        const t=Math.min(1,(performance.now()-dropAnim.startTime)/dropAnim.duration);
        const eased=easeOutQuad(t);
        renderY=dropAnim.fromY+(dropAnim.toY-dropAnim.fromY)*eased;
        for(let g=1; g<=2; g++){
          const trailY=renderY-g*0.6;
          for(const [cx,cy] of current.cells){
            const yy=trailY+cy;
            if(yy>=0) drawCell(ctx,current.x+cx,yy,CELL,current.color,0.10/g);
          }
        }
        if(t>=1){
          current.y=dropAnim.toY;
          dropAnim=null;
          inputLocked=false;
          lockPiece();
          // lockPiece() may have swapped `current` to a brand new piece
          // (spawn) or started a clear sequence. Either way, the position
          // and shape captured above are now stale, so redraw fresh next
          // frame instead of rendering the old data below.
          draw();
          return;
        }
      } else {
        const gy=ghostY();
        for(const [cx,cy] of current.cells){
          const y=gy+cy;
          if(y>=0) drawGhostCell(ctx,current.x+cx,y,CELL);
        }
      }
      for(const [cx,cy] of current.cells){
        const y=renderY+cy;
        if(y>=-1) drawCell(ctx,current.x+cx,y,CELL,current.color);
      }
    }

    // floating popups
    if(popups.length){
      const now=performance.now();
      popups=popups.filter(p=>now-p.startTime<p.duration);
      ctx.textAlign='center';
      ctx.font='bold 13px "Courier New", monospace';
      popups.forEach((p,i)=>{
        const t=(now-p.startTime)/p.duration;
        const alpha=1-t;
        const riseY=canvas.height/2 - t*30 - i*16;
        ctx.globalAlpha=alpha;
        ctx.fillStyle=p.color;
        ctx.shadowColor=p.color;
        ctx.shadowBlur=8;
        ctx.fillText(p.text, canvas.width/2, riseY);
        ctx.shadowBlur=0;
        ctx.globalAlpha=1;
      });
    }

    if(mode==='sprint' && sprintRunning){
      sprintElapsed=performance.now()-sprintStart;
      document.getElementById('sprint-time').textContent=formatTime(sprintElapsed);
    }

    if(clearing||dropAnim||popups.length){
      animId=requestAnimationFrame(draw);
    }
  }

  function drawMiniPiece(c,cvs,type,offsetY){
    if(!type) return;
    const cell=18;
    const shape=SHAPES[type];
    const xs=shape.map(p=>p[0]), ys=shape.map(p=>p[1]);
    const minX=Math.min(...xs), minY=Math.min(...ys), maxX=Math.max(...xs);
    const w=(maxX-minX+1)*cell;
    const offX=(cvs.width-w)/2 - minX*cell;
    for(const [cx,cy] of shape){
      c.fillStyle=COLORS[type];
      c.fillRect(offX+cx*cell, offsetY+(cy-minY)*cell, cell-2, cell-2);
      c.fillStyle='rgba(255,255,255,0.2)';
      c.fillRect(offX+cx*cell, offsetY+(cy-minY)*cell, cell-2, 3);
    }
  }
  function drawNext(){
    nctx.fillStyle='#0d0a16';
    nctx.fillRect(0,0,nextCanvas.width,nextCanvas.height);
    queue.slice(0,3).forEach((p,i)=>drawMiniPiece(nctx,nextCanvas,p.type,i*70+10));
  }
  function drawHold(){
    hctx.fillStyle='#0d0a16';
    hctx.fillRect(0,0,holdCanvas.width,holdCanvas.height);
    drawMiniPiece(hctx,holdCanvas,holdPiece,15);
  }

  function formatTime(ms){
    const m=Math.floor(ms/60000);
    const s=Math.floor((ms%60000)/1000);
    const cs=Math.floor((ms%1000)/10);
    return String(m).padStart(2,'0')+':'+String(s).padStart(2,'0')+'.'+String(cs).padStart(2,'0');
  }

  function updateStats(){
    document.getElementById('score').textContent=score;
    document.getElementById('high').textContent=getHigh(mode);
    document.getElementById('level').textContent=level;
    document.getElementById('lines').textContent = mode==='sprint' ? lines+'/40' : lines;
    document.getElementById('combo').textContent = combo>0 ? ('x'+combo) : '-';
  }

  function triggerGameOver(){
    gameOver=true;
    sprintRunning=false;
    const highKey=getHigh(mode);
    if(score>highKey) setHigh(mode,score);
    sfx.over();
    showResult('GAME OVER','Skor akhir: '+score+'\nTertinggi: '+getHigh(mode));
    updateStats();
    cancelAnimationFrame(animId);
  }

  function showResult(title,sub){
    document.getElementById('overlay-title').textContent=title;
    document.getElementById('overlay-sub').textContent=sub;
    document.getElementById('mode-buttons').style.display='none';
    document.getElementById('result-buttons').style.display='flex';
    document.getElementById('overlay').classList.add('show');
  }

  function togglePause(){
    if(gameOver) return;
    paused=!paused;
    if(paused){
      pauseStartedAt=performance.now();
      showResult('JEDA','Tekan lanjut untuk kembali bermain');
      document.getElementById('restart-btn').textContent='LANJUT';
    } else {
      if(mode==='sprint' && sprintRunning){
        sprintStart += performance.now()-pauseStartedAt;
      }
      document.getElementById('overlay').classList.remove('show');
      document.getElementById('restart-btn').textContent='MAIN LAGI';
      lastTime=performance.now();
      animId=requestAnimationFrame(loop);
      draw();
    }
  }

  function loop(t){
    if(gameOver||paused) return;
    if(!lastTime) lastTime=t;
    const delta=t-lastTime;
    if(delta>dropInterval && !inputLocked){
      tryMove(0,1,true);
      lastTime=t;
    }
    if(mode==='sprint' && sprintRunning){
      sprintElapsed=performance.now()-sprintStart;
      document.getElementById('sprint-time').textContent=formatTime(sprintElapsed);
    }
    animId=requestAnimationFrame(loop);
  }

  function beginGame(selectedMode){
    mode=selectedMode;
    document.getElementById('mode-label').textContent = mode==='sprint' ? 'SPRINT 40' : 'MARATHON';
    sprintPanel.style.display = mode==='sprint' ? 'block' : 'none';
    if(mode==='sprint'){
      const best=getBestSprint();
      document.getElementById('sprint-best').textContent = best!==null ? formatTime(best) : '-';
      document.getElementById('sprint-time').textContent='00:00.00';
    }

    grid=newGrid();
    score=0; level=1; lines=0; combo=-1;
    holdPiece=null; canHold=true;
    dropInterval=800;
    gameOver=false; paused=false; inputLocked=false;
    clearing=null; dropAnim=null; popups=[];
    lastTime=0;
    bag=[]; queue=[];

    document.getElementById('overlay').classList.remove('show');
    document.getElementById('mode-buttons').style.display='flex';
    document.getElementById('result-buttons').style.display='none';
    document.getElementById('restart-btn').textContent='MAIN LAGI';

    spawn();
    updateStats();
    drawHold();

    if(mode==='sprint'){
      sprintStart=performance.now();
      sprintElapsed=0;
      sprintRunning=true;
    } else {
      sprintRunning=false;
    }

    draw();
    cancelAnimationFrame(animId);
    animId=requestAnimationFrame(loop);
  }

  function showMenu(){
    gameOver=true; paused=false; sprintRunning=false;
    cancelAnimationFrame(animId);
    document.getElementById('overlay-title').textContent='RETRO STACK';
    document.getElementById('overlay-sub').textContent='Pilih mode permainan';
    document.getElementById('mode-buttons').style.display='flex';
    document.getElementById('result-buttons').style.display='none';
    document.getElementById('overlay').classList.add('show');
  }

  // ---------- input ----------
  document.addEventListener('keydown',(e)=>{
    if(['ArrowLeft','ArrowRight','ArrowDown','ArrowUp',' ','p','P','c','C','m','M'].includes(e.key)) e.preventDefault();
    if(e.key==='p'||e.key==='P'){ togglePause(); return; }
    if(e.key==='m'||e.key==='M'){ soundOn=!soundOn; return; }
    if(gameOver||paused) return;
    if(e.key==='ArrowLeft') tryMove(-1,0);
    else if(e.key==='ArrowRight') tryMove(1,0);
    else if(e.key==='ArrowDown') tryMove(0,1);
    else if(e.key==='ArrowUp') tryRotate();
    else if(e.key===' '){ hardDrop(); cabinet.classList.add('shake'); setTimeout(()=>cabinet.classList.remove('shake'),180); }
    else if(e.key==='c'||e.key==='C') doHold();
  });

  document.getElementById('mode-marathon').addEventListener('click',()=>beginGame('marathon'));
  document.getElementById('mode-sprint').addEventListener('click',()=>beginGame('sprint'));
  document.getElementById('restart-btn').addEventListener('click',()=>{
    if(paused && !gameOver){ togglePause(); }
    else { beginGame(mode); }
  });
  document.getElementById('menu-btn').addEventListener('click', showMenu);

  function bind(id,fn){ document.getElementById(id).addEventListener('click',fn); }
  bind('t-left',()=>tryMove(-1,0));
  bind('t-right',()=>tryMove(1,0));
  bind('t-down',()=>tryMove(0,1));
  bind('t-rotate',()=>tryRotate());
  bind('t-drop',()=>{ hardDrop(); cabinet.classList.add('shake'); setTimeout(()=>cabinet.classList.remove('shake'),180); });
  bind('t-pause',()=>togglePause());
  bind('t-hold',()=>doHold());

  // initial idle board render behind the menu
  grid=newGrid();
  score=0; level=1; lines=0;
  ctx.fillStyle='#070510';
  ctx.fillRect(0,0,canvas.width,canvas.height);
})();
