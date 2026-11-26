
(() => {
  "use strict";
  const strings = [
    {n:6, open:"E", notes:["E","F","F#","G","G#"], writtenOct:3},
    {n:5, open:"A", notes:["A","A#","B","C","C#"], writtenOct:3},
    {n:4, open:"D", notes:["D","D#","E","F","F#"], writtenOct:4},
    {n:3, open:"G", notes:["G","G#","A","A#","B"], writtenOct:4},
    {n:2, open:"B", notes:["B","C","C#","D","D#"], writtenOct:4},
    {n:1, open:"E", notes:["E","F","F#","G","G#"], writtenOct:5}
  ];
  const positions = strings.flatMap(s => s.notes.map((note,fret)=>({
    id:`${s.n}-${fret}`, note, string:s.n, fret,
    label:`${note}${s.n} (${fret===0?"Open":`${fret}${ordinal(fret)} fret`})`,
    // Guitar notation is conventionally written one octave above sounding pitch.
    letter: note.replace("#",""), accidental: note.includes("#") ? "#" : "",
    octave: Math.floor((baseMidi(s.n) + fret) / 12) - 1
  })));
  function ordinal(n){return n===1?"st":n===2?"nd":n===3?"rd":"th"}
  const semis=["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
  function noteIndex(n){return semis.indexOf(n)}
  function baseMidi(stringNo){return ({6:52,5:57,4:62,3:67,2:71,1:76})[stringNo]}
  const $=id=>document.getElementById(id);
  const STORE="guitar-note-trainer-v1";
  let data=load(), current=null, selected=null, answered=false, questionNo=0;
  function load(){try{return Object.assign({attempts:0,correct:0,streak:0,byPos:{}},JSON.parse(localStorage.getItem(STORE)||"{}"))}catch{return {attempts:0,correct:0,streak:0,byPos:{}}}}
  function save(){localStorage.setItem(STORE,JSON.stringify(data))}
  function renderStats(){
    $("score").textContent=data.attempts;
    $("correctCount").textContent=data.correct;
    $("accuracy").textContent=data.attempts?`${Math.round(data.correct/data.attempts*100)}%`:"—";
    const weak=positions.map(p=>({p,s:data.byPos[p.id]||{seen:0,miss:0}}))
      .filter(x=>x.s.seen>0).sort((a,b)=>(b.s.miss/Math.max(1,b.s.seen))-(a.s.miss/Math.max(1,a.s.seen)) || b.s.miss-a.s.miss).slice(0,6);
    $("weakList").innerHTML=weak.length?weak.map(x=>`<div class="weak-row"><span>${x.p.label}</span><span>${x.s.miss} missed / ${x.s.seen} seen</span></div>`).join(""):'<div class="muted">Answer a few questions to build your report.</div>';
  }
  function staffSVG(p){
    // Standard treble-clef staff. Guitar notes are written an octave above sounding pitch.
    // Staff bottom line is E4; diatonic positions are calculated from E4.
    const letterOrder=["C","D","E","F","G","A","B"];
    const diatonic=(letter,oct)=>oct*7+letterOrder.indexOf(letter);
    const target=diatonic(p.letter,p.octave);
    const bottom=diatonic("E",4);
    const steps=target-bottom; // half-space steps
    const y=151-steps*15;
    const lineYs=[151,121,91,61,31];
    const ledger=[];
    if(y>151){for(let ly=181;ly<=y;ly+=30) ledger.push(`<line x1="145" y1="${ly}" x2="255" y2="${ly}" stroke="#333" stroke-width="1.5"/>`)}
    // Above the staff, ledger lines sit on A5, C6, E6...;
    // G5 is the space immediately above the top F5 line and needs no ledger line.
    if(y<31){for(let ly=1;ly>=y;ly-=30) ledger.push(`<line x1="145" y1="${ly}" x2="255" y2="${ly}" stroke="#333" stroke-width="1.5"/>`)}
    const accidental=p.accidental?`<text x="164" y="${y+6}" text-anchor="middle" font-size="27" fill="#222">♯</text>`:"";
    // Circled string marker is standard guitar notation and disambiguates the one repeated pitch (B4).
    const marker=(p.note==="B" && ((p.string===2 && p.fret===0)||(p.string===3 && p.fret===4)))?`<circle cx="278" cy="${y-18}" r="10" fill="none" stroke="#333" stroke-width="1.5"/><text x="278" y="${y-14}" text-anchor="middle" font-size="12" fill="#222">${p.string}</text>`:"";
    return `<svg viewBox="0 0 400 280" role="img" aria-label="Treble clef note on a five-line staff">
      <rect width="400" height="205" rx="8" fill="#f7f5ef"/>
      ${lineYs.map(ly=>`<line x1="80" y1="${ly}" x2="330" y2="${ly}" stroke="#333" stroke-width="1.7"/>`).join("")}
      ${ledger.join("")}
      <text x="92" y="137" font-family="serif" font-size="112" fill="#222">𝄞</text>
      ${accidental}
      <ellipse cx="220" cy="${y}" rx="10" ry="7" transform="rotate(-18 220 ${y})" fill="#171717"/>
      ${y>=91?`<line x1="229" y1="${y}" x2="229" y2="${y-47}" stroke="#171717" stroke-width="2"/>`:`<line x1="211" y1="${y}" x2="211" y2="${y+47}" stroke="#171717" stroke-width="2"/>`}
      ${marker}
    </svg>`;
  }
  function renderCatalog(){
    const filter=$("catalogFilter").value;
    const shown=positions.filter(p=>filter==="all" || String(p.string)===filter);
    $("catalogCount").textContent=`${shown.length} positions`;
    $("catalogGrid").innerHTML=shown.map(p=>{
      const fretText=p.fret===0?"Open":`${p.fret}${ordinal(p.fret)} fret`;
      return `<article class="catalog-item">
        ${staffSVG(p)}
        <div class="catalog-label">${p.label}</div>
        <div class="catalog-detail">String ${p.string} · ${fretText}</div>
      </article>`;
    }).join("");
  }
  const notePool=[...new Set(positions.map(p=>p.note))];
  let currentNote=null, targetPositions=[], selectedIds=new Set();
  function weightedTarget(){
    if($("mode").value==="all") return notePool[Math.floor(Math.random()*notePool.length)];
    const weighted=notePool.map(note=>{
      const group=positions.filter(p=>p.note===note);
      const weight=group.reduce((sum,p)=>{
        const st=data.byPos[p.id]||{seen:0,miss:0};
        return sum+1+(st.miss*2)+(st.seen===0?0.7:0);
      },0);
      return {note,weight};
    });
    const total=weighted.reduce((n,x)=>n+x.weight,0);let r=Math.random()*total;
    for(const x of weighted){r-=x.weight;if(r<=0)return x.note}
    return weighted[0].note;
  }
  function renderFretboard(){
    const grid=$("fretboard");
    const headers=["STRING","OPEN","FRET 1","FRET 2","FRET 3","FRET 4"];
    grid.innerHTML=headers.map((h,i)=>`<div class="fret-head">${h}</div>`).join("");
    for(let stringNo=1;stringNo<=6;stringNo++){
      const stringPositions=positions.filter(p=>p.string===stringNo).sort((a,b)=>a.fret-b.fret);
      const openNote=stringPositions[0].note;
      const sh=document.createElement("div");sh.className="string-head";
      sh.innerHTML=`<b>${stringNo}</b><small>${openNote}</small>`;grid.appendChild(sh);
      stringPositions.forEach(p=>{
        const btn=document.createElement("button");btn.type="button";btn.className="fret-cell";
        btn.dataset.pos=p.id;btn.setAttribute("aria-label",`${p.label}, string ${p.string}, ${p.fret===0?"open":`fret ${p.fret}`}`);
        btn.innerHTML=`<span class="pick"></span><span class="pitch">${p.note}</span><span class="position">${p.note}${p.string}</span>`;
        btn.addEventListener("click",()=>{
          if(answered)return;
          if(selectedIds.has(p.id)){selectedIds.delete(p.id);btn.classList.remove("selected")}
          else{selectedIds.add(p.id);btn.classList.add("selected")}
          $("next").disabled=selectedIds.size===0;
        });
        grid.appendChild(btn);
      });
    }
  }
  function newQuestion(){
    currentNote=weightedTarget();
    targetPositions=positions.filter(p=>p.note===currentNote);
    selectedIds=new Set();answered=false;questionNo++;
    $("targetNote").textContent=currentNote;
    $("questionCount").textContent=`Question ${questionNo}`;
    $("modeLabel").textContent=$("mode").value==="weak"?"Weak positions first":"All note names";
    $("feedback").className="feedback";$("feedback").textContent="";
    $("next").textContent="Submit positions";$("next").disabled=true;
    $("skip").disabled=false;
    renderFretboard();
  }
  function submit(){
    if(!answered){
      if(selectedIds.size===0)return;
      answered=true;data.attempts++;
      const targetSet=new Set(targetPositions.map(p=>p.id));
      const exact=[...targetSet].every(id=>selectedIds.has(id)) && [...selectedIds].every(id=>targetSet.has(id));
      targetPositions.forEach(p=>{
        const bucket=data.byPos[p.id]||(data.byPos[p.id]={seen:0,miss:0});
        bucket.seen++;
        if(!selectedIds.has(p.id))bucket.miss++;
      });
      [...selectedIds].filter(id=>!targetSet.has(id)).forEach(id=>{
        const bucket=data.byPos[id]||(data.byPos[id]={seen:0,miss:0});
        bucket.seen++;bucket.miss++;
      });
      if(exact){data.correct++;data.streak++}else data.streak=0;
      document.querySelectorAll(".fret-cell").forEach(btn=>{
        btn.disabled=true;
        const id=btn.dataset.pos;
        if(targetSet.has(id))btn.classList.add(selectedIds.has(id)?"correct":"missed");
        else if(selectedIds.has(id))btn.classList.add("wrong");
      });
      const answerList=targetPositions.map(p=>p.label).join(" · ");
      $("feedback").className=`feedback show ${exact?"good":"bad"}`;
      $("feedback").textContent=`${exact?"Perfect! All positions found.":"Not quite. The correct positions are:"} ${answerList}.`;
      $("next").textContent="Next question";save();renderStats();
    }else newQuestion();
  }
  $("toggleCatalog").addEventListener("click",()=>{
    const panel=$("catalogPanel");
    panel.hidden=!panel.hidden;
    $("toggleCatalog").textContent=panel.hidden?"Show all 30 notations":"Hide notation reference";
    if(!panel.hidden) renderCatalog();
  });
  $("catalogFilter").addEventListener("change",renderCatalog);
  $("next").addEventListener("click",submit);
  $("skip").addEventListener("click",()=>{if(!answered){newQuestion()}});
  $("mode").addEventListener("change",()=>{newQuestion();$("modeHelp").textContent=$("mode").value==="weak"?"Questions are weighted toward note names containing positions you miss or have not practised enough.":"Questions are randomized across all 12 note names found in the first 30 positions."});
  $("reset").addEventListener("click",()=>{if(confirm("Reset all practice statistics on this device?")){data={attempts:0,correct:0,streak:0,byPos:{}};save();renderStats();newQuestion()}});
  renderStats();newQuestion();
  if("serviceWorker" in navigator && location.protocol.startsWith("http")) window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js").catch(()=>{}));
})();
