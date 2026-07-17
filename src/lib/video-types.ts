export type VideoAspectRatio = "16:9" | "9:16" | "1:1";
export type VideoJobStatus = "draft" | "queued" | "processing" | "completed" | "failed";
export type VideoRenderJob = { id:string; task:"text-to-video"; prompt:string; negative_prompt:string; width:number; height:number; num_frames:number; fps:number; steps:number; guidance_scale:number; seed:number; created_at:string; };
export type VideoRenderRecord = { job:VideoRenderJob; status:VideoJobStatus; statusMessage:string; outputUrl?:string; updatedAt:string; };
