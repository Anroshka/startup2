import assert from 'node:assert/strict';
import ts from 'typescript';
import vm from 'node:vm';
import fs from 'node:fs';
import * as zod from 'zod';
const context=vm.createContext({Response,Request,console,Date,JSON,Number,TextDecoder,Error});
const exportsModule=(exports)=>new vm.SyntheticModule(Object.keys(exports),function(){for(const [k,v]of Object.entries(exports))this.setExport(k,v)},{context});
const product=new vm.SourceTextModule(ts.transpile(fs.readFileSync('lib/product.ts','utf8'),{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}),{context});
await product.link(()=>exportsModule(zod));await product.evaluate();
const p=product.namespace;
assert.equal(p.score(p.demoProfile,p.demoJobs[0]),100);
assert.equal(p.score({...p.demoProfile,skills:'React'},p.demoJobs[0]),0);
const letter=p.makeLetter({...p.demoProfile,skills:'React',resume:''},p.demoJobs[0]);assert.ok(!letter.includes('Figma'));assert.ok(!letter.includes('250000'));
assert.equal(p.jobSchema.safeParse({...p.demoJobs[0],url:'javascript:alert(1)'}).success,false);
assert.equal(p.jobSchema.safeParse({...p.demoJobs[0],salaryMin:250000,salaryMax:100000}).success,false);
assert.equal(p.stateSchema.safeParse({...p.emptyState,jobs:[p.demoJobs[0],p.demoJobs[0]]}).success,false);
let user=null;const records=new Map();
const db = {
  prepare(sql) {
    return {
      bind(...args) {
        return {
          async first() { return records.get(args[0]) || null; },
          async run() {
            if (sql.startsWith('INSERT')) {
              const [id, data, updatedAt] = args;
              if (records.has(id)) return { meta: { changes: 0 } };
              records.set(id, { data, revision: 1, updatedAt });
              return { meta: { changes: 1 } };
            }
            const [data, updatedAt, id, revision] = args;
            const row = records.get(id);
            if (!row || row.revision !== revision) return { meta: { changes: 0 } };
            records.set(id, { data, updatedAt, revision: revision + 1 });
            return { meta: { changes: 1 } };
          }
        };
      }
    };
  }
};
const route=new vm.SourceTextModule(ts.transpile(fs.readFileSync('app/api/state/route.ts','utf8'),{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}),{context});
await route.link(name=>name==='@/lib/product'?product:name==='@/lib/storage'?exportsModule({database:()=>db}):exportsModule({getChatGPTUser:async()=>user}));await route.evaluate();
const {GET,PUT}=route.namespace;
const request=(state,revision=0,extra={})=>new Request('https://jobpilot.test/api/state',{method:'PUT',headers:{'Content-Type':'application/json',...extra},body:JSON.stringify({state,revision})});
assert.equal((await GET()).status,401);assert.equal((await PUT(request(p.emptyState))).status,401);
user={userId:'alice'};assert.equal((await PUT(request({...p.emptyState,profile:p.demoProfile}))).status,200);
assert.equal((await PUT(request(p.emptyState,0))).status,409);
assert.equal((await PUT(request(p.emptyState,1,{'sec-fetch-site':'cross-site'}))).status,403);
user={userId:'bob'};assert.equal((await (await GET()).json()).state.profile,null);
assert.equal((await PUT(request(p.emptyState,1))).status,409);
assert.equal((await PUT(request({...p.emptyState,profile:p.demoProfile}))).status,200);
user={userId:'alice'};assert.equal((await (await GET()).json()).revision,1);
assert.equal((await PUT(request(p.emptyState,1))).status,200);
assert.equal((await (await GET()).json()).state.profile,null);
console.log('PASS: matching, honest drafts, URL/salary validation, duplicate protection, auth, owner isolation, revision conflict, cross-site rejection, save/read.');
