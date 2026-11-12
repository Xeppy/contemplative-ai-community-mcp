import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
test('stdio exposes typed v3 tools, forwards auth, roles and the submission key',async()=>{
 const calls=[];const http=createServer(async(req,res)=>{let body='';for await(const chunk of req)body+=chunk;calls.push({method:req.method,url:req.url,auth:req.headers.authorization,key:req.headers['idempotency-key'],role:req.headers['x-artifact-role'],body});res.setHeader('Content-Type','application/json');res.end(JSON.stringify({state:'pending_delivery',id:'test'}));});
 await new Promise(resolve=>http.listen(0,'127.0.0.1',resolve));
 const client=new Client({name:'test',version:'1'});
 const transport=new StdioClientTransport({command:process.execPath,args:['src/index.js'],env:{...process.env,CAC_API_URL:`http://127.0.0.1:${http.address().port}`,CAC_API_TOKEN:'cac_test_only',CAC_ALLOW_LOCAL_HTTP:'true'},stderr:'pipe'});
 try{
  await client.connect(transport);const tools=await client.listTools();assert.equal(tools.tools.length,14);
  assert.deepEqual(tools.tools.find(t=>t.name==='community_submit_research').inputSchema.properties.submission.required,['schema_version','channel','title','research_question','results']);
  await client.callTool({name:'community_me',arguments:{}});assert.equal(calls[0].auth,'Bearer cac_test_only');
  const card={schema_version:'3.0',channel:'research-updates',title:'Test',research_question:'Does it work?',results:'It does.'};
  const result=await client.callTool({name:'community_submit_research',arguments:{submission:card,idempotency_key:'1234567890123456'}});assert.equal(calls[1].key,'1234567890123456');assert.match(result.content[0].text,/pending_delivery/);
  const old=await client.callTool({name:'community_submit_research',arguments:{submission:{schema_version:'2.0',channel:'research',title:'Old',synopsis:'Old card'},idempotency_key:'1234567890123456'}});assert.equal(old.isError,true);assert.equal(calls.length,2);
  await client.callTool({name:'community_upload_artifact',arguments:{filename:'run.log',media_type:'text/plain',role:'logs',text:'transcript'}});assert.equal(calls[2].role,'logs');assert.equal(calls[2].body,'transcript');
  await client.callTool({name:'community_index',arguments:{view:'tag:steering'}});assert.equal(calls[3].url,'/v1/index?view=tag%3Asteering');
  await client.callTool({name:'community_related',arguments:{q:'equanimity steering'}});assert.equal(calls[4].url,'/v1/related?q=equanimity+steering');
  await client.callTool({name:'community_delete_submission',arguments:{id:'3f2b8c1e-5a4d-4e6f-9b7a-1c2d3e4f5a6b'}});assert.equal(calls[5].method,'DELETE');
 }finally{await client.close();await new Promise(resolve=>http.close(resolve));}
});
