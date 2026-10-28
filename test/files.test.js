import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,symlink,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {readArtifact,writeArtifact} from '../src/files.js';
test('file tools enforce roots, reject symlink escapes and hidden files, never overwrite',async()=>{
 const root=await mkdtemp(join(tmpdir(),'mcp-files-'));try{const allowed=join(root,'allowed');await mkdir(allowed);const file=join(allowed,'note.txt');await writeFile(file,'test');assert.equal((await readArtifact(file,[allowed])).toString(),'test');await writeFile(join(root,'outside.txt'),'private');await symlink(join(root,'outside.txt'),join(allowed,'escape.txt'));await assert.rejects(readArtifact(join(allowed,'escape.txt'),[allowed]));await writeFile(join(allowed,'.env'),'secret');await assert.rejects(readArtifact(join(allowed,'.env'),[allowed]));await assert.rejects(writeArtifact(file,[allowed],Buffer.from('overwrite')));await assert.rejects(readArtifact(file,[]));await writeArtifact(join(allowed,'new.txt'),[allowed],Buffer.from('safe'));}finally{await rm(root,{recursive:true,force:true});}
});
