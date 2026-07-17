"use client";
import { useMemo, useState } from "react";
import type { VideoAspectRatio, VideoRenderJob, VideoRenderRecord, VideoJobStatus } from "@/lib/video-types";
const KEY="trizzy-writer-video-history-v1";
const dims:Record<VideoAspectRatio,{width:number;height:number}>={"16:9":{width:832,height:480},"9:16":{width:480,height:832},"1:1":{width:624,height:624}};
function idFor(v:string){const s=v.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,42);return `${s||"trizzy-video"}-${Date.now().toString(36)}`;}
function download(job:VideoRenderJob){const b=new Blob([JSON.stringify(job,null,2)],{type:"application/json"});const u=URL.createObjectURL(b);const a=document.createElement("a");a.href=u;a.download=`${job.id}.json`;a.click();URL.revokeObjectURL(u);}
function history(){if(typeof window==="undefined")return [];try{return JSON.parse(localStorage.getItem(KEY)||"[]") as VideoRenderRecord[];}catch{return [];}}
export function VideoDirector({lyrics}:{lyrics:string}){
 const [prompt,setPrompt]=useState(""); const [negative,setNegative]=useState("blurry, distorted face, extra limbs, duplicate people, text, logo, watermark, low quality");
 const [ratio,setRatio]=useState<VideoAspectRatio>("9:16"); const [seconds,setSeconds]=useState(5); const [fps,setFps]=useState(16); const [steps,setSteps]=useState(30); const [guidance,setGuidance]=useState(5); const [seed,setSeed]=useState(()=>Math.floor(Math.random()*2147483647));
 const [records,setRecords]=useState<VideoRenderRecord[]>(history); const [notice,setNotice]=useState("Create a WAN render job, then run the Colab worker.");
 const frames=useMemo(()=>Math.max(5,Math.floor((Math.max(1,Math.round(seconds*fps))-1)/4)*4+1),[seconds,fps]);
 function persist(n:VideoRenderRecord[]){setRecords(n);localStorage.setItem(KEY,JSON.stringify(n));}
 function make():VideoRenderJob|null{if(!prompt.trim()){setNotice("Add a visual prompt before creating the render job.");return null;}const d=dims[ratio];return{id:idFor(prompt),task:"text-to-video",prompt:prompt.trim(),negative_prompt:negative.trim(),width:d.width,height:d.height,num_frames:frames,fps,steps,guidance_scale:guidance,seed,created_at:new Date().toISOString()};}
 function queueDownload(){const job=make();if(!job)return;download(job);persist([{job,status:"queued" as VideoJobStatus,statusMessage:"Job JSON downloaded. Move it into the Colab queue folder.",updatedAt:new Date().toISOString()},...records].slice(0,30));setNotice(`Created ${job.id}.json for the WAN queue.`);}
 async function queueFolder(){const job=make();if(!job)return;const picker=(window as unknown as {showDirectoryPicker?:()=>Promise<FileSystemDirectoryHandle>}).showDirectoryPicker;if(!picker){queueDownload();setNotice("Direct folder writing is unavailable, so the job was downloaded instead.");return;}try{const dir=await picker();const fh=await dir.getFileHandle(`${job.id}.json`,{create:true});const w=await fh.createWritable();await w.write(JSON.stringify(job,null,2));await w.close();persist([{job,status:"queued" as VideoJobStatus,statusMessage:"Written directly to selected queue folder.",updatedAt:new Date().toISOString()},...records].slice(0,30));setNotice(`Queued ${job.id} directly to the selected folder.`);}catch(e){if(e instanceof DOMException&&e.name==="AbortError")return;setNotice(e instanceof Error?e.message:"Could not write render job.");}}
 async function importStatus(){const input=document.createElement("input");input.type="file";input.accept=".json,application/json";input.onchange=async()=>{const file=input.files?.[0];if(!file)return;try{const data=JSON.parse(await file.text()) as {id?:string;status?:VideoJobStatus;message?:string;output?:string;output_path?:string};if(!data.id||!data.status)throw new Error("Status file missing id or status.");const next=records.map(r=>r.job.id===data.id?{...r,status:data.status as VideoJobStatus,statusMessage:data.message||data.status||"Status updated",outputUrl:data.output||data.output_path||r.outputUrl,updatedAt:new Date().toISOString()}:r);persist(next);setNotice(`Imported ${data.status} status for ${data.id}.`);}catch(e){setNotice(e instanceof Error?e.message:"Could not import status.");}};input.click();}
 function useLyrics(){if(!lyrics.trim()){setNotice("Generate or paste lyrics first.");return;}const excerpt=lyrics.replace(/\[[^\]]+\]/g," ").replace(/\s+/g," ").trim().slice(0,550);setPrompt(`Create a cinematic Trap R&B music-video scene inspired by these lyrics: ${excerpt}. One consistent masculine lead performer, realistic anatomy, premium lighting, controlled camera movement, emotional visual storytelling, no on-screen text.`);setNotice("Lyrics converted into a starter visual direction. Refine it before rendering.");}
 return <section className="video-director glass-panel">
  <div className="video-director-heading"><div><p className="eyebrow">WAN 2.1 VIDEO DIRECTOR</p><h2>Turn writing into render-ready scenes</h2></div><span className="number-chip">02</span></div>
  <div className="video-director-grid">
   <div className="video-form"><div className="video-actions-top"><button className="ghost-button" type="button" onClick={useLyrics}>Use current lyrics</button><button className="ghost-button" type="button" onClick={()=>setSeed(Math.floor(Math.random()*2147483647))}>New seed</button></div>
    <label className="field"><span>Scene prompt</span><textarea rows={7} value={prompt} onChange={e=>setPrompt(e.target.value)} placeholder="A confident male R&B artist walks through neon rain outside a midnight diner..." /></label>
    <label className="field"><span>Negative prompt</span><textarea rows={3} value={negative} onChange={e=>setNegative(e.target.value)} /></label>
    <div className="video-settings-grid">
     <label className="field compact-field"><span>Format</span><select value={ratio} onChange={e=>setRatio(e.target.value as VideoAspectRatio)}><option>9:16</option><option>16:9</option><option>1:1</option></select></label>
     <label className="field compact-field"><span>Seconds</span><input type="number" min={1} max={10} value={seconds} onChange={e=>setSeconds(Number(e.target.value))}/></label>
     <label className="field compact-field"><span>FPS</span><input type="number" min={8} max={24} value={fps} onChange={e=>setFps(Number(e.target.value))}/></label>
     <label className="field compact-field"><span>Steps</span><input type="number" min={10} max={50} value={steps} onChange={e=>setSteps(Number(e.target.value))}/></label>
     <label className="field compact-field"><span>Guidance</span><input type="number" min={1} max={10} step={0.5} value={guidance} onChange={e=>setGuidance(Number(e.target.value))}/></label>
     <label className="field compact-field"><span>Seed</span><input type="number" value={seed} onChange={e=>setSeed(Number(e.target.value))}/></label>
    </div>
    <div className="job-summary"><span>{dims[ratio].width}×{dims[ratio].height}</span><span>{frames} frames</span><span>{(frames/fps).toFixed(1)} sec actual</span></div>
    <div className="video-queue-actions"><button className="primary-button" type="button" onClick={()=>void queueFolder()}>Queue to Drive folder</button><button className="ghost-button" type="button" onClick={queueDownload}>Download job JSON</button></div><p className="video-notice">{notice}</p>
   </div>
   <div className="render-queue"><div className="render-queue-heading"><div><p className="label">Render history</p><h3>{records.length?`${records.length} tracked jobs`:"No jobs yet"}</h3></div><button className="ghost-button" type="button" onClick={()=>void importStatus()}>Import status</button></div>
    <div className="render-list">{records.length?records.map(r=><article className="render-card" key={r.job.id}><div className="render-card-top"><strong>{r.job.id}</strong><span className={`render-status ${r.status}`}>{r.status}</span></div><p>{r.job.prompt}</p><small>{r.job.width}×{r.job.height} · {r.job.num_frames} frames · seed {r.job.seed}</small><small>{r.statusMessage}</small>{r.outputUrl?<code>{r.outputUrl}</code>:null}</article>):<div className="empty-render-state"><strong>Your render queue will appear here.</strong><span>Create a job, run the Colab worker, then import its status JSON.</span></div>}</div>
   </div>
  </div>
 </section>;
}

