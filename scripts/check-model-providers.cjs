/** Sends synthetic test text only. Never prints provider credentials or response bodies. */
const path=require('path'); const root=path.resolve(__dirname,'..'); const backend=path.join(root,'packages/hoppscotch-backend');
require(backend+'/node_modules/dotenv').config({path:backend+'/.env',quiet:true});
process.env.TS_NODE_PROJECT=backend+'/tsconfig.json';process.chdir(backend);
require(backend+'/node_modules/ts-node').register({transpileOnly:true});require(backend+'/node_modules/tsconfig-paths/register');
const {ConfigService}=require(backend+'/node_modules/@nestjs/config');
const {LlmService}=require(backend+'/src/ai-mock/services/llm.service.ts');
const {EmbeddingService}=require(backend+'/src/api-search/embedding.service.ts');
(async()=>{
 const config=new ConfigService();const llm=new LlmService(config);const embedding=new EmbeddingService(config);
 try {const v=await embedding.generateEmbedding('Synthetic test API: PATCH /members/{id}, update member name'); console.log('Embedding:',v.length===1024?'PASS (1024 dimensions)':'FAIL');}catch{console.log('Embedding: FAIL (verify dedicated embedding endpoint/key/model)');process.exitCode=1;}
 try {const turn=await llm.toolTurn([{role:'user',content:'Call check with value ok.'}],[{type:'function',function:{name:'check',description:'Check connectivity',parameters:{type:'object',properties:{value:{type:'string'}},required:['value']}}}]);if(!turn.tool_calls?.length)throw Error();console.log('LLM tool calling: PASS');}catch{console.log('LLM tool calling: FAIL (verify model supports tool_calls)');process.exitCode=1;}
})().catch(()=>{console.log('Provider check failed');process.exitCode=1});
