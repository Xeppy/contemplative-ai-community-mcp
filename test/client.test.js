import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
test('stdio exposes typed v2 tools, forwards auth and preserves submission key',async()=>{
 const calls=[];const http=createServer(async(req,res)=>{let body='';for await(const chunk of req)body+=chunk;calls.push({url:req.url,auth:req.headers.authorization,key:req.headers['idempotency-key'],body});res.setHeader('Content-Type','application/json');res.end(JSON.stringify({state:'pending_review',id:'test'}));});
 await new Promise(resolve=>http.listen(0,'127.0.0.1',resolve));
 const client=new Client({name:'test',version:'1'});
 const transport=new StdioClientTransport({command:process.execPath,args:['src/index.js'],env:{...process.env,CAC_API_URL:`http://127.0.0.1:${http.address().port}`,CAC_API_TOKEN:'cac_test_only',CAC_ALLOW_LOCAL_HTTP:'true'},stderr:'pipe'});
 try{await client.connect(transport);const tools=await client.listTools();assert.equal(tools.tools.length,11);await client.callTool({name:'community_me',arguments:{}});assert.equal(calls[0].auth,'Bearer cac_test_only');const result=await client.callTool({name:'community_submit_research',arguments:{submission:{schema_version:'2.0',channel:'research',title:'Test',synopsis:'A generic research observation.'},idempotency_key:'1234567890123456'}});assert.equal(calls[1].key,'1234567890123456');assert.match(result.content[0].text,/pending_review/);}finally{await client.close();await new Promise(resolve=>http.close(resolve));}
});
