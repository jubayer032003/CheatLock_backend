import assert from 'node:assert/strict';
import test from 'node:test';
process.env.CHEATLOCK_SKIP_DOTENV='true';
process.env.SUPABASE_URL='https://offline-test.invalid';
process.env.SUPABASE_SERVICE_ROLE_KEY='offline-key';
const A='11111111-1111-4111-8111-111111111111';
const B='22222222-2222-4222-8222-222222222222';
const C='33333333-3333-4333-8333-333333333333';
for(const root of ['src','backend/src']) {
 const service=await import(`../${root}/services/selfExamService.js`);
 const {getSupabaseAdminClient}=await import(`../${root}/services/supabaseClient.js`);
 const client=getSupabaseAdminClient();
 await test(`${root}: self exam compatibility`,async t=>{
  const original=client.from;
  let calls=[],respond;
  client.from=table=>{
   const op={table,steps:[]};
   const query=new Proxy({}, {get(_,key){
    if(key==='then')return (resolve,reject)=>Promise.resolve().then(()=>{calls.push(op);return respond(op);}).then(resolve,reject);
    return (...args)=>{op.steps.push([key,...args]);return query;};
   }});return query;
  };
  const missing={code:'PGRST205',message:"Could not find the table 'public.exam_nodes' in the schema cache"};
  const setup={classId:A,subjectId:B,chapterId:C,questionCount:1};
  try {
   await t.test('legacy create validates selection and inserts class/subject without node_id',async()=>{
    calls=[];respond=op=>{
     if(op.table==='exam_nodes')return {error:missing};
     if(op.table==='question_bank_self_exam_sessions')return {data:{id:A,...op.steps.find(s=>s[0]==='insert')[1][0]}};
     return {data:{id:A,is_active:true}};
    };
    const result=await service.createSelfExamSession('student-a',setup);
    const payload=calls.at(-1).steps.find(s=>s[0]==='insert')[1][0];
    assert.equal(payload.class_id,A);assert.equal(payload.subject_id,B);assert.equal(payload.chapter_id,C);
    assert.equal(payload.student_id,'student-a');assert.ok(!('node_id' in payload));assert.equal(result.nodeId,C);
    assert.ok(calls.find(o=>o.table==='question_bank_subjects').steps.some(s=>s[0]==='eq'&&s[1]==='class_id'&&s[2]===A));
    assert.ok(calls.find(o=>o.table==='question_bank_chapters').steps.some(s=>s[0]==='eq'&&s[1]==='subject_id'&&s[2]===B));
   });
   await t.test('node schema retains node insert and does not insert legacy columns',async()=>{
    calls=[];respond=op=>op.table==='exam_nodes'?{data:{id:A,is_active:true}}:{data:{id:B,...op.steps.find(s=>s[0]==='insert')[1][0]}};
    await service.createSelfExamSession('student-a',{nodeId:A});
    const payload=calls.at(-1).steps.find(s=>s[0]==='insert')[1][0];
    assert.equal(payload.node_id,A);assert.ok(!('class_id' in payload));
   });
   await t.test('permission and unrelated table errors never select legacy fallback',async()=>{
    for(const error of [{code:'42501',message:'exam_nodes access denied'},{code:'PGRST205',message:'Missing public.unrelated_table'}]){
     calls=[];respond=()=>({error});
     await assert.rejects(service.createSelfExamSession('student-a',setup),e=>e.code===error.code&&!/Apply backend|migration has not/.test(e.message));
     assert.equal(calls.length,1);
    }
   });
   await t.test('inactive legacy subject prevents session insertion',async()=>{
    calls=[];respond=op=>op.table==='exam_nodes'?{error:missing}:{data:{id:A,is_active:op.table!=='question_bank_subjects'}};
    await assert.rejects(service.createSelfExamSession('student-a',setup),/subject is inactive/);
    assert.ok(!calls.some(o=>o.table==='question_bank_self_exam_sessions'));
   });
   await t.test('legacy start filters questions by chapter and reads without node_id',async()=>{
    calls=[];const session={id:A,student_id:'student-a',class_id:A,subject_id:B,chapter_id:C,status:'created',question_count:1,duration_minutes:10,difficulty_mode:'mixed'};
    respond=op=>{
     if(op.table==='question_bank_self_exam_sessions'){
      const update=op.steps.find(s=>s[0]==='update');if(update)Object.assign(session,update[1]);
      return {data:{...session}};
     }
     if(op.table==='question_bank_questions')return {data:[{id:B,difficulty:'easy',marks:1}]};
     if(op.table==='question_bank_self_exam_session_questions'){
      const select=op.steps.find(s=>s[0]==='select');
      if(select&&select[1].includes('node_id'))return {error:{code:'42703',message:'column node_id does not exist'}};
      return {data:select?[{marks:1,display_order:1,question_bank_questions:{id:B,question_text:'Question',class_id:A,subject_id:B,chapter_id:C,question_bank_question_options:[{id:C,option_text:'Answer',is_correct:true}]}}]:null};
     }
     if(op.table==='question_bank_self_exam_answers')return {data:[]};
     throw Error(`Unexpected table ${op.table}`);
    };
    const result=await service.startSelfExamSession('student-a',A);
    assert.equal(result.session.status,'in_progress');assert.equal(result.questions.length,1);
    assert.doesNotMatch(JSON.stringify(result),/isCorrect|is_correct/);
    assert.ok(calls.find(o=>o.table==='question_bank_questions').steps.some(s=>s[0]==='eq'&&s[1]==='chapter_id'&&s[2]===C));
    assert.ok(!calls.some(o=>o.table==='exam_nodes'));
   });
   await t.test('session operations keep student ownership filters',async()=>{
    calls=[];respond=op=>{assert.ok(op.steps.some(s=>s[0]==='eq'&&s[1]==='student_id'&&s[2]==='student-a'));return {error:{code:'PGRST116',message:'not found'}};};
    for(const action of [service.getSelfExamSession,service.startSelfExamSession,service.saveSelfExamAnswer,service.submitSelfExam,service.getSelfExamResult])await assert.rejects(action('student-a',A,{}),e=>e.code==='PGRST116');
    assert.equal(calls.length,5);
   });
  }finally{client.from=original;}
 });
}
