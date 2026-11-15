/* Supabase de mentira pra teste: banco no localStorage, tempo real entre abas pelo evento storage. */
(function(){
  const K=t=>'stub:'+t;
  const read=t=>{ try{ return JSON.parse(localStorage.getItem(K(t))||'{}'); }catch(e){ return {}; } };
  const write=(t,o)=>localStorage.setItem(K(t),JSON.stringify(o));
  const listeners=[]; // {table, cb}
  const emit=(table,ev)=>listeners.filter(l=>l.table===table).forEach(l=>setTimeout(()=>l.cb(ev),5));
  const noTable=t=>window.__stubNoMap&&/mesa_maps|mesa_tokens/.test(t);
  const missing=t=>({code:'PGRST205',message:"Could not find the table 'public."+t+"' in the schema cache"});
  window.addEventListener('storage',e=>{
    if(!e.key||e.key.indexOf('stub:')!==0) return;
    const t=e.key.slice(5),o=JSON.parse(e.oldValue||'{}'),n=JSON.parse(e.newValue||'{}');
    Object.keys(n).forEach(k=>{ if(JSON.stringify(o[k])!==JSON.stringify(n[k])) emit(t,{eventType:o[k]?'UPDATE':'INSERT',new:n[k],old:{}}); });
    Object.keys(o).forEach(k=>{ if(!n[k]) emit(t,{eventType:'DELETE',old:{room:o[k].room,id:o[k].id},new:{}}); });
  });
  function q(table){
    const f={}; let op='select',row=null,single=false;
    const b={
      select(){ op=op==='select'?'select':op; return b; },
      eq(k,v){ f[k]=v; return b; },
      maybeSingle(){ single=true; return b; },
      upsert(r){ op='upsert'; row=r; return b; },
      delete(){ op='delete'; return b; },
      then(res,rej){ return Promise.resolve().then(run).then(res,rej); }
    };
    function run(){
      if(noTable(table)) return {data:null,error:missing(table)};
      const db=read(table);
      const match=r=>Object.keys(f).every(k=>r[k]===f[k]);
      if(op==='select'){ const rows=Object.values(db).filter(match); return {data:single?(rows[0]||null):rows,error:null}; }
      if(op==='upsert'){ const k=row.room+'|'+row.id,had=!!db[k]; db[k]=JSON.parse(JSON.stringify(row)); write(table,db); emit(table,{eventType:had?'UPDATE':'INSERT',new:db[k],old:{}}); return {data:null,error:null}; }
      if(op==='delete'){ Object.keys(db).forEach(k=>{ if(match(db[k])){ const o=db[k]; delete db[k]; write(table,db); emit(table,{eventType:'DELETE',old:{room:o.room,id:o.id},new:{}}); } }); return {data:null,error:null}; }
    }
    return b;
  }
  function channel(){
    const ch={
      on(type,filter,cb){ if(type==='postgres_changes') listeners.push({table:filter.table,cb:cb,ch:ch}); return ch; },
      subscribe(cb){ setTimeout(()=>cb&&cb('SUBSCRIBED'),10); return ch; },
      track(){ return Promise.resolve(); }, presenceState(){ return {}; }, send(){ return Promise.resolve(); }
    };
    return ch;
  }
  window.__uploads=[];
  const storage={ from(bucket){ return {
    async upload(path,blob,opts){
      if(window.__stubNoBucket) return {data:null,error:{message:'Bucket not found',statusCode:'404'}};
      window.__uploads.push({bucket:bucket,path:path,size:blob.size,type:blob.type,opts:opts}); return {data:{path:path},error:null};
    },
    getPublicUrl(path){ return {data:{publicUrl:'https://stub-storage.test/'+bucket+'/'+path}}; }
  }; } };
  /* funções SQL (minigames e ficha), com a senha do mestre "teste" */
  const J=()=>{ try{ return JSON.parse(localStorage.getItem('stub:jogos')||'{}'); }catch(e){ return {}; } };
  const Jw=o=>localStorage.setItem('stub:jogos',JSON.stringify(o));
  const F=()=>{ try{ return JSON.parse(localStorage.getItem('stub:fichas')||'{}'); }catch(e){ return {}; } };
  const Fw=o=>localStorage.setItem('stub:fichas',JSON.stringify(o));
  const IDS=['radio','morse','projetor'];
  const chk=pw=>{ if(pw!==(window.__stubSenha||'teste')) throw {message:'senha_errada'}; };
  const RPC={
    sdo_j_ler(){ const j=J(),o={}; IDS.forEach(id=>{ const x=j[id]||{}; o[id]=x.liberado?Object.assign({},x.publico||{},{liberado:true}):{liberado:false}; }); return o; },
    sdo_j_cadeado(a){ const x=J().projetor||{},sg=x.segredo||{},cod=String(sg.codigo||'');
      if(!x.liberado||!cod) return {ok:false,fora:true};
      return String(a.p_codigo||'').replace(/\D/g,'')===cod?{ok:true,texto:sg.dentro||'',img:sg.dentro_img||''}:{ok:false}; },
    sdo_m_j_ler(a){ chk(a.p_senha); const j=J(),o={}; IDS.forEach(id=>{ const x=j[id]||{}; o[id]={liberado:!!x.liberado,publico:x.publico||{},segredo:x.segredo||{}}; }); return o; },
    sdo_m_j_salvar(a){ chk(a.p_senha); const j=J(),x=j[a.p_id]||{liberado:false,publico:{},segredo:{}};
      if(a.p_liberado!=null) x.liberado=a.p_liberado; if(a.p_publico!=null) x.publico=a.p_publico; if(a.p_segredo!=null) x.segredo=a.p_segredo;
      j[a.p_id]=x; Jw(j); return {ok:true}; },
    sdo_ler(a){ const f=F()[a.p_token]; if(!f) throw {message:'nao_encontrada'}; return {dados:f,atualizado_em:''}; },
    sdo_salvar(a){ const fs=F(); if(!fs[a.p_token]) throw {message:'nao_encontrada'}; Object.assign(fs[a.p_token],a.p_patch); Fw(fs); return {ok:true}; }
  };
  function rpc(fn,args){
    return Promise.resolve().then(()=>{
      if(window.__stubNoJogos&&/^sdo_(j|m_j)_/.test(fn)) return {data:null,error:{code:'PGRST202',message:'Could not find the function public.'+fn+' in the schema cache'}};
      if(!RPC[fn]) return {data:null,error:{code:'PGRST202',message:'Could not find the function public.'+fn}};
      try{ return {data:JSON.parse(JSON.stringify(RPC[fn](args||{}))),error:null}; }catch(e){ return {data:null,error:{message:e.message||String(e),code:e.code}}; }
    });
  }
  window.supabase={createClient(){ return {from:q,rpc:rpc,channel:channel,removeChannel(ch){ for(let i=listeners.length-1;i>=0;i--) if(listeners[i].ch===ch) listeners.splice(i,1); },storage:storage}; }};
})();
