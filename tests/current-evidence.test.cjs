const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const read=file=>JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));
const context={window:{}};
vm.runInNewContext(fs.readFileSync(path.join(root,'static/js/trajectory-cases-data.js'),'utf8'),context);
const cases=Array.from(context.window.SWARMHARM_CASES);
const evidence=read('static/data/reviews/current-evidence.json');

test('the public collection contains the six selected threat models in both domains',()=>{
  assert.equal(cases.length,13);
  const harm=cases.filter(c=>c.mode==='SwarmHarm');
  for(const domain of ['Engineering','Knowledge Work']) {
    assert.deepEqual(harm.filter(c=>c.domain===domain).map(c=>c.title).sort(),[
      'Action Scope Violation','Grader Manipulation','Information Scope Violation',
      'Shared-resource Interference','Specification Gaming','Trace Tampering'
    ]);
  }
  assert.ok(cases.every(c=>c.model==='gpt-6.1-sol'));
  assert.equal(new Set(cases.map(c=>c.id)).size,13);
  assert.equal(fs.readdirSync(path.join(root,'static/data/trajectories')).length,13);
  assert.equal(fs.readdirSync(path.join(root,'static/data/reviews')).length,14);
});

test('every artifact and receipt resolves to actual actors and actions with unchanged content',()=>{
  for(const item of cases){
    const data=read(item.trajectory),events=new Map(data.events.map(e=>[e.id,e]));
    const actors=new Set(data.actors.map(a=>a.id)),messages=new Map(data.messages.map(m=>[m.id,m]));
    assert.equal(data.id,item.id);
    assert.equal(events.size,data.events.length);
    assert.equal(messages.size,data.messages.length);
    assert.equal(data.provenance.nativeToolEventsVerified,events.size);
    assert.equal(data.counts.actions,events.size);
    assert.equal(data.counts.turns,Object.values(data.turns).reduce((n,t)=>n+t.length,0));
    let first=0,total=0;
    for(const m of data.messages){
      const post=events.get(m.event);
      assert.ok(post && post.messages.includes(m.id));
      assert.equal(post.actor,m.actor);
      assert.equal(crypto.createHash('sha256').update(m.body).digest('hex'),m.bodySha256);
      assert.notEqual(m.kind,'Message','file artifacts must not be labelled as conversations');
      assert.equal(new Set(m.reads.map(r=>r.actor)).size,m.reads.length);
      for(const receipt of [...m.reads,...m.repeatReads]){
        const e=events.get(receipt.event);
        assert.ok(e && actors.has(receipt.actor) && e.reads.includes(m.id));
        assert.equal(e.actor,receipt.actor);
        assert.notEqual(e.actor,m.actor);
        assert.ok(e.id>m.event);
        total++;
      }
      first+=m.reads.length;
    }
    assert.equal(first,data.counts.firstReads);assert.equal(total,data.counts.allReads);
    for(const e of data.events){
      assert.ok(actors.has(e.actor));assert.ok(data.turns[e.actor][e.turn-1].includes(e.id));
      for(const id of [...e.messages,...e.reads])assert.ok(messages.has(id));
    }
    const review=read(item.review),index=evidence.cases.find(c=>c.case===item.id);
    assert.deepEqual(review,index);
    assert.equal(review.scope,item.scope);
  }
});

test('composition retains four actors and does not invent cross-agent content reads',()=>{
  for(const item of cases.filter(c=>c.id.endsWith('-capacity'))){
    const data=read(item.trajectory);
    assert.equal(data.actors.length,4);
    assert.equal(data.counts.allReads,0);
    assert.ok(item.composition);
    assert.match(item.scope,/full individual sequence/);
  }
});

test('formation imports match the reviewed source-copy count and use three named agents',()=>{
  const item=cases.find(c=>c.mode==='SwarmForm'),data=read(item.trajectory),review=read(item.review);
  assert.deepEqual(data.actors.map(a=>a.name),['Cedar','Juniper','Willow']);
  assert.equal(data.counts.firstReads,review.findings.independent_foreign_source_copies);
  assert.equal(data.messages.length,9);
  assert.equal(review.findings.fully_correct_intake_deliveries,9);
});

test('all inline finding and threat-model links select a current case and existing event',()=>{
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  for(const match of html.matchAll(/href="\?case=([^&]+)&amp;phase=(\d)(?:&amp;event=(\d+))?#trajectory"/g)){
    const item=cases.find(c=>c.id===match[1]);assert.ok(item,match[1]);
    assert.equal(item.phase,Number(match[2]));
    if(match[3])assert.ok(read(item.trajectory).events.some(e=>e.id===Number(match[3])));
  }
  assert.ok(!/balanced-v2|SWARMHARM_ARCHIVED_CASES|data-tax-cell/.test(html));
});
