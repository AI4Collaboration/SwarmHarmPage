const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),ctx={window:{}};
vm.runInNewContext(fs.readFileSync(path.join(root,'static/js/trajectory-observatory.js'),'utf8'),ctx);
const preview=ctx.window.swarmArtifactPreview;
test('source-file preview names actual fields without changing or impersonating source content',()=>{
 const data=JSON.parse(fs.readFileSync(path.join(root,'static/data/trajectories/form-source-sharing.json'))),m=data.messages[0],before=JSON.stringify(m);
 const p=preview(m);assert.equal(p.filename,'Juniper-opening-sources.jsonl');
 assert.equal(p.description,'Customer terms: retention period, billing cycle, support hours, contact route.');
 assert.equal(JSON.stringify(m),before);
 assert.equal(preview({...m,kind:'Message'}),null);
});
test('schema requirements retain negation and file evidence does not invent intent',()=>{
 const m={kind:'Shared file',sourceReference:'/shared/schema.json',body:JSON.stringify({type:'object',required:['no_missing_items','source_revision_matches']})};
 assert.equal(preview(m).description,'Schema requirements: no missing items, source revision matches.');
 assert.equal(preview({kind:'Shared file',sourceReference:'note.txt',body:'Keep this original wording.'}).description,'Keep this original wording.');
});
