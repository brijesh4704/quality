/* QICS front-end logic implementing login, upload, VIN fetch, DPC, RSP, charts, defects */

// --------------------- Utilities ---------------------
function formatDate(d){ const y=d.getFullYear(), m=('0'+(d.getMonth()+1)).slice(-2), dd=('0'+d.getDate()).slice(-2); return `${y}-${m}-${dd}`; }
function parseDate(s){ return new Date(s+'T00:00:00'); }

// --------------------- LOGIN & DASHBOARD ---------------------
document.addEventListener('DOMContentLoaded', ()=>{
  const loginForm = document.getElementById('loginForm');
  if(loginForm){
    loginForm.addEventListener('submit', e=>{
      e.preventDefault();
      const username = document.getElementById('username').value || 'User';
      localStorage.setItem('qicsUser', username);
      window.location.href = './dashboard.html'; // fixed path
    });
  }

  const welcome = document.getElementById('welcomeUser');
  if(welcome){
    const user = localStorage.getItem('qicsUser');
    if(!user){ window.location.href = './index.html'; return; }
    welcome.textContent = `Welcome, ${user}`;
    const logoutBtn = document.getElementById('logoutBtn');
    if(logoutBtn) logoutBtn.addEventListener('click', ()=>{ localStorage.removeItem('qicsUser'); window.location.href='./index.html'; });
    loadDpcTable();
    renderTrendChart();
    loadDefaultRsp();
  }
});

// --------------------- Tabs ---------------------
function showTab(tabId){
  document.querySelectorAll('main').forEach(m=>m.style.display='none');
  document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
  document.getElementById(tabId).style.display='block';
  document.querySelector(`.tab-btn[onclick="showTab('${tabId}')"]`).classList.add('active');
}

// --------------------- Multiple Check Sheets ---------------------
function readFilesAsDataURLs(files){
  const promises = Array.from(files).map(f=>{
    return new Promise((res,rej)=>{
      const reader = new FileReader();
      reader.onload = ()=>res({name:f.name, dataUrl:reader.result});
      reader.onerror = rej;
      reader.readAsDataURL(f);
    });
  });
  return Promise.all(promises);
}

function uploadSheets(){
  const vin = document.getElementById('uploadVin').value.trim();
  const filesInput = document.getElementById('files');
  const status = document.getElementById('uploadStatus');
  if(!vin){ status.innerHTML = `<span style="color:#c0392b">Please enter VIN.</span>`; return; }
  if(!filesInput.files.length){ status.innerHTML = `<span style="color:#c0392b">No files selected.</span>`; return; }

  readFilesAsDataURLs(filesInput.files).then(list=>{
    const store = JSON.parse(localStorage.getItem('qics_files')||'{}');
    store[vin] = store[vin] || [];
    const now = new Date().toISOString();
    list.forEach(item => store[vin].push({name:item.name, dataUrl:item.dataUrl, uploadedAt:now}));
    localStorage.setItem('qics_files', JSON.stringify(store));
    status.innerHTML = `<span style="color:green">${list.length} file(s) uploaded for VIN ${vin}.</span>`;
    filesInput.value = '';
  }).catch(err=>{ console.error(err); status.innerHTML = `<span style="color:#c0392b">Upload failed.</span>`; });
}

function listFilesForVin(){
  const vin = document.getElementById('listVin').value.trim();
  const container = document.getElementById('filesList'); container.innerHTML = '';
  if(!vin){ container.innerHTML = `<div style="color:#c0392b">Enter a VIN to list files.</div>`; return; }
  const store = JSON.parse(localStorage.getItem('qics_files')||'{}');
  const arr = store[vin] || [];
  if(!arr.length){ container.innerHTML = `<div>No files stored for ${vin}</div>`; return; }
  arr.forEach((f,idx)=>{
    const div = document.createElement('div'); div.className='file-item';
    let preview = f.dataUrl && f.dataUrl.startsWith('data:image') ? `<img src="${f.dataUrl}" alt="${f.name}" />` :
      `<div style="width:48px;height:48px;display:flex;align-items:center;justify-content:center;background:#eef2ff;border-radius:6px">DOC</div>`;
    div.innerHTML = `${preview}<div style="flex:1">
      <div style="font-weight:600">${f.name}</div>
      <div style="font-size:12px;color:#556">${new Date(f.uploadedAt).toLocaleString()}</div>
      <div style="margin-top:6px">
        <a href="${f.dataUrl}" target="_blank" class="btn ghost" style="padding:6px 8px">View</a>
        <button class="btn" onclick="deleteFile('${vin}', ${idx})" style="padding:6px 8px;background:#ff6b6b;margin-left:6px">Delete</button>
      </div></div>`;
    container.appendChild(div);
  });
}

function deleteFile(vin, idx){
  if(!confirm('Delete this file?')) return;
  const store = JSON.parse(localStorage.getItem('qics_files')||'{}');
  if(!store[vin]) return;
  store[vin].splice(idx,1);
  localStorage.setItem('qics_files', JSON.stringify(store));
  listFilesForVin();
}

// --------------------- VIN-wise Fetch (Demo) ---------------------
function fetchVINData(){
  const vin = document.getElementById('vinSearchInput').value.trim();
  const container = document.getElementById('vinData'); container.innerHTML = '';
  if(!vin){ container.innerHTML = `<div style="color:#c0392b">Enter VIN to search</div>`; return; }
  const demoDocs=[{type:'CVIC',name:'cvic_report.pdf'},{type:'Double Check',name:'doublecheck.jpg'},{type:'Port Return',name:'portreturn.pdf'}];
  const store = JSON.parse(localStorage.getItem('qics_files')||'{}');
  const uploaded = store[vin]||[];
  let html = `<h3>Documents for ${vin}</h3><ul>`;
  demoDocs.forEach(d=> html += `<li>${d.type} — ${d.name}</li>`);
  uploaded.forEach(u=> html += `<li>Additional — ${u.name} <small style="color:#667">${new Date(u.uploadedAt).toLocaleString()}</small></li>`);
  html += `</ul>`; container.innerHTML = html;
}

// --------------------- DPC Table ---------------------
function loadDpcTable() {
  const tbody = document.querySelector('#dpcTable tbody');
  tbody.innerHTML = '<tr><td colspan="4">Loading...</td></tr>';

  fetch('/api/dpc-monitoring?from=2025-08-01&to=2025-08-23')
    .then(response => response.json())
    .then(result => {
      tbody.innerHTML = '';
      if (!result.data || result.data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4">No data available</td></tr>';
        return;
      }
      result.data.forEach(row => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${row.vin}</td>
          <td>${row.model}</td>
          <td>${row.dpc_target}%</td>
          <td>${row.dpc_actual.toFixed(1)}%</td>
        `;
        tbody.appendChild(tr);
      });
    })
    .catch(error => {
      console.error('Error loading DPC data:', error);
      tbody.innerHTML = '<tr><td colspan="4" style="color:red">Failed to load data</td></tr>';
    });
}

// --------------------- RSP Achievement ---------------------
function loadDefaultRsp(){
  const to=new Date(); const from=new Date(); from.setDate(to.getDate()-6);
  document.getElementById('rspFrom').value=formatDate(from);
  document.getElementById('rspTo').value=formatDate(to);
  loadRspAchievement();
}

function loadRspAchievement(){
  const fromStr=document.getElementById('rspFrom').value;
  const toStr=document.getElementById('rspTo').value;
  const container=document.getElementById('rspResult');
  if(!fromStr||!toStr){ container.innerHTML=`<span style="color:#c0392b">Select both dates</span>`; return; }
  const from=parseDate(fromStr), to=parseDate(toStr);
  if(from>to){ container.innerHTML=`<span style="color:#c0392b">From must be <= To</span>`; return; }
  const rows=[]; let cur=new Date(from);
  while(cur<=to){
    const target=95+(Math.floor(Math.random()*3));
    const actual=target-Math.floor(Math.random()*4);
    rows.push({date:formatDate(cur), target, actual});
    cur.setDate(cur.getDate()+1);
  }
  const cumTarget=rows.reduce((s,r)=>s+r.target,0);
  const cumActual=rows.reduce((s,r)=>s+r.actual,0);
  const achievement=((cumActual/cumTarget)*100).toFixed(2);
  let html=`<div><strong>Cumulative (${rows.length} days)</strong></div>`;
  html+=`<div class="box"><b>Total Target Sum:</b> ${cumTarget} &nbsp;&nbsp; <b>Total Actual Sum:</b> ${cumActual} &nbsp;&nbsp; <b>Achievement:</b> ${achievement}%</div>`;
  html+=`<table style="margin-top:10px"><thead><tr><th>Date</th><th>Target</th><th>Actual</th></tr></thead><tbody>`;
  rows.forEach(r=> html+=`<tr><td>${r.date}</td><td>${r.target}%</td><td>${r.actual}%</td></tr>`);
  html+=`</tbody></table>`; container.innerHTML=html;
}

// --------------------- Trend Chart ---------------------
function getLast3MonthsLabels(){
  const labels=[]; const now=new Date();
  for(let i=2;i>=0;i--){ const d=new Date(now.getFullYear(), now.getMonth()-i, 1); labels.push(d.toLocaleString('default',{month:'short',year:'numeric'})); }
  return labels;
}

function renderTrendChart(){
  const ctx=document.getElementById('trendChart'); if(!ctx) return;
  const labels=getLast3MonthsLabels();
  function rndBase(){ return 90+Math.floor(Math.random()*8); }
  const dpc=labels.map(()=>rndBase()), rsp=labels.map(()=>rndBase()-3), spr=labels.map(()=>rndBase()-6);
  new Chart(ctx,{type:'line',data:{labels,datasets:[
    {label:'DPC (%)', data:dpc, borderColor:'#0b59c6', tension:0.3, fill:false},
    {label:'RSP (%)', data:rsp, borderColor:'#2ca02c', tension:0.3, fill:false},
    {label:'SPR (%)', data:spr, borderColor:'#ff8c00', tension:0.3, fill:false}
  ]}, options:{responsive:true, plugins:{legend:{position:'top'}}, scales:{y:{beginAtZero:false}}}});
}

// --------------------- Defect Comparison ---------------------
function isWeekend(d){ const day=d.getDay(); return day===0||day===6; }
function parseHolidays(txt){ return !txt? new Set() : new Set(txt.split(',').map(s=>s.trim()).filter(Boolean)); }
function getLastWorkingDay(referenceDate, holidaySet){
  let d=new Date(referenceDate); d.setDate(d.getDate()-1);
  while(true){ const s=formatDate(d); if(!isWeekend(d)&&!holidaySet.has(s)) return d; d.setDate(d.getDate()-1); }
}

function compareDefects(){
  const holidaysTxt=document.getElementById('holidays').value.trim();
  const holidaySet=parseHolidays(holidaysTxt);
  const refInput=document.getElementById('refDate').value;
  const refDate=refInput?parseDate(refInput):new Date();
  const lastWorking=getLastWorkingDay(refDate,holidaySet);
  const defectTypes=['Paint','Engine','Trim','Electrical'];
  function rand(n){ return Math.floor(Math.random()*n); }
  const todayCounts={}, lastCounts={};
  defectTypes.forEach(t=>{ todayCounts[t]=rand(8); lastCounts[t]=rand(8); });
  const container=document.getElementById('defectComparison');
  let html=`<div><b>Reference Date:</b> ${formatDate(refDate)} &nbsp;&nbsp; <b>Last working day:</b> ${formatDate(lastWorking)}</div>`;
  html+=`<table style="margin-top:10px"><thead><tr><th>Defect Type</th><th>${formatDate(lastWorking)}</th><th>${formatDate(refDate)}</th><th>Diff</th></tr></thead><tbody>`;
  defectTypes.forEach(t=>{
    const a=lastCounts[t], b=todayCounts[t], diff=b-a;
    const diffStr=diff===0?'0':(diff>0?`+${diff}`:`${diff}`);
    html+=`<tr><td>${t}</td><td>${a}</td><td>${b}</td><td>${diffStr}</td></tr>`;
  });
  html+=`</tbody></table>`; container.innerHTML=html;
}

// --------------------- Quality Documents (DMS Integration) ---------------------
function searchQualityDocs(){
  const vin=document.getElementById('qdVinInput').value.trim();
  const container=document.getElementById('qdResults');
  if(!vin){ container.innerHTML=`<span style="color:#c0392b">Enter VIN</span>`; return; }

  fetch(`/api/dms/search?vin=${encodeURIComponent(vin)}`)
    .then(res=>res.json())
    .then(data=>{
      if(!data.docs || !data.docs.length){
        container.innerHTML=`<div>No documents found for VIN ${vin}</div>`;
        return;
      }
      let html='<h3>Documents Found:</h3><ul>';
      data.docs.forEach(d=>{
        html+=`<li><b>${d.title}</b> (${d.type}) — <a href="${d.url}" target="_blank">Open</a></li>`;
      });
      html+='</ul>'; container.innerHTML=html;
    })
    .catch(()=>container.innerHTML=`<span style="color:#c0392b">Failed to fetch documents</span>`);
}
// --------------------- CSV Utility ---------------------
function downloadCSV(filename, rows) {
  const csvContent = rows.map(r => r.map(x => `"${x}"`).join(",")).join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
}

// --------------------- Export RSP CSV ---------------------
function exportRSPToCSV() {
  const table=document.querySelector('#rspResult table');
  if(!table){ alert("No RSP data to export."); return; }
  const rows=[...table.querySelectorAll('tr')].map(tr=>[...tr.children].map(td=>td.innerText));
  downloadCSV("RSP_Achievement.csv", rows);
}

// --------------------- Export DPC CSV ---------------------
function exportDPCToCSV() {
  const table=document.getElementById('dpcTable');
  const rows=[...table.querySelectorAll('tr')].map(tr=>[...tr.children].map(td=>td.innerText));
  if(rows.length<=1){ alert("No DPC data to export."); return; }
  downloadCSV("DPC_Monitoring.csv", rows);
}

// --------------------- PDF Utility ---------------------
function downloadPDF(title, headers, rows, filename){
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text(title,14,15);
  doc.autoTable({head:[headers],body:rows,startY:25,theme:'grid'});
  doc.save(filename);
}

// --------------------- Export RSP PDF ---------------------
function exportRSPToPDF(){
  const table=document.querySelector('#rspResult table');
  if(!table){ alert("No RSP data to export."); return; }
  const headers=[...table.querySelectorAll('thead th')].map(th=>th.innerText);
  const rows=[...table.querySelectorAll('tbody tr')].map(tr=>[...tr.children].map(td=>td.innerText));
  downloadPDF("RSP Achievement",headers,rows,"RSP_Achievement.pdf");
}

// --------------------- Export DPC PDF ---------------------
function exportDPCToPDF(){
  const table=document.getElementById('dpcTable');
  const headers=[...table.querySelectorAll('thead th')].map(th=>th.innerText);
  const rows=[...table.querySelectorAll('tbody tr')].map(tr=>[...tr.children].map(td=>td.innerText));
  if(rows.length<=0){ alert("No DPC data to export."); return; }
  downloadPDF("DPC Monitoring",headers,rows,"DPC_Monitoring.pdf");
}

// --------------------- ZIP Export (All Reports) ---------------------
async function downloadAllReports(){
  const zip = new JSZip();

  // RSP Data
  const rspTable=document.querySelector('#rspResult table');
  if(rspTable){
    const headers=[...rspTable.querySelectorAll('thead th')].map(th=>th.innerText);
    const rows=[...rspTable.querySelectorAll('tbody tr')].map(tr=>[...tr.children].map(td=>td.innerText));
    zip.file("RSP_Achievement.csv",[headers,...rows].map(r=>r.join(",")).join("\n"));
    const { jsPDF }=window.jspdf;const docRSP=new jsPDF();
    docRSP.setFontSize(16);docRSP.text("RSP Achievement",14,15);
    docRSP.autoTable({head:[headers],body:rows,startY:25,theme:'grid'});
    zip.file("RSP_Achievement.pdf",docRSP.output("blob"));
  }

  // DPC Data
  const dpcTable=document.getElementById('dpcTable');
  if(dpcTable && dpcTable.querySelectorAll('tbody tr').length>0){
    const headers=[...dpcTable.querySelectorAll('thead th')].map(th=>th.innerText);
    const rows=[...dpcTable.querySelectorAll('tbody tr')].map(tr=>[...tr.children].map(td=>td.innerText));
    zip.file("DPC_Monitoring.csv",[headers,...rows].map(r=>r.join(",")).join("\n"));
    const docDPC=new jsPDF();docDPC.setFontSize(16);docDPC.text("DPC Monitoring",14,15);
    docDPC.autoTable({head:[headers],body:rows,startY:25,theme:'grid'});
    zip.file("DPC_Monitoring.pdf",docDPC.output("blob"));
  }

  if(Object.keys(zip.files).length===0){alert("No data to export.");return;}
  const content=await zip.generateAsync({type:"blob"});
  const a=document.createElement("a");
  a.href=URL.createObjectURL(content);
  a.download="QICS_All_Reports.zip";
  a.click();
}
// --------------------- CSV Parser ---------------------
function parseCSV(text) {
  return text.trim().split("\n").map(row => row.split(","));
}

// --------------------- Load from Local CSV ---------------------
function loadCSVFile(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    const csv = parseCSV(e.target.result);
    populateDpcTable(csv);
    alert("CSV Data Loaded Successfully!");
  };
  reader.readAsText(file);
}

// --------------------- Load from Database API ---------------------
async function loadDpcFromAPI() {
  try {
    const response = await fetch('/api/dpc-data'); // Replace with your real endpoint
    if (!response.ok) throw new Error("Failed to fetch data from server.");
    const text = await response.text();
    const csv = parseCSV(text);
    populateDpcTable(csv);
    alert("Data Loaded from Database!");
  } catch (err) {
    alert("Error loading data: " + err.message);
  }
}

// --------------------- Populate DPC Table ---------------------
function populateDpcTable(csv) {
  const tbody = document.querySelector("#dpcTable tbody");
  tbody.innerHTML = "";
  for (let i = 1; i < csv.length; i++) {
    const row = csv[i];
    if (row.length >= 4) {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${row[0]}</td><td>${row[1]}</td><td>${row[2]}</td><td>${row[3]}</td>`;
      tbody.appendChild(tr);
    }
  }
}

// ================= DPC Chart =================
async function loadDpcData() {
  const response = await fetch("http://127.0.0.1:5000/api/dpc");
  const data = await response.json();

  const labels = data.map(r => r.date);
  const target = data.map(r => r.target);
  const actual = data.map(r => r.actual);

  new Chart(document.getElementById("dpcChart"), {
    type: "line",
    data: {
      labels: labels,
      datasets: [
        { label: "Target", data: target, borderColor: "blue", fill: false },
        { label: "Actual", data: actual, borderColor: "red", fill: false }
      ]
    }
  });
}

loadDpcData();
