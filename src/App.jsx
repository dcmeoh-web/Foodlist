import React, { useEffect, useMemo, useState } from 'react';
import { MISSING, repo } from './repo.js';

const ENUM = {
  unit: ['g', 'kg', 'ml'],
  status: ['있음', '없음', '혼입만 기재'],
  relation: ['포함', '혼입'],
  rule: ['권장', '금지'],
  state: ['개봉 전', '개봉 후', '조리', '구분 없음'],
  noteType: ['수량', '판매기간', '섭취안내', '제품특성'],
};

const groupBy = (rows) => {
  const m = new Map();
  rows.forEach((r) => {
    if (!m.has(r.상품코드)) m.set(r.상품코드, []);
    m.get(r.상품코드).push(r);
  });
  return m;
};
const norm = (s) => String(s).normalize('NFC').toLowerCase();
const won = (n) => Number(n).toLocaleString('ko-KR') + '원';
const badgeClass = (v) => 'badge b-' + String(v).replace(/\s/g, '');

function Val({ v }) {
  return v === MISSING ? <span className="missing">{v}</span> : <>{v}</>;
}

function Select({ value, onChange, options }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

// ---------- 상세 ----------

function Detail({ info }) {
  const { ing, al, st, nt } = info;
  return (
    <div className="grid">
      <section>
        <h3>원재료 · 원산지</h3>
        {ing.length ? (
          <ul>{ing.map((r) => (
            <li key={r.번호}>{r.원재료} — <Val v={r.원산지} />{r.비고 ? <span className="sub"> ({r.비고})</span> : null}</li>
          ))}</ul>
        ) : <span className="sub">정보 없음</span>}
      </section>
      <section>
        <h3>알레르기 · 혼입</h3>
        {al.length ? (
          <ul>{al.map((r) => <li key={r.번호}>{r.물질} <span className="sub">({r.관계})</span></li>)}</ul>
        ) : <span className="sub">문서에 알레르기 유발 물질 없음 또는 미기재</span>}
      </section>
      <section>
        <h3>보관 · 조리</h3>
        {st.length ? (
          <ul>{st.map((r) => (
            <li key={r.번호}>
              <span className={badgeClass(r.구분)}>{r.구분}</span> {r.상태} · <Val v={r.방법} />
              {r.기간 ? ` · ${r.기간}` : ''}
              {r.비고 ? <span className="sub"> — {r.비고}</span> : null}
            </li>
          ))}</ul>
        ) : <span className="sub">정보 없음</span>}
      </section>
      <section>
        <h3>참고</h3>
        {nt.length ? (
          <ul>{nt.map((r) => <li key={r.번호}><span className="sub">{r.종류}</span> {r.내용}</li>)}</ul>
        ) : <span className="sub">정보 없음</span>}
      </section>
    </div>
  );
}

// ---------- 추가 폼 ----------

function RowEditor({ title, rows, setRows, blank, renderRow }) {
  const set = (i, k, v) => setRows(rows.map((r, j) => (j === i ? { ...r, [k]: v } : r)));
  return (
    <fieldset>
      <legend>{title}</legend>
      {rows.map((r, i) => (
        <div className="row-edit" key={i}>
          {renderRow(r, (k, v) => set(i, k, v))}
          <button type="button" className="ghost" aria-label="행 삭제"
            onClick={() => setRows(rows.filter((_, j) => j !== i))}>✕</button>
        </div>
      ))}
      <button type="button" className="ghost" onClick={() => setRows([...rows, { ...blank }])}>+ 추가</button>
    </fieldset>
  );
}

function AddForm({ existingCodes, onSubmit, onClose }) {
  const [f, setF] = useState({ code: '', name: '', desc: '', price: '', amount: '', unit: 'g', status: '없음', source: '' });
  const [ing, setIng] = useState([]);
  const [al, setAl] = useState([]);
  const [st, setSt] = useState([]);
  const [nt, setNt] = useState([]);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const bind = (k) => ({ value: f[k], onChange: (e) => setF({ ...f, [k]: e.target.value }) });

  const submit = async (e) => {
    e.preventDefault();
    const code = f.code.trim();
    const price = Number(f.price);
    const amount = Number(f.amount);
    if (!code || !f.name.trim() || !f.desc.trim() || !f.source.trim()) return setErr('상품코드, 상품명, 상품설명, 근거문서는 꼭 입력해야 합니다.');
    if (existingCodes.has(code)) return setErr('이미 있는 상품코드입니다.');
    if (f.price === '' || !Number.isInteger(price) || price < 0) return setErr('가격은 0 이상의 정수로 입력하세요.');
    if (f.amount === '' || !(amount > 0)) return setErr('용량수치는 0보다 큰 숫자로 입력하세요.');

    const form = {
      product: {
        상품코드: code, 상품명: f.name.trim(), 상품설명: f.desc.trim(), 가격: price,
        용량수치: amount, 용량단위: f.unit, 알레르기표시상태: f.status, 근거문서: f.source.trim(),
      },
      ingredients: ing.filter((r) => r.원재료.trim()).map((r) => ({
        원재료: r.원재료.trim(), 원산지: r.원산지.trim() || MISSING, 비고: r.비고.trim() || null,
      })),
      allergens: al.filter((r) => r.물질.trim()).map((r) => ({ 물질: r.물질.trim(), 관계: r.관계 })),
      storage: st.filter((r) => r.방법.trim()).map((r) => ({
        구분: r.구분, 상태: r.상태, 방법: r.방법.trim(), 기간: r.기간.trim() || null, 비고: r.비고.trim() || null,
      })),
      notes: nt.filter((r) => r.내용.trim()).map((r) => ({ 종류: r.종류, 내용: r.내용.trim() })),
    };
    if (f.status === '없음' && form.allergens.length) return setErr("알레르기표시상태가 '없음'이면 알레르기 물질을 입력할 수 없습니다.");
    if (f.status !== '없음' && !form.allergens.length) return setErr(`알레르기표시상태가 '${f.status}'이면 알레르기 물질을 1개 이상 입력하세요.`);

    setBusy(true);
    setErr('');
    try {
      await onSubmit(form);
    } catch (ex) {
      setErr(ex.message);
      setBusy(false);
    }
  };

  return (
    <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <form className="modal" role="dialog" aria-modal="true" aria-label="상품 추가" onSubmit={submit}>
        <h2>상품 추가</h2>
        {err ? <div className="msg error" role="alert">{err}</div> : null}
        <div className="form-grid">
          <label className="f">상품코드<input {...bind('code')} placeholder="예: P-0501" autoFocus /></label>
          <label className="f">상품명<input {...bind('name')} /></label>
          <label className="f">가격(원)<input {...bind('price')} type="number" min="0" step="1" /></label>
          <label className="f">용량수치<input {...bind('amount')} type="number" min="0" step="any" /></label>
          <label className="f">용량단위
            <Select value={f.unit} onChange={(v) => setF({ ...f, unit: v })} options={ENUM.unit} /></label>
          <label className="f">알레르기표시상태
            <Select value={f.status} onChange={(v) => setF({ ...f, status: v })} options={ENUM.status} /></label>
        </div>
        <div className="form-grid" style={{ marginTop: 12 }}>
          <label className="f">상품설명<input {...bind('desc')} /></label>
          <label className="f">근거문서<input {...bind('source')} placeholder="예: P-0501_상품명.md" /></label>
        </div>
        <p className="hint">비어 있는 칸은 저장되지 않습니다. 원산지를 비우면 '{MISSING}'으로 저장됩니다.</p>

        <RowEditor title="원재료" rows={ing} setRows={setIng} blank={{ 원재료: '', 원산지: '', 비고: '' }}
          renderRow={(r, set) => (<>
            <input placeholder="원재료" value={r.원재료} onChange={(e) => set('원재료', e.target.value)} />
            <input placeholder="원산지" value={r.원산지} onChange={(e) => set('원산지', e.target.value)} />
            <input placeholder="비고" value={r.비고} onChange={(e) => set('비고', e.target.value)} />
          </>)} />
        <RowEditor title="알레르기 · 혼입 물질" rows={al} setRows={setAl} blank={{ 물질: '', 관계: '포함' }}
          renderRow={(r, set) => (<>
            <input placeholder="물질 (예: 밀)" value={r.물질} onChange={(e) => set('물질', e.target.value)} />
            <Select value={r.관계} onChange={(v) => set('관계', v)} options={ENUM.relation} />
          </>)} />
        <RowEditor title="보관 · 조리" rows={st} setRows={setSt} blank={{ 구분: '권장', 상태: '구분 없음', 방법: '', 기간: '', 비고: '' }}
          renderRow={(r, set) => (<>
            <Select value={r.구분} onChange={(v) => set('구분', v)} options={ENUM.rule} />
            <Select value={r.상태} onChange={(v) => set('상태', v)} options={ENUM.state} />
            <input placeholder="방법 (예: 냉장)" value={r.방법} onChange={(e) => set('방법', e.target.value)} />
            <input placeholder="기간" value={r.기간} onChange={(e) => set('기간', e.target.value)} />
            <input placeholder="비고" value={r.비고} onChange={(e) => set('비고', e.target.value)} />
          </>)} />
        <RowEditor title="참고" rows={nt} setRows={setNt} blank={{ 종류: '제품특성', 내용: '' }}
          renderRow={(r, set) => (<>
            <Select value={r.종류} onChange={(v) => set('종류', v)} options={ENUM.noteType} />
            <input placeholder="내용" value={r.내용} onChange={(e) => set('내용', e.target.value)} />
          </>)} />

        <div className="actions">
          <button type="button" onClick={onClose} disabled={busy}>취소</button>
          <button type="submit" className="primary" disabled={busy}>{busy ? '저장 중…' : '저장'}</button>
        </div>
      </form>
    </div>
  );
}

// ---------- 앱 ----------

export default function App() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('전체');
  const [openCode, setOpenCode] = useState(null);
  const [adding, setAdding] = useState(false);

  const reload = async () => {
    try {
      setData(await repo.load());
      setError('');
    } catch (e) {
      setError('불러오지 못했습니다: ' + e.message);
    }
  };
  useEffect(() => { reload(); }, []);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(''), 3500);
    return () => clearTimeout(t);
  }, [notice]);

  const kids = useMemo(() => data && {
    ing: groupBy(data.ingredients), al: groupBy(data.allergens),
    st: groupBy(data.storage), nt: groupBy(data.notes),
  }, [data]);

  const infoOf = (code) => ({
    ing: kids.ing.get(code) || [], al: kids.al.get(code) || [],
    st: kids.st.get(code) || [], nt: kids.nt.get(code) || [],
  });

  const filtered = useMemo(() => {
    if (!data) return [];
    // 복사한 글자(NFD)와 대소문자 차이를 없애고, 띄어쓰기로 나눈 단어가 모두 들어 있으면 일치로 본다
    const tokens = norm(query).split(/\s+/).filter(Boolean);
    return data.products.filter((p) => {
      if (status !== '전체' && p.알레르기표시상태 !== status) return false;
      if (!tokens.length) return true;
      const text = norm([
        p.상품코드, p.상품명, p.상품설명,
        ...(kids.ing.get(p.상품코드) || []).map((r) => r.원재료),
        ...(kids.al.get(p.상품코드) || []).map((r) => r.물질),
      ].join(' '));
      // 검색어와 본문의 띄어쓰기가 달라도('대구사과칩' ↔ '대구 사과칩') 찾는다
      return tokens.every((t) => text.includes(t)) || text.replace(/\s/g, '').includes(tokens.join(''));
    });
  }, [data, kids, query, status]);

  const onAdd = async (form) => {
    await repo.addProduct(form);
    setAdding(false);
    setNotice(`추가했습니다: ${form.product.상품명} (${form.product.상품코드})`);
    await reload();
  };

  const onDelete = async (p) => {
    const ok = window.confirm(`'${p.상품명}' (${p.상품코드}) 상품을 삭제할까요?\n원재료 · 알레르기 · 보관 · 참고 정보도 함께 지워집니다.`);
    if (!ok) return;
    try {
      await repo.deleteProduct(p.상품코드);
      if (openCode === p.상품코드) setOpenCode(null);
      setNotice(`삭제했습니다: ${p.상품명} (${p.상품코드})`);
      await reload();
    } catch (e) {
      setError('삭제하지 못했습니다: ' + e.message);
    }
  };

  return (
    <div className="wrap">
      <header>
        <h1>상품 관리</h1>
        <span className={'mode' + (repo.mode === 'demo' ? ' demo' : '')}>
          {repo.mode === 'demo' ? '데모 모드 · 새로고침하면 초기화' : `Supabase 연결됨 (${repo.via})`}
        </span>
      </header>

      {repo.mode === 'demo' ? (
        <div className="msg info">.env.local에 Supabase 주소와 키를 넣으면 실제 DB에 연결됩니다. 지금 추가 · 삭제한 내용은 저장되지 않습니다.</div>
      ) : null}
      {error ? <div className="msg error" role="alert">{error}</div> : null}
      {notice ? <div className="msg ok" role="status">{notice}</div> : null}

      <div className="toolbar">
        <input type="search" placeholder="상품코드 · 상품명 · 설명 · 원재료 · 알레르기 물질 검색"
          value={query} onChange={(e) => setQuery(e.target.value)} aria-label="검색" />
        <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="알레르기 표시 상태">
          {['전체', ...ENUM.status].map((s) => (
            <option key={s} value={s}>{s === '전체' ? '알레르기 표시: 전체' : `알레르기 표시: ${s}`}</option>
          ))}
        </select>
        <button className="primary" onClick={() => setAdding(true)} disabled={!data}>+ 상품 추가</button>
      </div>

      {!data ? (
        <div className="card empty">{error ? '' : '불러오는 중…'}</div>
      ) : (
        <>
          <p className="count">{data.products.length}개 중 {filtered.length}개 표시</p>
          <div className="card scroll">
            {filtered.length === 0 ? (
              <div className="empty">조건에 맞는 상품이 없습니다.</div>
            ) : (
              <table>
                <thead>
                  <tr><th>상품코드</th><th>상품명</th><th className="num">용량</th><th className="num">가격</th><th>알레르기</th><th></th></tr>
                </thead>
                <tbody>
                  {filtered.map((p) => {
                    const info = infoOf(p.상품코드);
                    const open = openCode === p.상품코드;
                    return (
                      <React.Fragment key={p.상품코드}>
                        <tr className="item" onClick={() => setOpenCode(open ? null : p.상품코드)} aria-expanded={open}>
                          <td>{p.상품코드}</td>
                          <td>{p.상품명}<div className="sub">{p.상품설명}</div></td>
                          <td className="num">{p.용량수치}{p.용량단위}</td>
                          <td className="num">{won(p.가격)}</td>
                          <td>
                            <span className={badgeClass(p.알레르기표시상태)}>{p.알레르기표시상태}</span>
                            {info.al.length ? (
                              <div className="sub">{info.al.map((r) => `${r.물질}(${r.관계})`).join(', ')}</div>
                            ) : null}
                          </td>
                          <td>
                            <button className="ghost danger" onClick={(e) => { e.stopPropagation(); onDelete(p); }}>삭제</button>
                          </td>
                        </tr>
                        {open ? (
                          <tr className="detail"><td colSpan={6}>
                            <Detail info={info} />
                            <p className="sub" style={{ margin: '12px 0 0' }}>근거 문서: {p.근거문서}</p>
                          </td></tr>
                        ) : null}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {adding ? (
        <AddForm existingCodes={new Set(data.products.map((p) => p.상품코드))}
          onSubmit={onAdd} onClose={() => setAdding(false)} />
      ) : null}
    </div>
  );
}
