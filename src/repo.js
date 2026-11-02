// 데이터 저장소: Supabase 또는 데모(메모리). 키가 없으면 자동으로 데모 모드가 된다.
import { createClient } from '@supabase/supabase-js';
import demoData from './demo-data.js';

export const MISSING = '문서 미기재';

const CHILD = [
  ['ingredients', '상품_원재료'],
  ['allergens', '상품_알레르기'],
  ['storage', '상품_보관'],
  ['notes', '상품_참고'],
];

function createSupabaseRepo(url, key, via) {
  const db = createClient(url, key);
  const ok = (res) => {
    if (res.error) throw new Error(res.error.message);
    return res.data;
  };
  return {
    mode: 'supabase',
    via,
    async load() {
      const [p, ...kids] = await Promise.all([
        db.from('상품').select('*').order('상품코드'),
        ...CHILD.map(([, t]) => db.from(t).select('*').order('번호')),
      ]);
      const data = { products: ok(p) };
      CHILD.forEach(([k], i) => { data[k] = ok(kids[i]); });
      return data;
    },
    async addProduct(form) {
      const code = form.product.상품코드;
      ok(await db.from('상품').insert(form.product));
      try {
        for (const [k, t] of CHILD) {
          if (form[k].length) ok(await db.from(t).insert(form[k].map((r) => ({ ...r, 상품코드: code }))));
        }
      } catch (e) {
        await db.from('상품').delete().eq('상품코드', code); // 일부만 들어간 상태를 되돌린다
        throw e;
      }
    },
    async deleteProduct(code) {
      // RLS 삭제 정책이 없으면 오류 없이 0건이 지워지므로 결과를 확인한다
      const rows = ok(await db.from('상품').delete().eq('상품코드', code).select());
      if (!rows.length) throw new Error('삭제되지 않았습니다. 삭제 RLS 정책(products_policies.sql)을 확인하세요.');
    },
  };
}

function createDemoRepo() {
  const store = JSON.parse(JSON.stringify(demoData));
  let seq = 1000;
  return {
    mode: 'demo',
    async load() { return JSON.parse(JSON.stringify(store)); },
    async addProduct(form) {
      if (store.products.some((p) => p.상품코드 === form.product.상품코드)) {
        throw new Error('이미 있는 상품코드입니다.');
      }
      store.products.push(form.product);
      CHILD.forEach(([k]) => {
        form[k].forEach((r) => store[k].push({ 번호: ++seq, 상품코드: form.product.상품코드, ...r }));
      });
    },
    async deleteProduct(code) {
      store.products = store.products.filter((p) => p.상품코드 !== code);
      CHILD.forEach(([k]) => { store[k] = store[k].filter((r) => r.상품코드 !== code); });
    },
  };
}

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// __SUPABASE_PROXY__: vite.config.js가 service_role 키로 REST를 대신 호출하는 프록시를 켰는지 여부.
// 켜져 있으면 브라우저는 같은 주소의 /supabase 로만 요청하고, 실제 키는 개발 서버에만 있다.
export const repo = __SUPABASE_PROXY__
  ? createSupabaseRepo(`${window.location.origin}/supabase`, anonKey || 'proxy', 'service_role')
  : url && anonKey
    ? createSupabaseRepo(url, anonKey, 'anon')
    : createDemoRepo();
