'use client';
import { useState } from 'react';
const stages = [
  { id: '1', name: 'Clue 1 — The Patient File', path: '/?clue=1' },
  { id: '2', name: 'Clue 2 — The Missing Key', path: '/?clue=2' },
  { id: '3', name: "Clue 3 — The Doctor's Notes", path: '/?clue=3' },
  { id: '4', name: 'Clue 4 — The Final Testimony', path: '/?clue=4' },
];
export default function QRGenerator() {
  const [password,setPassword] = useState(''); const [unlocked,setUnlocked] = useState(false); const [error,setError] = useState('');
  async function download(id:string) {
    setError(''); const response = await fetch('/api/qr',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password,stage:id})});
    if(!response.ok){const data=await response.json().catch(()=>({}));setError(data.error??'QR generation failed.');return;}
    const blob=await response.blob();const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`last-patient-clue-${id}.png`;a.click();URL.revokeObjectURL(url);
  }
  return <main className="shell"><div className="topline"><span>Restricted access</span><span className="sigil">CASE FILE 001</span></div><header className="hero"><div className="eyebrow">Organizer utility</div><h1 className="title">QR ARCHIVE</h1><p className="subtitle">Generate the four printable investigation QR codes. Set the production site URL before printing.</p></header><section className="panel"><label className="label" htmlFor="password">Organizer password</label><input id="password" className="field" type="password" value={password} onChange={e=>{setPassword(e.target.value);setUnlocked(false)}} placeholder="Enter QR admin password"/><button className="btn" onClick={()=>setUnlocked(true)} disabled={!password}>UNLOCK QR ARCHIVE</button>{error&&<p className="error">{error}</p>}</section>{unlocked&&<section className="panel"><div className="label">Print-ready PNG files</div>{stages.map(s=><div key={s.id} style={{padding:'12px 0',borderBottom:'1px solid #332627'}}><div className="name">{s.name}</div><div className="small">{s.path}</div><button className="btn secondary" style={{marginTop:9}} onClick={()=>download(s.id)}>DOWNLOAD QR {s.id} PNG</button></div>)}</section>}<p className="footer">THE LAST PATIENT · INTERNAL USE ONLY</p></main>;
}
