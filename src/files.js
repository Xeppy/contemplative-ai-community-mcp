import {realpath,open} from 'node:fs/promises';
import {constants} from 'node:fs';
import {resolve,relative,isAbsolute,dirname,basename,sep} from 'node:path';
import {homedir} from 'node:os';
export const FILE_LIMIT=10*1024*1024;
export async function allowedPath(path,roots,write=false){
 if(!isAbsolute(path))throw new Error('Artifact path must be absolute');
 if(path.split(sep).some(p=>p.startsWith('.')))throw new Error('Hidden paths are not permitted');
 const canonical=write?resolve(await realpath(dirname(path)),basename(path)):await realpath(path);
 if(canonical.split(sep).some(p=>p.startsWith('.')))throw new Error('Hidden paths are not permitted');
 let allowed=false;
 for(const root of roots){const r=await realpath(root);if(r===sep||r===homedir())throw new Error('Artifact roots must be narrower than home or filesystem root');const rel=relative(r,canonical);if(rel&&!rel.startsWith('..'+sep)&&rel!=='..'&&!isAbsolute(rel))allowed=true;}
 if(!allowed)throw new Error('Path is outside CAC_ARTIFACT_ROOTS');return canonical;
}
export async function readArtifact(path,roots){const p=await allowedPath(path,roots);const f=await open(p,constants.O_RDONLY|constants.O_NOFOLLOW);try{const stat=await f.stat();if(!stat.isFile()||stat.size<1||stat.size>FILE_LIMIT)throw new Error('File must be regular and at most 10 MiB');const b=await f.readFile();if(b.length>FILE_LIMIT)throw new Error('File grew beyond limit');return b;}finally{await f.close();}}
export async function writeArtifact(path,roots,bytes){if(bytes.length>FILE_LIMIT)throw new Error('File exceeds limit');const p=await allowedPath(path,roots,true);const f=await open(p,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,0o600);try{await f.writeFile(bytes);}finally{await f.close();}return p;}
